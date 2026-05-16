import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import {
  STATUS_PRIORITY,
  statusRank,
  computePrimaryStatus,
  effectiveStatus as effectiveStatusLib,
} from "@/lib/message-grouping";
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
  createdAt: string | null;
  unread: number;
  ann: { role: string | null; date: string | null; time: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa di risposta",
  interested: "Interesse mostrato",
  counter_offer: "Controproposta",
  accepted: "Accettato",
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
  completed: "bg-slate-500/15 text-slate-700",
};

const effectiveStatus = (t: Thread): string => effectiveStatusLib(t);

// Filtri esposti all'utente (in ordine).
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "pending", label: "In attesa" },
  { key: "accepted", label: "Accettato" },
  { key: "rejected", label: "Rifiutato" },
  { key: "completed", label: "Completato" },
];

// STATUS_PRIORITY / statusRank importati da @/lib/message-grouping.
void STATUS_PRIORITY;
void statusRank;

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!user || !role) return;
    setLoading(true);
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const otherCol = role === "restaurant" ? "worker_id" : "restaurant_id";
    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select(`id, status, announcement_id, restaurant_id, worker_id, last_message_preview, last_message_at, created_at, ${otherCol}`)
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
    const annIds = Array.from(new Set(list.map((a) => a.announcement_id).filter(Boolean)));
    const [{ data: profs }, { data: msgs }, { data: annsData }] = await Promise.all([
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
        ? supabase
            .from("announcements")
            .select("id, professional_profile, service_date, service_time")
            .in("id", annIds as string[])
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const amap = new Map((annsData ?? []).map((a: any) => [a.id, a]));
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
      const ann = a.announcement_id ? amap.get(a.announcement_id) : null;
      return {
        id: a.id,
        status: a.status,
        announcementId: a.announcement_id,
        restaurantId: a.restaurant_id,
        workerId: a.worker_id,
        other: { id: a[otherCol], name: p?.business_name || p?.full_name || "Utente" },
        lastBody: a.last_message_preview ?? last?.body ?? null,
        lastAt: a.last_message_at ?? last?.created_at ?? null,
        createdAt: a.created_at ?? null,
        unread: unreadByApp.get(a.id) ?? 0,
        ann: ann
          ? {
              role: ann.professional_profile ?? null,
              date: ann.service_date ?? null,
              time: ann.service_time ?? null,
            }
          : null,
      };
    });
    next.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.other.name.localeCompare(b.other.name));
    setThreads(next);
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, role, authLoading]);

  // Quando si apre una proposta (click o navigazione diretta), considerala letta:
  // azzera l'unread del thread selezionato così il badge del gruppo e della riga
  // si aggiornano subito, senza aspettare l'evento realtime.
  useEffect(() => {
    if (!selectedId) return;
    setThreads((prev) =>
      prev.some((t) => t.id === selectedId && t.unread > 0)
        ? prev.map((t) => (t.id === selectedId ? { ...t, unread: 0 } : t))
        : prev
    );
  }, [selectedId]);

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
    const eff = effectiveStatus(t);
    acc[eff] = (acc[eff] ?? 0) + 1;
    return acc;
  }, {});
  const visible = threads.filter((t) => {
    if (filter === "unread" && t.unread === 0) return false;
    if (statusFilter !== "all" && effectiveStatus(t) !== statusFilter) return false;
    if (withUser && t.other.id !== withUser) return false;
    const q = query.trim().toLowerCase();
    if (q) {
      const role = t.ann?.role ?? "";
      const date = t.ann?.date
        ? new Date(t.ann.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
        : "";
      const time = t.ann?.time ? t.ann.time.slice(0, 5) : "";
      const hay = [
        t.other.name,
        role,
        date,
        time,
        t.ann?.date ?? "",
        t.lastBody ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const focusedName = withUser ? threads.find((t) => t.other.id === withUser)?.other.name : null;

  // Raggruppa per controparte (worker se sono ristoratore, ristoratore se sono lavoratore).
  // Ogni proposta resta una conversazione separata: il raggruppamento è solo visivo.
  type Group = { otherId: string; name: string; threads: Thread[]; lastAt: string | null; unread: number };
  const groupsMap = new Map<string, Group>();
  for (const t of visible) {
    let g = groupsMap.get(t.other.id);
    if (!g) {
      g = { otherId: t.other.id, name: t.other.name, threads: [], lastAt: null, unread: 0 };
      groupsMap.set(t.other.id, g);
    }
    g.threads.push(t);
    g.unread += t.unread;
    if ((t.lastAt ?? "") > (g.lastAt ?? "")) g.lastAt = t.lastAt;
  }
  const groups = Array.from(groupsMap.values())
    .map((g) => ({
      ...g,
      threads: [...g.threads].sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")),
    }))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name));

  // Espandi automaticamente il gruppo che contiene la chat selezionata.
  const autoExpandedId = selectedId
    ? threads.find((t) => t.id === selectedId)?.other.id ?? null
    : null;
  const isExpanded = (otherId: string) =>
    expanded.has(otherId) || otherId === autoExpandedId || groups.length === 1;
  const toggleGroup = (otherId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(otherId)) next.delete(otherId);
      else next.add(otherId);
      return next;
    });
  };

  const fmtAnnLine = (t: Thread) => {
    const role = t.ann?.role ?? "Proposta";
    const date = t.ann?.date
      ? new Date(t.ann.date).toLocaleDateString("it-IT", { day: "numeric", month: "long" })
      : "";
    const time = t.ann?.time ? t.ann.time.slice(0, 5) : "";
    return [role, date, time].filter(Boolean).join(" — ");
  };

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
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, ruolo o data turno…"
              className="w-full rounded-xl border bg-card pl-9 pr-9 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cerca conversazioni"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Pulisci ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
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
            {STATUS_FILTERS.map(({ key, label }) => {
              const count = statusCounts[key] ?? 0;
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`text-[11px] rounded-full px-2.5 py-1 border transition ${active ? "bg-foreground text-background border-foreground" : `${STATUS_CLS[key]} border-transparent hover:opacity-80`}`}
                >
                  {label} ({count})
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
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              Nessuna conversazione corrisponde ai filtri selezionati.
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const open = isExpanded(g.otherId);
                const last = g.threads[0];
                const statusCount = g.threads.reduce<Record<string, number>>((acc, t) => {
                  acc[t.status] = (acc[t.status] ?? 0) + 1;
                  return acc;
                }, {});
                // Stato primario del gruppo (logica testata in @/lib/message-grouping).
                const primaryStatus = computePrimaryStatus(g.threads);
                const summaryBadges = primaryStatus
                  ? [
                      [primaryStatus, statusCount[primaryStatus] ?? 1] as [string, number],
                    ]
                  : [];
                const groupHasActive = g.threads.some((t) => t.id === selectedId);
                return (
                  <div
                    key={g.otherId}
                    className={`rounded-2xl border bg-card transition ${groupHasActive ? "border-primary/40" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.otherId)}
                      className="flex w-full items-center gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
                      aria-expanded={open}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar userId={g.otherId} name={g.name} className="h-10 w-10" />
                        {g.unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                            {g.unread > 9 ? "9+" : g.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={`truncate ${g.unread > 0 ? "font-semibold" : "font-medium"}`}>
                            {g.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">{formatWhen(g.lastAt)}</div>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-muted-foreground">
                            {g.threads.length} {g.threads.length === 1 ? "proposta" : "proposte"}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {summaryBadges.map(([s, n]) => (
                              <span key={s} className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_CLS[s] || "bg-muted text-muted-foreground"}`}>
                                {n} {STATUS_LABELS[s] || s}
                              </span>
                            ))}
                          </div>
                        </div>
                        {last?.lastBody && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">{last.lastBody}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>
                    {open && (
                      <div className="border-t bg-muted/30 px-2 py-2 space-y-1">
                        {g.threads.map((t) => {
                          const active = selectedId === t.id;
                          return (
                            <Link
                              key={t.id}
                              to="/messages/$id"
                              params={{ id: t.id }}
                              className={`block rounded-xl border p-3 transition outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary/10 border-primary/40" : "bg-card hover:bg-accent border-transparent"}`}
                              aria-current={active ? "page" : undefined}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <div className={`truncate text-sm ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                                  {fmtAnnLine(t)}
                                </div>
                                <div className="text-[11px] text-muted-foreground shrink-0">{formatWhen(t.lastAt)}</div>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className={`text-xs truncate ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                  {t.lastBody ?? "Nessun messaggio"}
                                </div>
                                <span className={`shrink-0 inline-block text-[10px] rounded-full px-2 py-0.5 ${STATUS_CLS[t.status] || "bg-muted text-muted-foreground"}`}>
                                  {STATUS_LABELS[t.status] || t.status}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
