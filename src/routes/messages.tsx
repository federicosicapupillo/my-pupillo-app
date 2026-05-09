import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messaggi — Pupillo" }] }),
  validateSearch: zodValidator(
    z.object({ with: fallback(z.string(), "").default("") }),
  ),
  component: () => <RequireAuth><Inbox /></RequireAuth>,
});

type Thread = {
  id: string;
  status: string;
  other: { id: string; name: string };
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  interested: "Interesse mostrato",
  counter_offer: "Controproposta",
  accepted: "Confermato",
  rejected: "Rifiutato",
  expired: "Scaduto",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  interested: "bg-sky-500/15 text-sky-700",
  counter_offer: "bg-indigo-500/15 text-indigo-700",
  accepted: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-red-500/15 text-red-700",
  expired: "bg-muted text-muted-foreground",
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function Inbox() {
  const { user, role } = useAuth();
  const { with: withUser } = Route.useSearch();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    if (!user) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const otherCol = role === "restaurant" ? "worker_id" : "restaurant_id";
    const { data: apps } = await supabase
      .from("applications")
      .select(`id, status, ${otherCol}`)
      .eq(col, user.id);
    const list = (apps ?? []) as any[];
    const others = list.map((a) => a[otherCol]);
    const ids = list.map((a) => a.id);
    const [{ data: profs }, { data: msgs }] = await Promise.all([
      others.length
        ? supabase.from("profiles").select("id, full_name, business_name").in("id", others)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase
            .from("messages")
            .select("application_id, sender_id, body, created_at, read_at")
            .in("application_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const lastByApp = new Map<string, any>();
    const unreadByApp = new Map<string, number>();
    for (const m of (msgs ?? []) as any[]) {
      if (!lastByApp.has(m.application_id)) lastByApp.set(m.application_id, m);
      if (m.sender_id !== user.id && !m.read_at) {
        unreadByApp.set(m.application_id, (unreadByApp.get(m.application_id) ?? 0) + 1);
      }
    }
    const next: Thread[] = list.map((a) => {
      const p = pmap.get(a[otherCol]);
      const last = lastByApp.get(a.id);
      return {
        id: a.id,
        status: a.status,
        other: { id: a[otherCol], name: p?.business_name || p?.full_name || "Utente" },
        lastBody: last?.body ?? null,
        lastAt: last?.created_at ?? null,
        unread: unreadByApp.get(a.id) ?? 0,
      };
    });
    next.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    setThreads(next);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, role]);

  // Realtime: status updates + new messages
  useEffect(() => {
    if (!user) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `${col}=eq.${user.id}` }, (payload) => {
        const row: any = payload.new || payload.old;
        if (!row) return;
        setThreads((prev) => {
          const prevStatus = prev.find((t) => t.id === row.id)?.status;
          if (prevStatus && row.status && prevStatus !== row.status && STATUS_LABELS[row.status]) {
            toast.message(`Stato aggiornato: ${STATUS_LABELS[row.status]}`);
          }
          return prev.map((t) => (t.id === row.id ? { ...t, status: row.status } : t));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const totalUnread = threads.reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0);
  const statusCounts = threads.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const visible = threads.filter((t) => {
    if (filter === "unread" && t.unread === 0) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (withUser && t.other.id !== withUser) return false;
    return true;
  });
  const focusedName = withUser ? threads.find((t) => t.other.id === withUser)?.other.name : null;

  return (
    <AppShell>
      <PageHeader title="Messaggi" subtitle="Le tue conversazioni" />
      {withUser && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border bg-primary/5 px-3 py-2 text-sm">
          <span>
            Conversazioni con <span className="font-semibold">{focusedName ?? "questo utente"}</span>
            {visible.length > 0 && <span className="ml-1 text-muted-foreground">({visible.length})</span>}
          </span>
          <Link to="/messages" search={{ with: "" }} className="text-xs text-primary hover:underline">
            Mostra tutte
          </Link>
        </div>
      )}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`text-xs rounded-full px-3 py-1.5 border transition ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
        >
          Tutte ({threads.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`text-xs rounded-full px-3 py-1.5 border transition ${filter === "unread" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
        >
          Non lette ({totalUnread})
        </button>
      </div>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-[11px] rounded-full px-2.5 py-1 border transition ${statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-accent"}`}
        >
          Tutti gli stati
        </button>
        {Object.keys(STATUS_LABELS).map((s) => {
          const count = statusCounts[s] ?? 0;
          if (count === 0) return null;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-[11px] rounded-full px-2.5 py-1 border transition ${active ? "bg-foreground text-background border-foreground" : `${STATUS_CLS[s]} border-transparent hover:opacity-80`}`}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>
      {loading ? (
        <p className="text-muted-foreground">Caricamento…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Nessun messaggio ancora. Le conversazioni appariranno qui quando nascerà un contatto tra ristoratore e lavoratore.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Nessuna conversazione corrisponde ai filtri selezionati.
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {visible.map((t) => (
            <Link
              key={t.id}
              to="/messages/$id"
              params={{ id: t.id }}
              className="group flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-accent transition outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-primary" />
                {t.unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                    {t.unread > 9 ? "9+" : t.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className={`truncate text-primary group-hover:underline underline-offset-2 ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                    {t.other.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">{formatWhen(t.lastAt)}</div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className={`text-xs truncate ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {t.lastBody ?? "Nessun messaggio"}
                  </div>
                  <span className={`shrink-0 inline-block text-[10px] rounded-full px-2 py-0.5 ${STATUS_CLS[t.status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
