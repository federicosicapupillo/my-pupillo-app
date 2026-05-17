import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, XCircle, AlertTriangle, Wifi, Star, MessageSquare, Clock, Eye, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { useRequiredReviews, type ActionShift } from "@/lib/required-reviews";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/shifts")({
  head: () => ({ meta: [{ title: "I miei turni — Pupillo" }] }),
  component: () => <RequireAuth><ShiftsPage /></RequireAuth>,
});

type Shift = {
  id: string;
  announcement_id: string | null;
  restaurant_id: string;
  worker_id: string;
  shift_date: string;
  hours: number;
  amount: number | null;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  created_at: string;
};
type Profile = { id: string; full_name: string | null; business_name: string | null; city: string | null };

type PendingApp = {
  id: string;
  announcement_id: string;
  worker_id: string;
  restaurant_id: string;
  status: "pending" | "interested" | "counter_offer";
  proposed_tariff: number | null;
  created_at: string;
  service_date: string | null;
  service_time: string | null;
};

const statusMeta: Record<Shift["status"], { label: string; color: string; icon: any }> = {
  scheduled: { label: "Programmato", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: CalendarClock },
  completed: { label: "Completato", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  no_show: { label: "No-show", color: "bg-red-500/10 text-red-700 border-red-500/30", icon: AlertTriangle },
  cancelled: { label: "Annullato", color: "bg-gray-500/10 text-gray-700 border-gray-500/30", icon: XCircle },
};

function ShiftsPage() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "assigned" | "past" | "to-review">(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "to-review" ? "to-review" : "all"
  );
  const initialFocusShift = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("shift") : null;
  const [live, setLive] = useState(false);
  const [reviewMap, setReviewMap] = useState<Record<string, number>>({});
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([]);
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);
  const [announcementsMap, setAnnouncementsMap] = useState<Record<string, any>>({});
  const [acceptedAppMap, setAcceptedAppMap] = useState<Record<string, { id: string; status: string }>>({});
  const [submittingReview, setSubmittingReview] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<Record<string, string>>({});
  const [viewReviewShiftId, setViewReviewShiftId] = useState<string | null>(null);
  const [viewReviewData, setViewReviewData] = useState<{ rating: number; comment: string | null } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [criteria, setCriteria] = useState({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 });
  const { items: requiredReviews, actionShifts, refresh: refreshRequiredReviews } = useRequiredReviews();
  const reqByShift = useMemo(() => {
    const m: Record<string, { status: string; due_date: string }> = {};
    requiredReviews.forEach((r) => { if (r.shift_id) m[r.shift_id] = { status: r.status, due_date: r.due_date }; });
    return m;
  }, [requiredReviews]);

  const load = async () => {
    if (!user || !role) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq(col, user.id)
      .order("shift_date", { ascending: false });
    if (error) { toast.error("Errore nel caricamento turni"); return; }
    const list = (data ?? []) as Shift[];
    setShifts(list);
    // Load announcement details and accepted applications for chat links
    const annIds = list.map(s => s.announcement_id).filter(Boolean) as string[];
    let annMap: Record<string, any> = {};
    let accAppMap: Record<string, { id: string; status: string }> = {};
    if (annIds.length) {
      const [{ data: annData }, { data: accApps }] = await Promise.all([
        supabase.from("announcements").select("id, service_date, service_time, end_time, location_address, tariff_amount, tariff_type, job_address, job_city, professional_profile, required_skills, dress_code_items, dress_code_notes, notes").in("id", annIds),
        (supabase as any).from("applications").select("id, announcement_id, status").in("announcement_id", annIds).in("status", ["accepted", "confirmed", "assigned"]).eq(col, user.id)
      ]);
      (annData ?? []).forEach((a: any) => { annMap[a.id] = a; });
      (accApps ?? []).forEach((a: any) => { accAppMap[a.announcement_id] = { id: a.id, status: a.status }; });
    }
    setAnnouncementsMap(annMap);
    setAcceptedAppMap(accAppMap);
    // For restaurants, also load pending/in-flight applications (candidature in attesa)
    let pending: PendingApp[] = [];
    if (role === "restaurant") {
      const { data: apps } = await (supabase as any)
        .from("applications")
        .select("id, announcement_id, worker_id, restaurant_id, status, proposed_tariff, created_at, announcements!inner(service_date, service_time)")
        .eq("restaurant_id", user.id)
        .in("status", ["pending", "interested", "counter_offer"])
        .order("created_at", { ascending: false });
      pending = (apps ?? []).map((a: any) => ({
        id: a.id,
        announcement_id: a.announcement_id,
        worker_id: a.worker_id,
        restaurant_id: a.restaurant_id,
        status: a.status,
        proposed_tariff: a.proposed_tariff,
        created_at: a.created_at,
        service_date: a.announcements?.service_date ?? null,
        service_time: a.announcements?.service_time ?? null,
      })) as PendingApp[];
      setPendingApps(pending);
    }
    const otherIds = list.map(s => role === "restaurant" ? s.worker_id : s.restaurant_id);
    const pendingWorkerIds = pending.map(p => p.worker_id);
    const ids = Array.from(new Set([...otherIds, ...pendingWorkerIds]));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,business_name,city").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    const shiftIds = list.map(s => s.id);
    if (shiftIds.length && user) {
      const { data: rs } = await supabase.from("reviews").select("shift_id, rating").eq("author_id", user.id).in("shift_id", shiftIds);
      const map: Record<string, number> = {};
      (rs ?? []).forEach((r: any) => { map[r.shift_id] = r.rating; });
      setReviewMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, role]);

  // Realtime
  useEffect(() => {
    if (!user || !role) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const channel = supabase
      .channel(`shifts-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `${col}=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setShifts(prev => [payload.new as Shift, ...prev]);
          toast.info("Nuovo turno aggiunto");
        } else if (payload.eventType === "UPDATE") {
          setShifts(prev => prev.map(s => s.id === (payload.new as Shift).id ? (payload.new as Shift) : s));
          toast.info(`Turno aggiornato: ${statusMeta[(payload.new as Shift).status].label}`);
        } else if (payload.eventType === "DELETE") {
          setShifts(prev => prev.filter(s => s.id !== (payload.old as Shift).id));
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, role]);

  const updateStatus = async (s: Shift, newStatus: Shift["status"]) => {
    const { error } = await supabase.from("shifts").update({ status: newStatus }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stato turno aggiornato");
  };

  const submitReview = async (s: Shift) => {
    if (!user) return;
    if (submittingReview) return;
    const targetId = role === "restaurant" ? s.worker_id : s.restaurant_id;
    const avg = (criteria.punctuality + criteria.professionalism + criteria.competence + criteria.reliability + criteria.teamwork) / 5;
    const submittedRating = Math.max(1, Math.min(5, Math.round(avg)));
    setSubmittingReview(s.id);
    setReviewError(prev => { const { [s.id]: _, ...rest } = prev; return rest; });
    const tId = toast.loading("Invio recensione in corso…");
    const logActivity = (action: "review_submit_success" | "review_submit_failed", metadata: Record<string, unknown>) => {
      // Fire-and-forget; never block the UX on logging
      supabase.from("activity_logs").insert({
        user_id: user.id,
        action,
        entity_type: "shift",
        entity_id: s.id,
        metadata: {
          shift_id: s.id,
          target_id: targetId,
          role,
          rating: submittedRating,
          ...metadata,
        },
      } as never).then(() => {}, () => {});
    };
    try {
      const { error } = await supabase.from("reviews").insert({
        author_id: user.id, target_id: targetId, shift_id: s.id,
        rating: submittedRating, comment: comment.trim() || null,
        punctuality: criteria.punctuality,
        professionalism: criteria.professionalism,
        competence: criteria.competence,
        reliability: criteria.reliability,
        teamwork: criteria.teamwork,
      } as any);
      if (error) {
        const msg = error.message || "Errore sconosciuto";
        toast.error(`Impossibile inviare la recensione: ${msg}`, { id: tId });
        setReviewError(prev => ({ ...prev, [s.id]: msg }));
        logActivity("review_submit_failed", { reason: "db_error", error_message: msg, error_code: (error as any)?.code ?? null });
        return;
      }
      toast.success("Recensione inviata", { id: tId });
      logActivity("review_submit_success", { has_comment: comment.trim().length > 0 });
      // Clear any prior error banner now that submission succeeded
      setReviewError(prev => { const { [s.id]: _, ...rest } = prev; return rest; });
      // Optimistic, immediate card update — no page reload needed
      setReviewMap(prev => ({ ...prev, [s.id]: submittedRating }));
      // Immediately refresh shift row from DB so any server-side updates (status, etc.) reflect
      supabase.from("shifts").select("*").eq("id", s.id).maybeSingle().then(({ data }) => {
        if (data) setShifts(prev => prev.map(x => x.id === s.id ? (data as Shift) : x));
      });
      // Refresh required-reviews list so "Da recensire" badge/counter updates instantly
      refreshRequiredReviews();
      setReviewOpen(null);
      setRating(5);
      setComment("");
    } catch (e: any) {
      const msg = e?.message ?? "Errore di rete";
      toast.error(`Errore di rete: ${msg}`, { id: tId });
      setReviewError(prev => ({ ...prev, [s.id]: msg }));
      logActivity("review_submit_failed", { reason: "network_error", error_message: msg });
    } finally {
      setSubmittingReview(null);
    }
  };

  const openViewReview = async (shiftId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("rating, comment")
      .eq("author_id", user.id)
      .eq("shift_id", shiftId)
      .maybeSingle();
    if (data) {
      setViewReviewData(data as any);
      setViewReviewShiftId(shiftId);
    } else {
      toast.error("Recensione non trovata");
    }
  };

  const closeViewReview = () => {
    setViewReviewShiftId(null);
    setViewReviewData(null);
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (filter === "upcoming") return [] as Shift[]; // pending applications rendered separately
    if (filter === "assigned") return shifts.filter(s => s.status === "scheduled" && s.shift_date >= today);
    if (filter === "past") return shifts.filter(s => s.status === "completed" || (s.status === "scheduled" && s.shift_date < today));
    if (filter === "to-review") return shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed");
    return shifts;
  }, [shifts, filter, reqByShift, today]);

  const counts = useMemo(() => {
    const assigned = shifts.filter(s => s.status === "scheduled" && s.shift_date >= today).length;
    const past = shifts.filter(s => s.status === "completed" || (s.status === "scheduled" && s.shift_date < today)).length;
    const toReview = shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed").length;
    const pending = role === "restaurant" ? pendingApps.length : 0;
    const all = shifts.length + pending;
    return { all, pending, assigned, past, toReview };
  }, [shifts, pendingApps, reqByShift, role, today]);

  const displayShifts = useMemo(() => {
    const list = [...filtered];
    if (filter === "assigned") {
      list.sort((a, b) => {
        const dateCmp = a.shift_date.localeCompare(b.shift_date);
        if (dateCmp !== 0) return dateCmp;
        const timeA = announcementsMap[a.announcement_id || ""]?.service_time || "00:00";
        const timeB = announcementsMap[b.announcement_id || ""]?.service_time || "00:00";
        return timeA.localeCompare(timeB);
      });
    }
    return list;
  }, [filtered, filter, announcementsMap]);

  const stats = useMemo(() => ({
    total: shifts.length,
    completed: shifts.filter(s => s.status === "completed").length,
    scheduled: shifts.filter(s => s.status === "scheduled").length,
  }), [shifts]);

  return (
    <AppShell>
      <PageHeader
        title="I miei turni"
        subtitle={role === "restaurant" ? "Gestisci i turni assegnati ai lavoratori." : "Visualizza i tuoi turni e aggiorna lo stato."}
        action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className={`h-3.5 w-3.5 ${live ? "text-emerald-500" : "text-muted-foreground"}`} />{live ? "In tempo reale" : "Connessione..."}</div>}
      />

      <div className="grid gap-3 grid-cols-3 mb-6">
        <Stat label="Totali" value={stats.total} />
        <Stat label="Programmati" value={stats.scheduled} />
        <Stat label="Completati" value={stats.completed} />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(["all", "upcoming", "assigned", "past", "to-review"] as const).map(f => {
          const label =
            f === "all" ? `Tutti (${counts.all})`
            : f === "upcoming" ? `In attesa (${counts.pending})`
            : f === "assigned" ? `Assegnati (${counts.assigned})`
            : f === "past" ? `Passati (${counts.past})`
            : `Da recensire (${counts.toReview})`;
          return (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {label}
            </Button>
          );
        })}
      </div>

      {role === "restaurant" && <RequiredReviewsBanner />}
      {role === "restaurant" && actionShifts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-sm">Azioni richieste ({actionShifts.length})</h3>
          </div>
          <div className="space-y-2">
            {actionShifts.map((a: ActionShift) => {
              const s = shifts.find(x => x.id === a.shift_id);
              const closeAndReview = async () => {
                if (s && s.status === "scheduled") {
                  await updateStatus(s, "completed");
                }
                setFilter("to-review");
                setReviewOpen(a.shift_id);
                setRating(5);
                setComment("");
                setCriteria({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 });
                setTimeout(() => {
                  document.getElementById(`shift-${a.shift_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 200);
              };
              return (
                <div key={a.shift_id} className="rounded-xl border bg-card p-3 flex items-center gap-3 flex-wrap">
                  <UserAvatar userId={a.worker_id} name={a.worker_name} className="h-9 w-9 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.worker_name ?? "Lavoratore"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.worker_role && <span className="capitalize">{a.worker_role} · </span>}
                      {new Date(a.service_date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      {a.service_time && ` · ${a.service_time.slice(0,5)}`}
                      {a.end_time && `–${a.end_time.slice(0,5)}`}
                    </div>
                  </div>
                  <Badge variant="outline" className={a.kind === "to_close" ? "bg-amber-500/15 text-amber-700 border-amber-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
                    {a.kind === "to_close" ? "Da chiudere" : "Recensione da inviare"}
                  </Badge>
                  <Button size="sm" className="gap-1" onClick={closeAndReview}>
                    <Star className="h-3.5 w-3.5" /> Chiudi e recensisci
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : (
        <>
          {role === "restaurant" && (filter === "all" || filter === "upcoming") && pendingApps.length > 0 && (
            <div className="space-y-3 mb-3">
              {pendingApps.map(a => {
                const w = profiles[a.worker_id];
                const wName = w?.full_name || "Lavoratore";
                const statusLabel =
                  a.status === "counter_offer" ? "Contro offerta" :
                  a.status === "interested" ? "Interessato" : "In attesa";
                return (
                  <div key={a.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{wName}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {a.service_date ? new Date(a.service_date).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" }) : "—"}
                          {a.service_time && <> · {a.service_time.slice(0,5)}</>}
                          {a.proposed_tariff != null && <> · €{Number(a.proposed_tariff).toFixed(2)}</>}
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/30">
                        <Clock className="h-3 w-3" />{statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="gap-1">
                        <Link to="/messages/$id" params={{ id: a.id }}><MessageSquare className="h-4 w-4" /> Vedi candidatura</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {displayShifts.length === 0 && !(role === "restaurant" && (filter === "all" || filter === "upcoming") && pendingApps.length > 0) ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            {filter === "assigned" ? "Non hai ancora turni assegnati." : "Nessun turno da mostrare."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayShifts.map(s => {
            const meta = statusMeta[s.status];
            const Icon = meta.icon;
            const otherId = role === "restaurant" ? s.worker_id : s.restaurant_id;
            const other = profiles[otherId];
            const otherName = role === "restaurant"
              ? (other?.full_name || "Lavoratore")
              : (other?.business_name || other?.full_name || "Locale");
            const dateObj = new Date(s.shift_date);
            const isPast = s.shift_date < new Date().toISOString().slice(0, 10);
            const canRestaurantAct = role === "restaurant" && s.status === "scheduled";
            const canWorkerComplete = role === "worker" && s.status === "scheduled" && isPast;

            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{otherName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {dateObj.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}{s.hours}h
                      {s.amount != null && <> · €{Number(s.amount).toFixed(2)}</>}
                      {other?.city && <> · {other.city}</>}
                    </div>
                  </div>
                  <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                    {filter === "assigned" && s.status === "scheduled" ? (acceptedAppMap[s.announcement_id || ""]?.status === "confirmed" ? "Confermato" : "Assegnato") : meta.label}
                  </Badge>
                </div>
                {(() => {
                  const ann = announcementsMap[s.announcement_id || ""];
                  return ann ? (
                    <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
                      {ann.professional_profile && <div className="capitalize">{ann.professional_profile}</div>}
                      {ann.service_time && (
                        <div>{ann.service_time.slice(0,5)}{ann.end_time && `–${ann.end_time.slice(0,5)}`}</div>
                      )}
                      {(ann.location_address || ann.job_address) && (
                        <div className="truncate">{ann.location_address || `${ann.job_address}${ann.job_city ? `, ${ann.job_city}` : ""}`}</div>
                      )}
                      {ann.tariff_amount != null && (
                        <div>€{Number(ann.tariff_amount).toFixed(2)} {ann.tariff_type === "hourly" ? "/ora" : "fisso"}</div>
                      )}
                    </div>
                  ) : null;
                })()}

                {(canRestaurantAct || canWorkerComplete) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canWorkerComplete && (
                      <Button size="sm" onClick={() => updateStatus(s, "completed")} className="gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Segna come completato
                      </Button>
                    )}
                    {canRestaurantAct && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(s, "completed")} className="gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Completato
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(s, "no_show")} className="gap-1">
                          <AlertTriangle className="h-4 w-4" /> No-show
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(s, "cancelled")} className="gap-1">
                          <XCircle className="h-4 w-4" /> Annulla
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {s.status === "completed" && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    {role === "restaurant" && reqByShift[s.id] && reqByShift[s.id].status !== "completed" && (() => {
                      const due = new Date(reqByShift[s.id].due_date).getTime();
                      const now = Date.now();
                      const overdue = reqByShift[s.id].status === "overdue" || due < now;
                      const soon = !overdue && (due - now) < 24 * 60 * 60 * 1000;
                      return (
                        <div className={`mb-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          overdue ? "bg-destructive/15 text-destructive" : soon ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {overdue ? "Scaduta" : soon ? "In scadenza" : `Entro il ${new Date(reqByShift[s.id].due_date).toLocaleDateString("it-IT")}`}
                        </div>
                      );
                    })()}
                    {reviewMap[s.id] != null ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-[0_0_12px_-2px_rgba(16,185,129,0.35)] dark:text-emerald-400 dark:bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Recensione inviata</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={`h-4 w-4 ${n <= reviewMap[s.id] ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                          ))}
                          <span className="ml-1 text-sm font-semibold text-foreground">{reviewMap[s.id]}/5</span>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1 ml-auto" onClick={() => openViewReview(s.id)}>
                          <Eye className="h-4 w-4" /> Vedi recensione
                        </Button>
                      </div>
                    ) : reviewOpen === s.id ? (
                      <div className="space-y-3">
                        {role === "restaurant" ? (
                          <div className="space-y-2">
                            {([
                              ["punctuality", "Puntualità"],
                              ["professionalism", "Professionalità"],
                              ["competence", "Competenza nel ruolo"],
                              ["reliability", "Affidabilità"],
                              ["teamwork", "Collaborazione con il team"],
                            ] as const).map(([key, label]) => (
                              <div key={key} className="flex items-center justify-between gap-3">
                                <span className="text-sm">{label}</span>
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map(n => (
                                    <button key={n} type="button" onClick={() => setCriteria(c => ({ ...c, [key]: n }))} className="p-0.5 disabled:opacity-50" disabled={submittingReview === s.id}>
                                      <Star className={`h-5 w-5 transition ${n <= (criteria as any)[key] ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(n => (
                              <button key={n} type="button" onClick={() => setRating(n)} className="p-1 disabled:opacity-50" disabled={submittingReview === s.id}>
                                <Star className={`h-6 w-6 transition ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                        )}
                        <Textarea placeholder="Commento (opzionale)" value={comment} onChange={e => setComment(e.target.value)} rows={2} disabled={submittingReview === s.id} />
                        {reviewError[s.id] && (
                          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="font-medium">Invio non riuscito</div>
                              <div className="opacity-80">{reviewError[s.id]}</div>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => submitReview(s)} disabled={submittingReview === s.id} className="gap-1.5">
                            {submittingReview === s.id
                              ? (<><Loader2 className="h-4 w-4 animate-spin" /> Invio…</>)
                              : reviewError[s.id]
                                ? "Riprova invio"
                                : "Invia recensione"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReviewOpen(null); setReviewError(prev => { const { [s.id]: _, ...rest } = prev; return rest; }); }} disabled={submittingReview === s.id}>Annulla</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button size="sm" className="gap-1.5" onClick={() => { setReviewOpen(s.id); setRating(5); setComment(""); setCriteria({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 }); setReviewError(prev => { const { [s.id]: _, ...rest } = prev; return rest; }); }} disabled={submittingReview === s.id}>
                          <Star className="h-4 w-4" /> Lascia recensione
                        </Button>
                        {role === "restaurant" && reqByShift[s.id] && reqByShift[s.id].status !== "completed" && (
                          <span className="text-xs text-muted-foreground">Obbligatoria per contattare nuovi lavoratori</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      <Dialog open={!!viewReviewShiftId} onOpenChange={(open) => !open && closeViewReview()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>La tua recensione</DialogTitle>
          </DialogHeader>
          {viewReviewData && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`h-6 w-6 ${n <= viewReviewData.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              {viewReviewData.comment ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewReviewData.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nessun commento</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
