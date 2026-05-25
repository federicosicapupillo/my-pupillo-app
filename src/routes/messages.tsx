import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, ChevronDown, ChevronUp, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { UserAvatar } from "@/components/UserAvatar";
import { otherColumnForRole, groupThreadsByOther } from "@/lib/messages-grouping";
import {
  mergeThreadUpdate,
  previewChanged,
  createDebouncedReload,
  applyIncomingMessage,
  applyProposalResponse,
  clearThreadUnread,
} from "@/lib/inbox-realtime";
import { getLastAnnouncementId, setLastAnnouncementId } from "@/lib/last-announcement";
import {
  isApplicationConfirmed,
  PUBLIC_VENUE_NAME,
  getDisplayPartnerName,
  WORKED_TOGETHER_SHIFT_STATUSES,
} from "@/lib/public-location";

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
  hasWorkedTogether: boolean;
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

const STATUS_BTN_ACTIVE: Record<string, string> = {
  pending: "bg-amber-500 text-white border-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_10px_40px_-10px_rgba(245,158,11,0.45)]",
  interested: "bg-sky-500 text-white border-sky-400 shadow-[0_0_0_1px_rgba(14,165,233,0.35),0_10px_40px_-10px_rgba(14,165,233,0.45)]",
  counter_offer: "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_0_1px_rgba(99,102,241,0.35),0_10px_40px_-10px_rgba(99,102,241,0.45)]",
  accepted: "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_10px_40px_-10px_rgba(16,185,129,0.45)]",
  rejected: "bg-red-500 text-white border-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_10px_40px_-10px_rgba(239,68,68,0.45)]",
  expired: "bg-muted text-muted-foreground border-border",
};
const STATUS_BTN_INACTIVE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20 hover:opacity-80",
  interested: "bg-sky-500/10 text-sky-300 border-sky-500/20 hover:opacity-80",
  counter_offer: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:opacity-80",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:opacity-80",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20 hover:opacity-80",
  expired: "bg-muted text-muted-foreground border-border hover:opacity-80",
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

function formatRoleLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const spaced = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatServiceDate(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function formatHHMM(t: string | null | undefined): string {
  if (!t) return "";
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function formatServiceTime(start: string | null | undefined, end: string | null | undefined): string {
  const s = formatHHMM(start);
  const e = formatHHMM(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return `dalle ${s}`;
  return "";
}

function MessagesLayout() {
  const { user, role, loading: authLoading } = useAuth();
  const { with: withUser } = Route.useSearch();
  const location = useLocation();
  const selectedId = location.pathname.startsWith("/messages/")
    ? decodeURIComponent(location.pathname.split("/")[2] ?? "")
    : "";
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingReviewAppIds, setPendingReviewAppIds] = useState<Set<string>>(new Set());
  const [lastAnn, setLastAnn] = useState<{
    id: string;
    role: string;
    dateLabel: string;
    timeLabel: string;
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const load = async () => {
    if (!user || !role) return;
    setLoading(true);
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const otherCol = otherColumnForRole(role);
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
    const [{ data: profs }, { data: msgs }, { data: anns }, { data: priorShifts }] = await Promise.all([
      others.length
        ? supabase.from("profiles").select("id, full_name, first_name, business_name").in("id", others)
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
      // "Have I worked with them?" — any shift row (other than cancelled/no_show)
      // between me and any of these partners proves a confirmed past relationship.
      others.length
        ? supabase
            .from("shifts")
            .select("worker_id, restaurant_id, status")
            .eq(col, user.id)
            .in(otherCol, others)
            .in("status", [...WORKED_TOGETHER_SHIFT_STATUSES])
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const amap = new Map((anns ?? []).map((a: any) => [a.id, a]));
    const workedSet = new Set<string>();
    for (const s of (priorShifts ?? []) as any[]) {
      const partner = role === "restaurant" ? s.worker_id : s.restaurant_id;
      if (partner) workedSet.add(partner);
    }
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
      const otherIdVal = a[otherCol] as string | null;
      const hasWorkedTogether = !!otherIdVal && workedSet.has(otherIdVal);
      const displayName = getDisplayPartnerName({
        viewerRole: role,
        appStatus: a.status,
        hasWorkedTogether,
        partner: {
          businessName: p?.business_name ?? null,
          fullName: p?.full_name ?? null,
          firstName: p?.first_name ?? null,
        },
      });
      return {
        id: a.id,
        status: a.status,
        announcementId: a.announcement_id,
        restaurantId: a.restaurant_id,
        workerId: a.worker_id,
        other: { id: a[otherCol], name: displayName },
        lastBody: a.last_message_preview ?? last?.body ?? null,
        lastAt: a.last_message_at ?? last?.created_at ?? null,
        unread: unreadByApp.get(a.id) ?? 0,
        annRole: ann?.professional_profile ?? null,
        annDate: ann?.service_date ?? null,
        hasWorkedTogether,
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
    // Debounced reload so a burst of related events (application INSERT +
    // message INSERT + application UPDATE for last_message_preview, which
    // all fire when a new proposal is sent) collapses into one refresh.
    const reloader = createDebouncedReload(() => { load(); }, 120);
    const scheduleReload = () => reloader.schedule();
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `${col}=eq.${user.id}` }, (payload) => {
        const row: any = payload.new || payload.old;
        if (!row) { scheduleReload(); return; }
        // INSERT → brand-new conversation that the worker/restaurant doesn't
        // have in the list yet (e.g. restaurant just sent the first proposal).
        // UPDATE with a changed last_message_preview / last_message_at means
        // the preview & ordering must refresh, not only the status field.
        const previewDidChange =
          payload.eventType === "UPDATE" &&
          previewChanged(payload.old as any, row);
        if (payload.eventType === "INSERT" || previewDidChange) {
          scheduleReload();
        }
        setThreads((prev) => {
          const prevStatus = prev.find((t) => t.id === row.id)?.status;
          if (prevStatus && row.status && prevStatus !== row.status && STATUS_LABELS[row.status]) {
            toast.message(`Stato aggiornato: ${STATUS_LABELS[row.status]}`);
          }
          return mergeThreadUpdate(prev as any, row) as typeof prev;
        });
      })
      // Message activity in conversations the current user participates in.
      // Bump unread + preview *immediately* (RLS already scopes the stream),
      // then a debounced reload reconciles any drift with the server.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg && user) {
          setThreads((prev) => applyIncomingMessage(prev as any, msg, user.id, selectedIdRef.current || null) as typeof prev);
        }
        scheduleReload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        // Mark-as-read events: if the recipient just read messages in a
        // thread I own, clear its unread badge locally.
        const m = payload.new as any;
        const old = payload.old as any;
        if (m?.read_at && !old?.read_at && user && m.sender_id === user.id) {
          setThreads((prev) => clearThreadUnread(prev as any, m.application_id) as typeof prev);
        }
        scheduleReload();
      })
      // A worker reply to a proposal updates this table; reflect the new
      // status immediately on the badge, then debounced reload reconciles.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proposal_responses" }, (payload) => {
        const r = payload.new as any;
        if (r) {
          setThreads((prev) => applyProposalResponse(prev as any, r) as typeof prev);
          if (r.status && STATUS_LABELS[r.status]) {
            toast.message(`Stato aggiornato: ${STATUS_LABELS[r.status]}`);
          }
        }
        scheduleReload();
      })
      .subscribe();
    return () => {
      reloader.cancel();
      supabase.removeChannel(ch);
    };
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
  const groups = groupThreadsByOther(threads);
  const visibleGroups = groups.filter((g) => {
    if (filter === "unread" && g.unread === 0) return false;
    if (statusFilter !== "all" && !g.items.some((t) => t.status === statusFilter)) return false;
    return true;
  });
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "");

  // Load last-selected announcement context for restaurant quick-reuse.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || role !== "restaurant") { setLastAnn(null); return; }
      const savedId = getLastAnnouncementId(user.id);
      if (!savedId) { setLastAnn(null); return; }
      const { data } = await supabase
        .from("announcements")
        .select("id, status, service_date, service_time, end_time, professional_profile")
        .eq("id", savedId)
        .eq("restaurant_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data || data.status !== "active") {
        setLastAnn(null);
        setLastAnnouncementId(user.id, null);
        return;
      }
      setLastAnn({
        id: data.id as string,
        role: formatRoleLabel(data.professional_profile) || "Annuncio",
        dateLabel: formatServiceDate(data.service_date),
        timeLabel: formatServiceTime(data.service_time, data.end_time),
      });
    })();
    return () => { cancelled = true; };
  }, [user, role]);

  return (
    <AppShell>
      <PageHeader title="Messaggi" subtitle="Le tue conversazioni" />
      <RequiredReviewsBanner />
      {role === "restaurant" && lastAnn && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-primary/5 px-4 py-3 text-sm">
          <div className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ultimo annuncio
            </span>
            <div className="truncate text-base font-semibold text-foreground">{lastAnn.role}</div>
            {(lastAnn.dateLabel || lastAnn.timeLabel) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {lastAnn.dateLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                    {lastAnn.dateLabel}
                  </span>
                )}
                {lastAnn.timeLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {lastAnn.timeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/announcements/$id"
              params={{ id: lastAnn.id }}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Apri annuncio
            </Link>
            <Link
              to="/workers"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Cerca lavoratori
            </Link>
          </div>
        </div>
      )}
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
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 pb-1">
              {/* Tutte */}
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition whitespace-nowrap ${filter === "all" ? "bg-primary text-primary-foreground border-primary shadow-neon" : "bg-card text-foreground border-border hover:bg-accent"}`}
              >
                Tutte
                <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold ${filter === "all" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  {threads.length}
                </span>
              </button>

              {/* Non lette */}
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition whitespace-nowrap ${filter === "unread" ? "bg-accent text-accent-foreground border-accent neon-glow-violet" : "bg-card text-foreground border-border hover:bg-accent"}`}
              >
                Non lette
                <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold ${filter === "unread" ? "bg-accent-foreground/20 text-accent-foreground" : "bg-accent/10 text-accent"}`}>
                  {totalUnread}
                </span>
              </button>

              {/* Tutti gli stati */}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition whitespace-nowrap ${statusFilter === "all" ? "bg-foreground text-background border-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" : "bg-card text-foreground border-border hover:bg-accent"}`}
              >
                Tutti gli stati
                <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold ${statusFilter === "all" ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"}`}>
                  {filter === "all" ? threads.length : totalUnread}
                </span>
              </button>

              {/* Status specifici */}
              {Object.keys(STATUS_LABELS).map((s) => {
                const count = statusCounts[s] ?? 0;
                if (count === 0) return null;
                const active = statusFilter === s;
                const baseCls = "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition whitespace-nowrap";
                const stateCls = active ? STATUS_BTN_ACTIVE[s] : STATUS_BTN_INACTIVE[s];
                const badgeCls = active
                  ? (s === "expired" ? "bg-foreground/10 text-foreground" : "bg-white/20 text-white")
                  : "bg-foreground/10 text-foreground";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`${baseCls} ${stateCls}`}
                  >
                    {STATUS_LABELS[s]}
                    <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold ${badgeCls}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {loading ? (
            <p className="text-muted-foreground">Caricamento…</p>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border bg-card p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" aria-hidden />
              </div>
              {role === "restaurant" ? (
                <>
                  <h3 className="text-base font-semibold text-foreground">Nessuna conversazione con un lavoratore</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Per iniziare un contatto, seleziona uno dei tuoi annunci attivi e scegli un candidato.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link to="/announcements" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                      Seleziona un annuncio
                    </Link>
                    <Link to="/ristoratore/annunci/nuovo" className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent">
                      Pubblica nuovo annuncio
                    </Link>
                  </div>
                </>
              ) : role === "worker" ? (
                <>
                  <h3 className="text-base font-semibold text-foreground">Nessuna conversazione con un ristorante</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Quando un ristoratore ti contatterà per un turno, la conversazione apparirà qui. Nel frattempo, mantieni aggiornati profilo e disponibilità per ricevere più proposte.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link to="/profile" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                      Aggiorna il profilo
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nessun messaggio ancora.
                </p>
              )}
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
                const hasPendingReview = g.items.some((t) => pendingReviewAppIds.has(t.id));
                const latestStatus = last?.status ?? null;
                const expanded = expandedGroups.has(g.id);
                const latestId = last?.id ?? null;
                // Reveal real names only when at least one item in the group
                // is already confirmed/assigned OR the parties have worked
                // together in the past. Otherwise keep the privacy-safe label.
                const revealItem = g.items.find(
                  (t) => isApplicationConfirmed(t.status) || t.hasWorkedTogether,
                );
                const groupDisplayName = revealItem ? revealItem.other.name : (role === "worker" ? PUBLIC_VENUE_NAME : g.name);
                return (
                  <div
                    key={g.id}
                    className={`rounded-2xl border transition ${g.unread > 0 ? "border-primary/50 bg-primary/5" : "bg-card"}`}
                  >
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={expanded}
                    className="group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent/60"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar userId={g.id} name={g.name} className="h-10 w-10" />
                      {g.unread > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold ring-2 ring-card flex items-center justify-center shadow-sm"
                          aria-label={`${g.unread} messaggi non letti`}
                        >
                          {g.unread > 9 ? "9+" : g.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`truncate ${g.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {groupDisplayName}
                          </div>
                          {g.unread > 0 && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-primary text-primary-foreground font-semibold"
                              aria-label={`${g.unread} non letti`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                              Nuovo messaggio
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">{formatWhen(g.lastAt)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className={`text-xs truncate ${g.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {last?.lastBody ?? "Nessun messaggio"}
                        </div>
                        <span className="shrink-0 inline-block text-[10px] rounded-full px-2 py-0.5 bg-muted text-foreground">
                          {g.items.length} {g.items.length === 1 ? "chat" : "chat"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {latestStatus && (
                          <span
                            className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ring-foreground/10 ${STATUS_CLS[latestStatus] || "bg-muted text-muted-foreground"}`}
                            title="Stato più recente"
                          >
                            Ultimo: {STATUS_LABELS[latestStatus] || latestStatus}
                          </span>
                        )}
                        {hasPendingReview && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-700 font-medium">
                            Recensione da inviare
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-muted-foreground" aria-hidden>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded && (
                    <ul className="border-t px-2 py-2 space-y-1" role="list">
                      {g.items.map((t) => {
                        const isLatest = t.id === latestId;
                        const isUnread = t.unread > 0;
                        const highlight = isUnread
                          ? "border-primary/60 bg-primary/10"
                          : isLatest
                            ? "border-primary/30 bg-primary/5"
                            : "border-transparent bg-transparent hover:bg-accent";
                        return (
                          <li key={t.id}>
                            <Link
                              to="/messages/$id"
                              params={{ id: t.id }}
                              className={`flex flex-col gap-1 rounded-xl border px-3 py-2 transition ${highlight}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className={`min-w-0 truncate text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                                  {[t.annRole || "Annuncio", fmtDate(t.annDate)].filter(Boolean).join(" — ")}
                                </div>
                                <div className="shrink-0 text-[10px] text-muted-foreground">{formatWhen(t.lastAt)}</div>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className={`min-w-0 truncate text-xs ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                                  {t.lastBody ?? "Nessun messaggio"}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  {isUnread && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                      <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                                      Nuovo
                                    </span>
                                  )}
                                  {pendingReviewAppIds.has(t.id) && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                      Recensione
                                    </span>
                                  )}
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLS[t.status] || "bg-muted text-muted-foreground"}`}>
                                    {STATUS_LABELS[t.status] || t.status}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
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
