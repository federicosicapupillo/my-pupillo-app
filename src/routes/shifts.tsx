import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { getShiftEndDate } from "@/lib/announcement-time";
import { UserAvatar } from "@/components/UserAvatar";
import { ReviewLabelsPicker } from "@/components/ReviewLabelsPicker";
import { WouldRehirePicker, type WouldRehireValue } from "@/components/WouldRehirePicker";
import { SaveToFavoritesPrompt } from "@/components/SaveToFavoritesPrompt";
import { ReportDelayDialog, CancelPresenceDialog, type IncidentTarget } from "@/components/WorkerIncidentDialogs";
import { formatShiftLocation, debugLocationFormat } from "@/lib/format-location";

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

// Tolleranza minima prima che il ristoratore possa segnalare "No show".
// Regola Pupillo: il No show diventa disponibile solo 15 minuti DOPO
// l'orario di inizio turno reale (shift_date + service_time del turno o
// dell'annuncio collegato). Non si usa data creazione/pubblicazione
// annuncio, candidatura, fine turno, né expires_at.
const NO_SHOW_TOLERANCE_MINUTES = 15;

function computeShiftStartDate(shiftDate: string | null | undefined, serviceTime: string | null | undefined): Date | null {
  if (!shiftDate) return null;
  const time = (serviceTime ?? "").trim();
  const hhmm = /^(\d{2}):(\d{2})/.exec(time);
  const h = hhmm ? Number(hhmm[1]) : 0;
  const m = hhmm ? Number(hhmm[2]) : 0;
  const d = new Date(`${shiftDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTimeHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type NoShowAvailability = {
  canMark: boolean;
  availableFrom: Date | null;
  minutesAfterStart: number | null;
  reasonIfDisabled: string | null;
  disabledMessage: string | null;
};

function getNoShowAvailability(shift: Shift, serviceTime: string | null | undefined): NoShowAvailability {
  // Stati incompatibili: solo "scheduled" può diventare no_show
  if (shift.status !== "scheduled") {
    return {
      canMark: false,
      availableFrom: null,
      minutesAfterStart: null,
      reasonIfDisabled: `turno in stato ${shift.status}, no_show non applicabile`,
      disabledMessage: "Il No show può essere segnalato solo su turni confermati.",
    };
  }
  const start = computeShiftStartDate(shift.shift_date, serviceTime);
  if (!start) {
    return {
      canMark: false,
      availableFrom: null,
      minutesAfterStart: null,
      reasonIfDisabled: "orario inizio turno mancante",
      disabledMessage: "Orario di inizio turno non disponibile.",
    };
  }
  const availableFrom = new Date(start.getTime() + NO_SHOW_TOLERANCE_MINUTES * 60_000);
  const now = new Date();
  const minutesAfterStart = Math.floor((now.getTime() - start.getTime()) / 60_000);
  if (now.getTime() < availableFrom.getTime()) {
    return {
      canMark: false,
      availableFrom,
      minutesAfterStart,
      reasonIfDisabled: "tolleranza 15 minuti non ancora trascorsa",
      disabledMessage: `Potrai segnalare No show dalle ${formatTimeHHMM(availableFrom)}.`,
    };
  }
  return {
    canMark: true,
    availableFrom,
    minutesAfterStart,
    reasonIfDisabled: null,
    disabledMessage: null,
  };
}

function ShiftsPage() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"assigned" | "upcoming" | "completed" | "to-review" | "no_show" | "past">(() => {
    if (typeof window === "undefined") return "assigned";
    const raw = (new URLSearchParams(window.location.search).get("tab") || "").toLowerCase();
    const map: Record<string, "assigned" | "upcoming" | "completed" | "to-review" | "no_show" | "past"> = {
      "assigned": "assigned", "assegnati": "assigned",
      "to-review": "to-review", "da-recensire": "to-review", "da_recensire": "to-review",
      "completed": "completed", "conclusi": "completed", "completati": "completed", "concluso": "completed",
      "no_show": "no_show", "noshow": "no_show", "no-show": "no_show",
      "reports": "no_show", "segnalazioni": "no_show", "segnalazione": "no_show",
      "past": "past", "archiviati": "past",
      "upcoming": "upcoming",
    };
    return map[raw] ?? "assigned";
  });
  const initialFocusShift = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("shift") : null;
  // True once we've applied the worker auto-default-tab priority logic.
  // Prevents resetting the tab after the user manually switches it.
  const defaultTabAppliedRef = useRef<boolean>(
    typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("tab")
  );
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [focusedShift, setFocusedShift] = useState<string | null>(initialFocusShift);
  // After the focused shift card mounts, scroll it into view and fade the
  // highlight after a few seconds so the page returns to its normal state.
  useEffect(() => {
    if (!focusedShift) return;
    const t = setTimeout(() => {
      if (focusRef.current) {
        focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
    const fade = setTimeout(() => setFocusedShift(null), 4000);
    return () => { clearTimeout(t); clearTimeout(fade); };
  }, [focusedShift, shifts.length]);
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
  const [positiveLabels, setPositiveLabels] = useState<string[]>([]);
  const [negativeLabels, setNegativeLabels] = useState<string[]>([]);
  const [wouldRehire, setWouldRehire] = useState<WouldRehireValue>(null);
  const [reviewDialog, setReviewDialog] = useState<ActionShift | null>(null);
  const [dialogCriteria, setDialogCriteria] = useState({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 });
  const [dialogComment, setDialogComment] = useState("");
  const [dialogPositive, setDialogPositive] = useState<string[]>([]);
  const [dialogNegative, setDialogNegative] = useState<string[]>([]);
  const [dialogWouldRehire, setDialogWouldRehire] = useState<WouldRehireValue>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [noShowDialog, setNoShowDialog] = useState<Shift | null>(null);
  const [noShowNotes, setNoShowNotes] = useState("");
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  const [notEndedDialog, setNotEndedDialog] = useState<Shift | null>(null);
  const [reviewNotAvailableOpen, setReviewNotAvailableOpen] = useState(false);
  // Worker-side popup (modale) per recensire il ristoratore. Vedi MODIFICA 8.
  const [workerReviewDialog, setWorkerReviewDialog] = useState<Shift | null>(null);
  const [workerDialogRating, setWorkerDialogRating] = useState<number>(0);
  const [workerDialogComment, setWorkerDialogComment] = useState("");
  const [workerDialogTags, setWorkerDialogTags] = useState<string[]>([]);
  const [workerDialogSubmitting, setWorkerDialogSubmitting] = useState(false);
  const [workerDialogError, setWorkerDialogError] = useState<string | null>(null);
  const WORKER_REVIEW_TAGS = [
    "Comunicazione chiara",
    "Ambiente positivo",
    "Pagamento corretto",
    "Organizzazione buona",
    "Istruzioni chiare",
    "Rispetto degli accordi",
    "Da migliorare organizzazione",
    "Informazioni poco chiare",
  ] as const;
  const openWorkerReviewDialog = (s: Shift) => {
    if (isShiftNotEnded(s)) { setReviewNotAvailableOpen(true); return; }
    setWorkerDialogRating(0);
    setWorkerDialogComment("");
    setWorkerDialogTags([]);
    setWorkerDialogError(null);
    setWorkerReviewDialog(s);
    try { console.log("[PUPILLO_WORKER_REVIEW_MODAL_OPEN]", { shift_id: s.id, worker_id: user?.id ?? null }); } catch { /* ignore */ }
  };
  const submitWorkerReviewDialog = async () => {
    const s = workerReviewDialog;
    if (!s || !user) return;
    if (workerDialogRating < 1) { setWorkerDialogError("Seleziona una valutazione."); return; }
    setWorkerDialogSubmitting(true);
    setWorkerDialogError(null);
    const tId = toast.loading("Invio recensione in corso…");
    try {
      const rating = Math.max(1, Math.min(5, Math.round(workerDialogRating)));
      const payload: any = {
        author_id: user.id,
        target_id: s.restaurant_id,
        shift_id: s.id,
        announcement_id: s.announcement_id,
        application_id: s.announcement_id ? acceptedAppMap[s.announcement_id]?.id ?? null : null,
        rating,
        comment: (workerDialogComment || "").trim().slice(0, 500) || null,
        communication: rating,
        professionalism: rating,
        reliability: rating,
        staff_collaboration: rating,
        positive_tags: workerDialogTags,
      };
      try { console.log("[PUPILLO_WORKER_REVIEW_SUBMIT_WITH_OPTIONAL_COMMENT]", { shift_id: s.id, has_comment: (workerDialogComment || "").trim().length > 0, rating, tags: workerDialogTags }); } catch { /* ignore */ }
      const { error } = await supabase.from("reviews").insert(payload);
      if (error) {
        const isDup = (error as any)?.code === "23505" || /duplicate|unique/i.test(error.message || "");
        const msg = isDup ? "Hai già lasciato una recensione per questo turno." : (error.message || "Errore sconosciuto");
        toast.error(`Impossibile inviare la recensione: ${msg}`, { id: tId });
        setWorkerDialogError(msg);
        try { console.warn("[PUPILLO_WORKER_REVIEW_SUBMIT_ERROR]", { shift_id: s.id, error: msg }); } catch { /* ignore */ }
        return;
      }
      toast.success("Recensione inviata. Turno concluso.", { id: tId });
      try {
        console.log("[PUPILLO_WORKER_REVIEW_SUBMIT_SUCCESS]", { shift_id: s.id, rating });
        console.log("[PUPILLO_WORKER_SHIFT_MOVED_TO_CONCLUDED_AFTER_REVIEW]", { shift_id: s.id });
      } catch { /* ignore */ }
      setReviewMap(prev => ({ ...prev, [s.id]: rating }));
      refreshRequiredReviews();
      setWorkerReviewDialog(null);
      setFilter("completed");
    } catch (e: any) {
      const msg = e?.message ?? "Errore di rete";
      toast.error(`Errore di rete: ${msg}`, { id: tId });
      setWorkerDialogError(msg);
      try { console.warn("[PUPILLO_WORKER_REVIEW_SUBMIT_ERROR]", { shift_id: s.id, error: msg }); } catch { /* ignore */ }
    } finally {
      setWorkerDialogSubmitting(false);
    }
  };
  // Criteri recensione lavoratore → ristoratore (form inline)
  const [workerCriteria, setWorkerCriteria] = useState({
    overall: 5,
    communication: 5,
    clarity: 5,
    payment_fairness: 5,
    work_environment: 5,
  });
  const [cancelDialog, setCancelDialog] = useState<Shift | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [delayTarget, setDelayTarget] = useState<IncidentTarget | null>(null);
  const [workerCancelTarget, setWorkerCancelTarget] = useState<IncidentTarget | null>(null);
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

  /** Returns true when the scheduled end of the shift is still in the future. */
  const isShiftNotEnded = (s: Shift): boolean => {
    const ann = announcementsMap[s.announcement_id || ""];
    const end = getShiftEndDate({
      service_date: ann?.service_date ?? s.shift_date,
      service_time: ann?.service_time ?? null,
      end_time: ann?.end_time ?? null,
      shift_duration_hours: ann?.shift_duration_hours ?? null,
      duration_hours: ann?.duration_hours ?? s.hours ?? null,
    });
    if (!end) return false;
    return Date.now() < end.getTime();
  };

  const handleCloseShift = (s: Shift) => {
    if (isShiftNotEnded(s)) {
      setNotEndedDialog(s);
      return;
    }
    updateStatus(s, "completed");
  };

  const openCancelDialog = (s: Shift) => {
    setCancelReason("");
    setCancelError(null);
    setCancelDialog(s);
  };

  const confirmCancel = async () => {
    const s = cancelDialog;
    if (!s || !user) return;
    const reason = cancelReason.trim();
    if (reason.length < 10) {
      setCancelError("Inserisci una motivazione di almeno 10 caratteri.");
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const { error } = await supabase.from("shifts").update({ status: "cancelled" }).eq("id", s.id);
      if (error) {
        toast.error(error.message);
        setCancelError(error.message);
        setCancelSubmitting(false);
        return;
      }
      // Notify worker (worker-side label: "Servizio annullato")
      const appId = s.announcement_id ? acceptedAppMap[s.announcement_id]?.id ?? null : null;
      const notifBody = `Il servizio è stato annullato dal ristoratore.\n\nMotivazione:\n${reason}`;
      supabase.from("notifications").insert({
        user_id: s.worker_id,
        title: "Servizio annullato",
        body: notifBody,
        link: appId ? `/messages/${appId}` : `/shifts?shift=${s.id}`,
        metadata: { shift_id: s.id, reason, kind: "shift_cancelled" },
      } as never).then(() => {}, () => {});
      // System message in chat if a conversation exists
      if (appId) {
        const chatBody = `Il ristoratore ha annullato il servizio.\n\nMotivazione:\n${reason}`;
        supabase.from("messages").insert({
          application_id: appId,
          sender_id: user.id,
          receiver_id: s.worker_id,
          body: chatBody,
          message_type: "system",
          template_id: "shift_cancelled",
        } as never).then(() => {}, () => {});
      }
      supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "shift_cancelled_by_restaurant",
        entity_type: "shift",
        entity_id: s.id,
        metadata: { shift_id: s.id, worker_id: s.worker_id, reason },
      } as never).then(() => {}, () => {});
      toast.success("Servizio annullato. Il lavoratore è stato avvisato.");
      setShifts(prev => prev.map(x => x.id === s.id ? { ...x, status: "cancelled" as const } : x));
      setCancelDialog(null);
      setCancelReason("");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const submitReview = async (s: Shift) => {
    if (!user) return;
    if (submittingReview) return;
    const targetId = role === "restaurant" ? s.worker_id : s.restaurant_id;
    // Guard: il lavoratore può recensire SOLO dopo la fine effettiva del turno.
    if (role === "worker" && isShiftNotEnded(s)) {
      setReviewNotAvailableOpen(true);
      return;
    }
    if (role === "restaurant" && !wouldRehire) {
      setReviewError(prev => ({ ...prev, [s.id]: "Indica se richiameresti questo lavoratore." }));
      toast.error("Indica se richiameresti questo lavoratore.");
      return;
    }
    const submittedRating =
      role === "worker"
        ? Math.max(1, Math.min(5, Math.round(Number(workerCriteria.overall) || 0)))
        : Math.max(1, Math.min(5, Math.round(
            (criteria.punctuality + criteria.professionalism + criteria.competence + criteria.reliability + criteria.teamwork) / 5,
          )));
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
      const payload: any = role === "worker"
        ? {
            // Worker → Restaurant. Mappiamo i criteri ai campi esistenti:
            //   communication       → communication
            //   chiarezza istruzioni → professionalism
            //   puntualità pagamenti → reliability
            //   ambiente di lavoro  → staff_collaboration
            author_id: user.id,
            target_id: targetId,
            shift_id: s.id,
            announcement_id: s.announcement_id,
            application_id: s.announcement_id ? acceptedAppMap[s.announcement_id]?.id ?? null : null,
            rating: submittedRating,
            comment: (comment || "").trim().slice(0, 500) || null,
            communication: workerCriteria.communication,
            professionalism: workerCriteria.clarity,
            reliability: workerCriteria.payment_fairness,
            staff_collaboration: workerCriteria.work_environment,
          }
        : {
            author_id: user.id,
            target_id: targetId,
            shift_id: s.id,
            rating: submittedRating,
            comment: comment.trim() || null,
            punctuality: criteria.punctuality,
            professionalism: criteria.professionalism,
            competence: criteria.competence,
            reliability: criteria.reliability,
            teamwork: criteria.teamwork,
            positive_tags: positiveLabels,
            negative_tags: negativeLabels,
            would_rehire: wouldRehire,
          };
      const { error } = await supabase.from("reviews").insert(payload);
      if (error) {
        const isDup = (error as any)?.code === "23505" || /duplicate|unique/i.test(error.message || "");
        const msg = isDup
          ? "Hai già lasciato una recensione per questo turno."
          : (error.message || "Errore sconosciuto");
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
      setPositiveLabels([]);
      setNegativeLabels([]);
      setWouldRehire(null);
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

  const submitDialogReview = async () => {
    if (!user || !reviewDialog) return;
    const a = reviewDialog;
    if (!a.worker_id || !a.shift_id) {
      setDialogError("Turno o lavoratore non trovato.");
      return;
    }
    if (!dialogWouldRehire) {
      setDialogError("Indica se richiameresti questo lavoratore.");
      return;
    }
    const c = dialogCriteria;
    const avg = (c.punctuality + c.professionalism + c.competence + c.reliability + c.teamwork) / 5;
    const submittedRating = Math.max(1, Math.min(5, Math.round(avg)));
    if (!submittedRating || submittedRating < 1) {
      setDialogError("Seleziona una valutazione");
      return;
    }
    setDialogSubmitting(true);
    setDialogError(null);
    const tId = toast.loading("Invio recensione in corso…");
    try {
      // Guard: il turno può essere chiuso solo dopo la fine effettiva.
      const endRef = getShiftEndDate({
        service_date: a.service_date,
        service_time: a.service_time ?? null,
        end_time: a.end_time ?? null,
      });
      if (endRef && Date.now() < endRef.getTime()) {
        const hhmm = a.end_time ? a.end_time.slice(0, 5) : null;
        const msg = hhmm
          ? `Il turno non è ancora concluso. Potrai chiuderlo dopo le ${hhmm}.`
          : "Il turno non è ancora concluso. Potrai chiuderlo dopo l'orario di fine.";
        toast.error(msg, { id: tId });
        setDialogError(msg);
        setDialogSubmitting(false);
        return;
      }
      // 1. Ensure shift is marked completed
      const localShift = shifts.find(x => x.id === a.shift_id);
      if (localShift && localShift.status === "scheduled") {
        const { error: upErr } = await supabase.from("shifts").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", a.shift_id);
        if (upErr) {
          toast.error(`Errore durante il salvataggio della recensione. Riprova.`, { id: tId });
          setDialogError(upErr.message);
          setDialogSubmitting(false);
          return;
        }
      }
      // 2. Insert review
      const { error } = await supabase.from("reviews").insert({
        author_id: user.id,
        target_id: a.worker_id,
        shift_id: a.shift_id,
        announcement_id: a.announcement_id,
        application_id: a.application_id,
        rating: submittedRating,
        comment: dialogComment.trim() || null,
        punctuality: c.punctuality,
        professionalism: c.professionalism,
        competence: c.competence,
        reliability: c.reliability,
        teamwork: c.teamwork,
        positive_tags: dialogPositive,
        negative_tags: dialogNegative,
        would_rehire: dialogWouldRehire,
      } as any);
      if (error) {
        toast.error(`Errore durante il salvataggio della recensione. Riprova.`, { id: tId });
        setDialogError(error.message);
        setDialogSubmitting(false);
        return;
      }
      // 3. La notifica al lavoratore viene creata UNA SOLA VOLTA dal trigger DB
      // `handle_new_review` (anti-duplicato lato server).
      toast.success("Recensione inviata", { id: tId });
      // 4. Optimistic local updates
      setReviewMap(prev => ({ ...prev, [a.shift_id]: submittedRating }));
      setShifts(prev => prev.map(x => x.id === a.shift_id ? { ...x, status: "completed" as const } : x));
      refreshRequiredReviews();
      setReviewDialog(null);
    } catch (e: any) {
      toast.error(`Errore durante il salvataggio della recensione. Riprova.`, { id: tId });
      setDialogError(e?.message ?? "Errore di rete");
    } finally {
      setDialogSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (filter === "upcoming") return [] as Shift[]; // pending applications rendered separately
    if (filter === "assigned") return shifts.filter(s => s.status === "scheduled" && s.shift_date >= today);
    if (filter === "completed") return shifts.filter(s => s.status === "completed");
    if (filter === "past") return shifts.filter(s => (s.status === "scheduled" && s.shift_date < today) || s.status === "cancelled");
    if (filter === "to-review") {
      if (role === "worker") {
        return shifts.filter(s => s.status === "completed" && !reviewMap[s.id]);
      }
      return shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed");
    }
    if (filter === "no_show") return shifts.filter(s => s.status === "no_show");
    return shifts;
  }, [shifts, filter, reqByShift, today, role, reviewMap]);

  const counts = useMemo(() => {
    const assigned = shifts.filter(s => s.status === "scheduled" && s.shift_date >= today).length;
    const past = shifts.filter(s => (s.status === "scheduled" && s.shift_date < today) || s.status === "cancelled").length;
    const completed = shifts.filter(s => s.status === "completed").length;
    const toReview = role === "worker"
      ? shifts.filter(s => s.status === "completed" && !reviewMap[s.id]).length
      : shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed").length;
    const noShow = shifts.filter(s => s.status === "no_show").length;
    const pending = role === "restaurant" ? pendingApps.length : 0;
    return { pending, assigned, completed, past, toReview, noShow };
  }, [shifts, pendingApps, reqByShift, role, today, reviewMap]);

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

  // Worker-side: choose the default tab by priority once shifts are loaded.
  // Priority: no_show/segnalazioni → assigned → to-review → completed.
  // Skipped when a URL ?tab=... was provided (e.g. notification redirect).
  useEffect(() => {
    if (loading) return;
    if (role !== "worker") return;
    if (defaultTabAppliedRef.current) return;
    const next: typeof filter =
      counts.noShow > 0 ? "no_show"
      : counts.assigned > 0 ? "assigned"
      : counts.toReview > 0 ? "to-review"
      : counts.completed > 0 ? "completed"
      : "assigned";
    try {
      const ctx = {
        worker_id: user?.id ?? null,
        count_segnalazioni: counts.noShow,
        count_no_show: counts.noShow,
        count_assegnati: counts.assigned,
        count_da_recensire: counts.toReview,
        count_conclusi: counts.completed,
        selected_default_tab: next,
      };
      console.log("[PUPILLO_WORKER_MY_SHIFTS_DEFAULT_TAB_CHECK]", ctx);
      console.log("[PUPILLO_WORKER_MY_SHIFTS_PRIORITY_COUNTS]", ctx);
      console.log("[PUPILLO_WORKER_MY_SHIFTS_TAB_PRIORITY_APPLIED]", ctx);
      if (next === "no_show") console.log("[PUPILLO_WORKER_MY_SHIFTS_OPEN_SEGNAZIONI]", ctx);
      else if (next === "assigned") console.log("[PUPILLO_WORKER_MY_SHIFTS_OPEN_ASSIGNED]", ctx);
      else if (next === "to-review") console.log("[PUPILLO_WORKER_MY_SHIFTS_OPEN_TO_REVIEW]", ctx);
      else if (next === "completed") console.log("[PUPILLO_WORKER_MY_SHIFTS_OPEN_CONCLUDED]", ctx);
    } catch { /* ignore */ }
    defaultTabAppliedRef.current = true;
    setFilter(next);
  }, [loading, role, counts, user?.id]);

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
        {((role === "worker"
          ? ["no_show", "assigned", "to-review", "completed"]
          : ["assigned", "upcoming", "completed", "to-review", "no_show", "past"]) as Array<typeof filter>).map(f => {
          const label =
            f === "assigned" ? `Assegnati (${counts.assigned})`
            : f === "upcoming" ? `In attesa (${counts.pending})`
            : f === "completed" ? `Conclusi (${counts.completed})`
            : f === "past" ? `Archiviati / Passati (${counts.past})`
            : f === "no_show" ? `No show / Segnalazioni (${counts.noShow})`
            : `Da recensire (${counts.toReview})`;
          return (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => { defaultTabAppliedRef.current = true; setFilter(f); }}>
              {label}
            </Button>
          );
        })}
      </div>

      {role === "worker" && !loading && initialFocusShift && !shifts.some(s => s.id === initialFocusShift) && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 text-amber-900 dark:text-amber-200">
            Il turno collegato alla notifica non è più disponibile o non può essere visualizzato.
          </div>
        </div>
      )}

      {role === "restaurant" && <RequiredReviewsBanner />}
      {role === "restaurant" && actionShifts.length > 0 && (
        <div className={`mb-4 rounded-2xl border p-4 ${actionShifts.some((a) => a.is_overdue) ? "border-destructive/30 bg-destructive/5" : "border-amber-400/40 bg-amber-50 dark:bg-amber-500/10"}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-4 w-4 ${actionShifts.some((a) => a.is_overdue) ? "text-destructive" : "text-amber-600"}`} />
            <h3 className="font-semibold text-sm">Recensioni da completare ({actionShifts.length})</h3>
          </div>
          <div className="space-y-2">
            {actionShifts.map((a: ActionShift) => {
              const s = shifts.find(x => x.id === a.shift_id);
              const overdue = a.is_overdue;
              const ms = a.ms_until_deadline ?? 0;
              const absH = Math.max(0, Math.floor(Math.abs(ms) / 3_600_000));
              const days = Math.floor(absH / 24);
              const hours = absH % 24;
              const remainingLabel = overdue
                ? `Scaduta da ${days > 0 ? `${days}g` : ""}${days > 0 && hours > 0 ? " " : ""}${days === 0 || hours > 0 ? `${hours}h` : ""}`.trim() || "Scaduta"
                : `${days > 0 ? `${days}g` : ""}${days > 0 && hours > 0 ? " " : ""}${days === 0 || hours > 0 ? `${hours}h` : ""}`.trim() + " rimanenti";
              const closeAndReview = async () => {
                if (!a.worker_id) {
                  toast.error("Impossibile aprire la recensione. Turno o lavoratore non trovato.");
                  return;
                }
                setDialogCriteria({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 });
                setDialogComment("");
                setDialogError(null);
                setDialogPositive([]);
                setDialogNegative([]);
                setDialogWouldRehire(null);
                setReviewDialog(a);
              };
              return (
                <div key={a.shift_id} className={`rounded-xl border p-3 flex items-center gap-3 flex-wrap ${overdue ? "border-destructive/40 bg-card" : "bg-card"}`}>
                  <UserAvatar userId={a.worker_id} name={a.worker_name} className="h-9 w-9 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.worker_name ?? "Lavoratore"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.worker_role && <span className="capitalize">{a.worker_role} · </span>}
                      {new Date(a.service_date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      {a.service_time && ` · ${a.service_time.slice(0,5)}`}
                      {a.end_time && `–${a.end_time.slice(0,5)}`}
                    </div>
                    {a.review_deadline && (
                      <div className={`text-[11px] mt-0.5 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {overdue ? "Scadenza superata · " : "Scadenza recensione: "}
                        {new Date(a.review_deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                        {" "}{new Date(a.review_deadline).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={overdue ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"}>
                    {overdue ? `Scaduta · ${remainingLabel.replace("Scaduta da ", "")}` : remainingLabel}
                  </Badge>
                  <Button size="sm" className="gap-1" variant={overdue ? "destructive" : "default"} onClick={closeAndReview}>
                    <Star className="h-3.5 w-3.5" /> {overdue ? "Recensisci ora" : "Chiudi e recensisci"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : (
        <>
          {role === "restaurant" && filter === "upcoming" && pendingApps.length > 0 && (
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
          {displayShifts.length === 0 && !(role === "restaurant" && filter === "upcoming" && pendingApps.length > 0) ? (
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
            const canWorkerSignal = role === "worker" && s.status === "scheduled" && isShiftNotEnded(s);
            const ann0 = announcementsMap[s.announcement_id || ""];
            const incidentTarget: IncidentTarget | null = canWorkerSignal && user ? {
              shiftId: s.id,
              workerId: user.id,
              restaurantId: s.restaurant_id,
              applicationId: s.announcement_id ? acceptedAppMap[s.announcement_id]?.id ?? null : null,
              announcementId: s.announcement_id,
              context: {
                role: ann0?.professional_profile ?? null,
                date: ann0?.service_date ?? s.shift_date,
                time: ann0?.service_time ?? null,
              },
            } : null;

            return (
              <div
                key={s.id}
                ref={focusedShift === s.id ? focusRef : undefined}
                className={`rounded-2xl border bg-card p-4 sm:p-5 transition ${
                  focusedShift === s.id && s.status === "no_show"
                    ? "ring-2 ring-destructive border-destructive/60 shadow-lg bg-destructive/5 animate-pulse"
                    : focusedShift === s.id
                      ? "ring-2 ring-primary border-primary/50 shadow-lg"
                      : ""
                }`}
              >
                {s.status === "no_show" && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        <Badge variant="outline" className="border-destructive/40 bg-destructive/15 text-destructive text-[10px] uppercase tracking-wide">No show</Badge>
                        Questo turno risulta segnalato come no show.
                      </div>
                      <div className="text-xs opacity-80 mt-0.5">
                        Verifica i dettagli e contatta il ristoratore se non sei d'accordo.
                      </div>
                    </div>
                  </div>
                )}
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
                {role === "restaurant" && s.worker_id && s.status !== "cancelled" && profiles[s.worker_id] && (
                  <div className="mt-2 flex flex-col rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Turno assegnato
                    </div>
                    <div className="text-xs text-emerald-700/80">
                      Assegnato a: {profiles[s.worker_id]?.full_name || "Lavoratore"}
                    </div>
                  </div>
                )}
                {(() => {
                  const ann = announcementsMap[s.announcement_id || ""];
                  return ann ? (
                    <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
                      {ann.professional_profile && <div className="capitalize">{ann.professional_profile}</div>}
                      {ann.service_time && (
                        <div>{ann.service_time.slice(0,5)}{ann.end_time && `–${ann.end_time.slice(0,5)}`}</div>
                      )}
                      {(ann.location_address || ann.job_address) && (
                        <div className="truncate">
                          {debugLocationFormat(
                            s.id,
                            ann.location_address ||
                              `${ann.job_address}${ann.job_city ? `, ${ann.job_city}` : ""}`,
                          )}
                        </div>
                      )}
                      {ann.tariff_amount != null && (
                        <div>€{Number(ann.tariff_amount).toFixed(2)} {ann.tariff_type === "hourly" ? "/ora" : "fisso"}</div>
                      )}
                    </div>
                  ) : null;
                })()}

                {(canRestaurantAct || canWorkerComplete || acceptedAppMap[s.announcement_id || ""]) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canWorkerComplete && (
                      <Button size="sm" onClick={() => updateStatus(s, "completed")} className="gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Segna come completato
                      </Button>
                    )}
                    {canWorkerSignal && incidentTarget && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setDelayTarget(incidentTarget)}>
                          <Clock className="h-4 w-4" /> Segnala ritardo
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => setWorkerCancelTarget(incidentTarget)}>
                          <XCircle className="h-4 w-4" /> Annulla presenza
                        </Button>
                      </>
                    )}
                    {canRestaurantAct && (
                      <>
                        <Button size="sm" onClick={() => handleCloseShift(s)} className="gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Completato
                        </Button>
                        {(() => {
                          const noShowInfo = getNoShowAvailability(s, ann0?.service_time ?? null);
                          if (typeof window !== "undefined") {
                            console.log("[PUPILLO_NO_SHOW_AVAILABILITY_DEBUG]", {
                              restaurant_user_id: s.restaurant_id,
                              worker_user_id: s.worker_id,
                              shift_id: s.id,
                              announcement_id: s.announcement_id,
                              shift_start_time: computeShiftStartDate(s.shift_date, ann0?.service_time ?? null)?.toISOString() ?? null,
                              current_time: new Date().toISOString(),
                              no_show_available_from: noShowInfo.availableFrom?.toISOString() ?? null,
                              minutes_after_start: noShowInfo.minutesAfterStart,
                              can_mark_no_show: noShowInfo.canMark,
                              reason_if_disabled: noShowInfo.reasonIfDisabled,
                              current_shift_status: s.status,
                            });
                          }
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setNoShowDialog(s); setNoShowNotes(""); }}
                              disabled={!noShowInfo.canMark}
                              title={noShowInfo.disabledMessage ?? undefined}
                              aria-label={noShowInfo.disabledMessage ?? "Segnala No-show"}
                              className="gap-1"
                            >
                              <AlertTriangle className="h-4 w-4" /> No-show
                            </Button>
                          );
                        })()}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("[PUPILLO_CANCEL_SHIFT_BUTTON_UI_DEBUG]", {
                              restaurant_user_id: s.restaurant_id,
                              shift_id: s.id,
                              old_label: "Annulla",
                              new_label: "Annulla turno",
                              destructive_style_applied: true,
                              confirmation_modal_opened: true,
                            });
                            openCancelDialog(s);
                          }}
                          aria-label="Annulla turno"
                          className="gap-1 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive"
                        >
                          <XCircle className="h-4 w-4" /> Annulla turno
                        </Button>
                      </>
                    )}
                    {acceptedAppMap[s.announcement_id || ""] && (
                      <Button asChild size="sm" className="gap-1">
                        <Link to="/messages/$id" params={{ id: acceptedAppMap[s.announcement_id || ""].id }}>
                          <MessageSquare className="h-4 w-4" /> Apri chat
                        </Link>
                      </Button>
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
                      <div className="space-y-3">
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
                        {role === "restaurant" && (
                          <SaveToFavoritesPrompt
                            restaurantId={s.restaurant_id}
                            workerId={s.worker_id}
                            workerName={profiles[s.worker_id]?.full_name ?? null}
                            applicationId={s.announcement_id ? acceptedAppMap[s.announcement_id]?.id ?? null : null}
                          />
                        )}
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
                          <div className="space-y-2">
                            {([
                              ["overall", "Valutazione generale"],
                              ["communication", "Comunicazione"],
                              ["clarity", "Chiarezza delle istruzioni"],
                              ["payment_fairness", "Puntualità nei pagamenti / correttezza"],
                              ["work_environment", "Ambiente di lavoro"],
                            ] as const).map(([key, label]) => (
                              <div key={key} className="flex items-center justify-between gap-3">
                                <span className="text-sm">{label}</span>
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setWorkerCriteria(c => ({ ...c, [key]: n }))}
                                      className="p-0.5 disabled:opacity-50"
                                      disabled={submittingReview === s.id}
                                    >
                                      <Star className={`h-5 w-5 transition ${n <= (workerCriteria as any)[key] ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Textarea
                          placeholder={role === "worker"
                            ? "Scrivi una breve recensione sulla tua esperienza..."
                            : "Commento (opzionale)"}
                          value={comment}
                          onChange={e => setComment(e.target.value.slice(0, 500))}
                          rows={3}
                          maxLength={500}
                          disabled={submittingReview === s.id}
                        />
                        {role === "worker" && (
                          <div className="text-[11px] text-muted-foreground text-right">{comment.length}/500</div>
                        )}
                        {role === "restaurant" && (
                          <ReviewLabelsPicker
                            positive={positiveLabels}
                            negative={negativeLabels}
                            onChange={({ positive, negative }) => { setPositiveLabels(positive); setNegativeLabels(negative); }}
                            disabled={submittingReview === s.id}
                          />
                        )}
                        {role === "restaurant" && (
                          <WouldRehirePicker value={wouldRehire} onChange={setWouldRehire} disabled={submittingReview === s.id} />
                        )}
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
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            if (role === "worker") {
                              try { console.log("[PUPILLO_WORKER_REVIEW_BUTTON_RENDERED]", { shift_id: s.id }); } catch { /* ignore */ }
                              openWorkerReviewDialog(s);
                              return;
                            }
                            setReviewOpen(s.id);
                            setRating(5);
                            setComment("");
                            setCriteria({ punctuality: 5, professionalism: 5, competence: 5, reliability: 5, teamwork: 5 });
                            setWorkerCriteria({ overall: 5, communication: 5, clarity: 5, payment_fairness: 5, work_environment: 5 });
                            setPositiveLabels([]);
                            setNegativeLabels([]);
                            setWouldRehire(null);
                            setReviewError(prev => { const { [s.id]: _, ...rest } = prev; return rest; });
                          }}
                          disabled={submittingReview === s.id}
                        >
                          <Star className="h-4 w-4" /> {role === "worker" ? "Recensisci ristoratore" : "Lascia recensione"}
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

      <Dialog open={!!reviewDialog} onOpenChange={(open) => { if (!open && !dialogSubmitting) setReviewDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recensisci il lavoratore</DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <UserAvatar userId={reviewDialog.worker_id} name={reviewDialog.worker_name} className="h-12 w-12" />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{reviewDialog.worker_name ?? "Lavoratore"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {reviewDialog.worker_role && <span className="capitalize">{reviewDialog.worker_role} · </span>}
                    {new Date(reviewDialog.service_date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                    {reviewDialog.service_time && ` · ${reviewDialog.service_time.slice(0,5)}`}
                    {reviewDialog.end_time && `–${reviewDialog.end_time.slice(0,5)}`}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {([
                  ["punctuality", "Puntualità"],
                  ["professionalism", "Professionalità"],
                  ["competence", "Qualità del servizio"],
                  ["reliability", "Affidabilità"],
                  ["teamwork", "Collaborazione con il team"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDialogCriteria(c => ({ ...c, [key]: n }))}
                          className="p-0.5 disabled:opacity-50"
                          disabled={dialogSubmitting}
                          aria-label={`${label} ${n} stelle`}
                        >
                          <Star className={`h-5 w-5 transition ${n <= (dialogCriteria as any)[key] ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Textarea
                placeholder="Commento (opzionale)"
                value={dialogComment}
                onChange={e => setDialogComment(e.target.value)}
                rows={3}
                disabled={dialogSubmitting}
              />
              <ReviewLabelsPicker
                positive={dialogPositive}
                negative={dialogNegative}
                onChange={({ positive, negative }) => { setDialogPositive(positive); setDialogNegative(negative); }}
                disabled={dialogSubmitting}
              />
              <WouldRehirePicker value={dialogWouldRehire} onChange={setDialogWouldRehire} disabled={dialogSubmitting} />
              {dialogError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">{dialogError}</div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setReviewDialog(null)} disabled={dialogSubmitting}>Annulla</Button>
                <Button onClick={submitDialogReview} disabled={dialogSubmitting} className="gap-1.5">
                  {dialogSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Invio…</>) : (<><Star className="h-4 w-4" /> Invia recensione</>)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!noShowDialog}
        onOpenChange={(open) => {
          if (!open && !noShowSubmitting) {
            setNoShowDialog(null);
            setNoShowNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confermi il No Show?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Stai segnalando che il lavoratore non si è presentato al turno.</p>
            <p>Questa segnalazione può incidere sulla reputazione del profilo del lavoratore.</p>
            <p>Prima di applicare eventuali penalizzazioni definitive, il caso verrà verificato dal reparto controllo Pupillo.</p>
            <p>Conferma solo se sei certo che il lavoratore non si sia presentato al servizio.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Motivo / note sulla segnalazione (facoltativo)</label>
            <Textarea
              value={noShowNotes}
              onChange={(e) => setNoShowNotes(e.target.value)}
              placeholder="Scrivi eventuali dettagli utili per la verifica"
              rows={3}
              maxLength={1000}
              disabled={noShowSubmitting}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => { setNoShowDialog(null); setNoShowNotes(""); }}
              disabled={noShowSubmitting}
            >
              Annulla
            </Button>
            <Button
              onClick={async () => {
                const s = noShowDialog;
                if (!s) return;
                // Guard finale: nessun No show se non sono passati almeno 15 min
                // dall'orario di inizio turno reale. Stesso calcolo del bottone.
                const ann = announcementsMap[s.announcement_id || ""];
                const guard = getNoShowAvailability(s, ann?.service_time ?? null);
                if (!guard.canMark) {
                  toast.error(guard.disabledMessage ?? "Non puoi segnalare No show in questo momento.");
                  return;
                }
                setNoShowSubmitting(true);
                const { error } = await supabase.from("shifts").update({ status: "no_show" }).eq("id", s.id);
                if (error) {
                  toast.error(error.message);
                  setNoShowSubmitting(false);
                  if (typeof window !== "undefined") {
                    console.log("[PUPILLO_NO_SHOW_CONFIRM_DEBUG]", {
                      restaurant_user_id: user?.id ?? null,
                      worker_user_id: s.worker_id,
                      shift_id: s.id,
                      confirmed_no_show: false,
                      has_note: noShowNotes.trim().length > 0,
                      status_before: s.status,
                      status_after: s.status,
                      worker_incident_created: false,
                      reliability_updated: false,
                      notification_sent: false,
                      error: error.message,
                    });
                  }
                  return;
                }
                let notificationSent = false;
                if (user) {
                  supabase.from("activity_logs").insert({
                    user_id: user.id,
                    action: "shift_no_show_reported",
                    entity_type: "shift",
                    entity_id: s.id,
                    metadata: {
                      shift_id: s.id,
                      worker_id: s.worker_id,
                      restaurant_id: s.restaurant_id,
                      review_status: "under_review",
                      notes: noShowNotes.trim() || null,
                    },
                  } as never).then(() => {}, () => {});
                  // Notifica al lavoratore (best-effort, non blocca il flusso).
                  const ann2 = announcementsMap[s.announcement_id || ""];
                  const startStr = ann2?.service_time ? ` alle ${ann2.service_time.slice(0,5)}` : "";
                  const dateStr = new Date(s.shift_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
                  const notifRes = await supabase.from("notifications").insert({
                    user_id: s.worker_id,
                    title: "Segnalazione No show",
                    body: `È stato segnalato un No show per il turno del ${dateStr}${startStr}. Puoi contattare l'assistenza se ritieni che ci sia un errore.`,
                    link: `/shifts?shift=${s.id}`,
                  } as never);
                  notificationSent = !notifRes.error;
                }
                toast.success("Segnalazione ricevuta. Il caso verrà verificato dal reparto controllo Pupillo.");
                if (typeof window !== "undefined") {
                  console.log("[PUPILLO_NO_SHOW_CONFIRM_DEBUG]", {
                    restaurant_user_id: user?.id ?? null,
                    worker_user_id: s.worker_id,
                    shift_id: s.id,
                    confirmed_no_show: true,
                    has_note: noShowNotes.trim().length > 0,
                    status_before: s.status,
                    status_after: "no_show",
                    worker_incident_created: false,
                    reliability_updated: false,
                    notification_sent: notificationSent,
                  });
                }
                setNoShowSubmitting(false);
                setNoShowDialog(null);
                setNoShowNotes("");
              }}
              disabled={noShowSubmitting}
              className="gap-1"
            >
              {noShowSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Conferma segnalazione
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notEndedDialog} onOpenChange={(open) => { if (!open) setNotEndedDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Il turno non è ancora terminato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Questo turno risulta ancora in corso o non ancora concluso.</p>
            <p>Potrai chiuderlo solo al termine dell'orario previsto del servizio.</p>
            <p>Se ci sono problemi con il lavoratore, puoi usare le azioni disponibili come "No show" o contattare l'assistenza Pupillo.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setNotEndedDialog(null)}>Ho capito</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewNotAvailableOpen} onOpenChange={(open) => { if (!open) setReviewNotAvailableOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recensione non ancora disponibile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Potrai lasciare la recensione al ristoratore solo dopo la fine del turno.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setReviewNotAvailableOpen(false)}>Ho capito</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelDialog}
        onOpenChange={(open) => {
          if (!open && !cancelSubmitting) {
            setCancelDialog(null);
            setCancelReason("");
            setCancelError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confermi l'annullamento del servizio?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Stai annullando un turno già assegnato.</p>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
              L'annullamento non prevede alcun rimborso dei crediti o dei costi già sostenuti.
            </p>
            <p>Per correttezza verso il lavoratore, devi indicare una motivazione. La motivazione sarà inviata al lavoratore insieme alla comunicazione di annullamento.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Motivo dell'annullamento <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => { setCancelReason(e.target.value); if (cancelError) setCancelError(null); }}
              placeholder="Scrivi il motivo dell'annullamento del servizio..."
              rows={4}
              maxLength={1000}
              disabled={cancelSubmitting}
            />
            <div className="text-xs text-muted-foreground">
              Minimo 10 caratteri ({cancelReason.trim().length}/10).
            </div>
          </div>
          {cancelError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">{cancelError}</div>
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => { setCancelDialog(null); setCancelReason(""); setCancelError(null); }}
              disabled={cancelSubmitting}
            >
              Torna indietro
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelSubmitting || cancelReason.trim().length < 10}
              className="gap-1"
            >
              {cancelSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Conferma annullamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReportDelayDialog
        open={!!delayTarget}
        target={delayTarget}
        onClose={() => setDelayTarget(null)}
        onDone={() => { /* incident persisted; shift status unchanged */ }}
      />
      <CancelPresenceDialog
        open={!!workerCancelTarget}
        target={workerCancelTarget}
        onClose={() => setWorkerCancelTarget(null)}
        onDone={() => {
          if (workerCancelTarget) {
            setShifts(prev => prev.map(x => x.id === workerCancelTarget.shiftId ? { ...x, status: "cancelled" as const } : x));
          }
        }}
      />

      <Dialog open={!!workerReviewDialog} onOpenChange={(open) => { if (!open && !workerDialogSubmitting) setWorkerReviewDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Com'è andato il turno?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Lascia una recensione al ristoratore per completare il servizio.
            </p>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} stelle`}
                    onClick={() => setWorkerDialogRating(n)}
                    className="p-1 disabled:opacity-50"
                    disabled={workerDialogSubmitting}
                  >
                    <Star className={`h-8 w-8 transition ${n <= workerDialogRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground h-4">
                {workerDialogRating === 1 && "Pessima esperienza"}
                {workerDialogRating === 2 && "Da migliorare"}
                {workerDialogRating === 3 && "Normale"}
                {workerDialogRating === 4 && "Buona esperienza"}
                {workerDialogRating === 5 && "Ottima esperienza"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tag (facoltativi)</div>
              <div className="flex flex-wrap gap-2">
                {WORKER_REVIEW_TAGS.map(tag => {
                  const active = workerDialogTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setWorkerDialogTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                      disabled={workerDialogSubmitting}
                      className={`text-xs rounded-full px-3 py-1 border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <Textarea
              placeholder="Vuoi aggiungere qualcosa? Facoltativo."
              value={workerDialogComment}
              onChange={e => setWorkerDialogComment(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              disabled={workerDialogSubmitting}
            />
            {workerDialogError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">{workerDialogError}</div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setWorkerReviewDialog(null)} disabled={workerDialogSubmitting}>Annulla</Button>
              <Button size="sm" onClick={submitWorkerReviewDialog} disabled={workerDialogSubmitting || workerDialogRating < 1} className="gap-1.5">
                {workerDialogSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Invio…</>) : "Invia recensione"}
              </Button>
            </div>
          </div>
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
