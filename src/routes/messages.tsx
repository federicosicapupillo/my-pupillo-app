import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messaggi — Pupillo" }] }),
  validateSearch: zodValidator(
    z.object({ with: fallback(z.string(), "").default("") }),
  ),
  component: () => <RequireAuth><MessagesLayout /></RequireAuth>,
});

type Thread = {
  id: string;
  status: string;
  announcementId: string;
  restaurantId: string;
  workerId: string;
  other: { id: string; name: string };
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
  annRole: string | null;
  annDate: string | null;
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

function MessagesLayout() {
  const { user, role, loading: authLoading } = useAuth();
  const { with: withUser } = Route.useSearch();
  const location = useLocation();
  const selectedId = location.pathname.startsWith("/messages/")
    ? decodeURIComponent(location.pathname.split("/")[2] ?? "")
    : "";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingReviewAppIds, setPendingReviewAppIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user || !role) return;
    setLoading(true);
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const otherCol = role === "restaurant" ? "worker_id" : "restaurant_id";
    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select(`id, status, announcement_id, restaurant_id, worker_id, last_message_preview, last_message_at, ${otherCol}`)
      .eq(col, user.id);
    if (appsError) {
      toast.error(appsError.message);
      setThreads([]);
      setLoading(false);
      return;
    }
    const list = (apps ?? []) as any[];
    const others = list.map((a) => a[otherCol]).filter(Boolean);
    const ids = list.map((a) => a.id);
    const annIds = Array.from(new Set(list.map((a) => a.announcement_id).filter(Boolean))) as string[];
    const [{ data: profs }, { data: msgs }, { data: anns }] = await Promise.all([
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
      annIds.length
        ? supabase.from("announcements").select("id, professional_profile, service_date").in("id", annIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const amap = new Map((anns ?? []).map((a: any) => [a.id, a]));
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
      const ann = amap.get(a.announcement_id);
      return {
        id: a.id,
        status: a.status,
        announcementId: a.announcement_id,
        restaurantId: a.restaurant_id,
        workerId: a.worker_id,
        other: { id: a[otherCol], name: p?.business_name || p?.full_name || "Utente" },
        lastBody: a.last_message_preview ?? last?.body ?? null,
        lastAt: a.last_message_at ?? last?.created_at ?? null,
        unread: unreadByApp.get(a.id) ?? 0,
        annRole: ann?.professional_profile ?? null,
        annDate: ann?.service_date ?? null,
      };
    });
    next.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.other.name.localeCompare(b.other.name));
    setThreads(next);
    // Restaurant side: load pending/overdue required reviews to flag groups
    if (role === "restaurant" && ids.length) {
      const { data: rr } = await (supabase as any)
        .from("required_reviews")
        .select("application_id")
        .eq("restaurant_user_id", user.id)
        .in("status", ["pending", "overdue"])
        .in("application_id", ids);
      setPendingReviewAppIds(new Set(((rr ?? []) as any[]).map((r) => r.application_id).filter(Boolean)));
    } else {
      setPendingReviewAppIds(new Set());
    }
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, role, authLoading]);

  // Realtime: status updates + new messages
  useEffect(() => {
    if (!user || !role) return;
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

  // Build groups by other-user (visual only) when no specific user is focused
  const groups = (() => {
    const m = new Map<string, { id: string; name: string; items: Thread[]; lastAt: string | null; unread: number }>();
    for (const t of threads) {
      const g = m.get(t.other.id) ?? { id: t.other.id, name: t.other.name, items: [], lastAt: null, unread: 0 };
      g.items.push(t);
      if ((t.lastAt ?? "") > (g.lastAt ?? "")) g.lastAt = t.lastAt;
      g.unread += t.unread;
      m.set(t.other.id, g);
    }
    const arr = Array.from(m.values());
    arr.forEach((g) =>
      g.items.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")),
    );
    arr.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name));
    return arr;
  })();
  const visibleGroups = groups.filter((g) => {
    if (filter === "unread" && g.unread === 0) return false;
    if (statusFilter !== "all" && !g.items.some((t) => t.status === statusFilter)) return false;
    return true;
  });
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "");

  return (
    <AppShell>
      <PageHeader title="Messaggi" subtitle="Le tue conversazioni" />
      <RequiredReviewsBanner />
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)]">
        <section className={`${selectedId ? "hidden lg:block" : "block"} min-w-0`} aria-label="Lista conversazioni">
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
              Nessun messaggio ancora. Le conversazioni appariranno qui quando nasce un contatto tra ristoratore e lavoratore.
            </div>
          ) : (withUser ? visible.length === 0 : visibleGroups.length === 0) ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              Nessuna conversazione corrisponde ai filtri selezionati.
            </div>
          ) : withUser ? (
            <div className="space-y-2">
              {visible.map((t) => {
                const active = selectedId === t.id;
                return (
                  <Link
                    key={t.id}
                    to="/messages/$id"
                    params={{ id: t.id }}
                    className={`group flex items-center gap-3 rounded-2xl border p-4 transition outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-accent"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar userId={t.other.id} name={t.other.name} className="h-10 w-10" />
                      {t.unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                          {t.unread > 9 ? "9+" : t.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`truncate text-primary group-hover:underline underline-offset-2 ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                          {[t.annRole, fmtDate(t.annDate)].filter(Boolean).join(" — ") || t.other.name}
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
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleGroups.map((g) => {
                const last = g.items[0];
                const statusTally = g.items.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {});
                const hasPendingReview = g.items.some((t) => pendingReviewAppIds.has(t.id));
                return (
                  <Link
                    key={g.id}
                    to="/messages"
                    search={{ with: g.id }}
                    className="group flex items-center gap-3 rounded-2xl border p-4 transition outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-card hover:bg-accent"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar userId={g.id} name={g.name} className="h-10 w-10" />
                      {g.unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                          {g.unread > 9 ? "9+" : g.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`truncate text-primary group-hover:underline underline-offset-2 ${g.unread > 0 ? "font-semibold" : "font-medium"}`}>
                          {g.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">{formatWhen(g.lastAt)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className={`text-xs truncate ${g.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {last?.lastBody ?? "Nessun messaggio"}
                        </div>
                        <span className="shrink-0 inline-block text-[10px] rounded-full px-2 py-0.5 bg-muted text-foreground">
                          {g.items.length} {g.items.length === 1 ? "proposta" : "proposte"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.unread > 0 && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary font-medium">Non letto</span>
                        )}
                        {hasPendingReview && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-700 font-medium">
                            Recensione da inviare
                          </span>
                        )}
                        {Object.entries(statusTally).map(([s, c]) => (
                          <span key={s} className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_CLS[s] || "bg-muted text-muted-foreground"}`}>
                            {c} {STATUS_LABELS[s] || s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className={`${selectedId ? "block" : "hidden lg:block"} min-w-0`} aria-label="Chat conversazione">
          {selectedId ? (
            <Outlet />
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-2xl border bg-card p-10 text-center text-muted-foreground">
              Seleziona una conversazione per iniziare.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
