import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BellOff, BellRing } from "lucide-react";
import { PupilloBell } from "@/components/PupilloIcons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { navigateFromNotificationLink } from "@/lib/notification-link";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean | null;
  created_at: string;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Collapse legacy duplicates that predate the database `dedupe_key` index.
 * For new rows the partial unique index already blocks duplicates at the
 * source; this is a defensive UI safety net so old rows do not appear
 * twice in the panel.
 */
function dedupeNotifs(list: Notif[]): Notif[] {
  const seen = new Set<string>();
  const out: Notif[] = [];
  // Collassa le varianti legacy della notifica "turno completato + recensione"
  // (kind: shift_completed, worker_review_required, review_reminder_shift_end)
  // sulla nuova chiave unica shift_completed_review:<shift>:<user>. La nuova
  // notifica del trigger ha la priorità (lista già ordinata newest→oldest).
  const REVIEW_KINDS = new Set([
    "shift_completed_review",
    "shift_completed",
    "worker_review_required",
    "review_reminder_shift_end",
  ]);
  for (const n of list) {
    const m = (n.metadata ?? {}) as Record<string, unknown>;
    const kind = String(m.kind ?? "");
    const shiftId = m.shift_id as string | undefined;
    const key = REVIEW_KINDS.has(kind) && shiftId
      ? `shift_completed_review:${shiftId}`
      : (n.dedupe_key ||
          (m.kind && (shiftId || m.application_id || m.announcement_id)
            ? `${m.kind}:${shiftId ?? m.application_id ?? m.announcement_id}`
            : `${n.title}|${n.body ?? ""}|${n.link ?? ""}`));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function canUseBrowserPush() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function NotificationBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPerm, setPushPerm] = useState<NotificationPermission | "unsupported">(
    canUseBrowserPush() ? Notification.permission : "unsupported"
  );
  // Track notification IDs we've already toasted so duplicate realtime
  // events (or reconnections that replay INSERTs) don't fire twice.
  const toastedRef = useRef<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(dedupeNotifs((data as Notif[]) ?? []));
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as Notif;
        if (toastedRef.current.has(n.id)) return;
        toastedRef.current.add(n.id);
        setItems(prev => prev.some(i => i.id === n.id) ? prev : dedupeNotifs([n, ...prev]));
        // In-app toast
        toast.message(n.title, {
          description: n.body || undefined,
          action: n.link
            ? { label: "Apri", onClick: () => { void navigateFromNotificationLink(nav, n.link); } }
            : undefined,
        });
        // Browser push if granted and tab not focused
        if (canUseBrowserPush() && Notification.permission === "granted" && document.visibilityState !== "visible") {
          try {
            const browserNotif = new Notification(n.title, { body: n.body || "", tag: n.id });
            browserNotif.onclick = () => {
              window.focus();
              if (n.link) void navigateFromNotificationLink(nav, n.link);
            };
          } catch { /* noop */ }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as Notif;
        setItems(prev => {
          const idx = prev.findIndex(i => i.id === n.id);
          if (idx === -1) return prev;
          const cur = prev[idx];
          if (cur.read === n.read && cur.title === n.title && cur.body === n.body && cur.link === n.link) return prev;
          const next = prev.slice();
          next[idx] = { ...cur, ...n };
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const old = p.old as Notif;
        setItems(prev => prev.filter(i => i.id !== old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = unreadCount;

  const openItem = async (n: Notif) => {
    setOpen(false);
    try {
      console.info("[PUPILLO_NOTIFICATION_CLICK_DEBUG]", {
        notification_id: n.id,
        notification_type: (n as { type?: string }).type ?? null,
        target_url: n.link ?? null,
        user_id: user?.id ?? null,
      });
    } catch { /* ignore */ }
    if (!n.read) {
      // optimistic update
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i));
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      if (error) {
        // rollback on failure
        setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: false } : i));
        toast.error("Impossibile segnare come letta");
      } else {
        setUnreadCount(c => Math.max(0, c - 1));
      }
    }
    if (n.link) await navigateFromNotificationLink(nav, n.link);
    else nav({ to: "/messages" });
  };

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    setUnreadCount(0);
  };

  const requestPush = async () => {
    if (!canUseBrowserPush()) {
      toast.error("Il tuo browser non supporta le notifiche push.");
      return;
    }
    const res = await Notification.requestPermission();
    setPushPerm(res);
    if (res === "granted") {
      toast.success("Notifiche push attivate");
      try { new Notification("Pupillo", { body: "Riceverai qui le notifiche importanti." }); } catch {}
    } else if (res === "denied") {
      toast.error("Notifiche push bloccate dal browser. Abilitale dalle impostazioni del sito.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <PupilloBell size={22} ringing={unread > 0} className="transition-transform duration-200 group-hover:-rotate-12" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1 flex items-center justify-center ring-2 ring-card">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-medium text-sm">Notifiche</span>
          <div className="flex items-center gap-3">
            {unread > 0 && <button onClick={markAll} className="text-xs text-primary hover:underline">Segna lette</button>}
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">Vedi tutte</Link>
          </div>
        </div>
        {pushPerm !== "unsupported" && pushPerm !== "granted" && (
          <div className="px-3 py-2 border-b bg-primary/5">
            <button onClick={requestPush} className="flex items-center gap-2 text-xs text-primary hover:underline">
              {pushPerm === "denied" ? <><BellOff className="h-3.5 w-3.5" />Notifiche bloccate — abilitale nel browser</> : <><BellRing className="h-3.5 w-3.5" />Attiva notifiche push del browser</>}
            </button>
          </div>
        )}
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">Nessuna notifica</p>
          ) : items.map(n => (
            <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-3 py-2 border-b last:border-0 hover:bg-accent transition ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}