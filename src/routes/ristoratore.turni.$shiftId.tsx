import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatTariff } from "@/lib/format";
import {
  ArrowLeft, Calendar, MapPin, Clock, Star, CheckCheck, CheckCircle2,
  XCircle, AlertTriangle, MessageSquare, User, Briefcase, Euro, Check, Heart,
  Flag, ThumbsUp, ThumbsDown, HelpCircle,
} from "lucide-react";
import { ConfirmedWorkerCard, type ConfirmedWorkerLastReview } from "@/components/ConfirmedWorkerCard";
import { RequestReviewRevisionDialog } from "@/components/RequestReviewRevisionDialog";

export const Route = createFileRoute("/ristoratore/turni/$shiftId")({
  head: () => ({ meta: [{ title: "Dettaglio turno — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>): { section?: "recensione" } => ({
    section: s.section === "recensione" ? "recensione" : undefined,
  }),
  component: () => <RequireAuth><ShiftDetailPage /></RequireAuth>,
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
  completed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Announcement = {
  id: string;
  service_date: string;
  service_time: string;
  duration_hours: number | null;
  tariff_amount: number | null;
  tariff_type: string | null;
  location_address: string | null;
  professional_profile: string | null;
  notes: string | null;
  dress_code_items: string[] | null;
  dress_code_notes: string | null;
  required_skills: string[] | null;
  language_requirements: string[] | null;
  job_access_restrictions: string | null;
  status: string;
  created_at: string;
  assigned_worker_id: string | null;
  restaurant_id: string;
};

type Worker = {
  id: string;
  full_name: string | null;
  primary_role: string | null;
  badge: string | null;
  rating_avg: number | null;
  reliability_pct: number | null;
  completed_shifts: number | null;
  languages: string[] | null;
  spoken_languages: any;
  reviews_count?: number | null;
  professional_profile?: string | null;
  phone_verified?: boolean | null;
  profile_completed?: boolean | null;
  id_document_path?: string | null;
};

type JobReq = {
  announcement_id: string | null;
  role_required: string | null;
  title: string | null;
  description: string | null;
  workers_needed: number | null;
  operational_notes: string | null;
};

type Restaurant = { id: string; business_name: string | null; full_name: string | null };

const shiftStatusMeta: Record<Shift["status"], { label: string; cls: string; Icon: any }> = {
  scheduled: { label: "Confermato", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  completed: { label: "Completato", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30", Icon: CheckCheck },
  cancelled: { label: "Annullato", cls: "bg-red-500/10 text-red-700 border-red-500/30", Icon: XCircle },
  no_show: { label: "No-show", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30", Icon: AlertTriangle },
};

const POSITIVE_TAGS = [
  "Puntuale", "Professionale", "Affidabile", "Ordinato", "Veloce",
  "Collaborativo", "Ha rispettato il dress code", "Buona comunicazione",
  "Esperienza adeguata", "Da richiamare",
];
const CRITICAL_TAGS = [
  "In ritardo", "Poco comunicativo", "Dress code non rispettato",
  "Esperienza non adeguata", "Da migliorare", "Non richiamare",
];
const RATING_LABELS: Record<number, string> = {
  1: "Insufficiente", 2: "Da migliorare", 3: "Buono", 4: "Molto buono", 5: "Eccellente",
};

const CRITERIA: { key: "punctuality" | "professionalism" | "competence" | "reliability" | "teamwork" | "communication" | "appearance"; label: string; hint: string }[] = [
  { key: "punctuality", label: "Puntualità", hint: "Si è presentato all'orario concordato" },
  { key: "professionalism", label: "Professionalità", hint: "Atteggiamento e comportamento sul lavoro" },
  { key: "competence", label: "Competenza", hint: "Capacità tecniche nel ruolo svolto" },
  { key: "reliability", label: "Affidabilità", hint: "Costanza e impegno durante il servizio" },
  { key: "teamwork", label: "Lavoro in team", hint: "Collaborazione con il resto dello staff" },
  { key: "communication", label: "Comunicazione", hint: "Chiarezza nello scambio di informazioni" },
  { key: "appearance", label: "Cura dell'aspetto", hint: "Rispetto del dress code e ordine" },
];

const INCIDENT_KINDS: { key: string; label: string; desc: string }[] = [
  { key: "no_show", label: "Non si è presentato", desc: "Il lavoratore non si è presentato al turno." },
  { key: "late", label: "Ritardo grave", desc: "Ritardo significativo non comunicato." },
  { key: "behavior", label: "Comportamento scorretto", desc: "Comportamento inappropriato verso staff o clienti." },
  { key: "dress_code", label: "Dress code non rispettato", desc: "Aspetto o abbigliamento non conformi." },
  { key: "other", label: "Altro", desc: "Altro problema rilevante." },
];

function ShiftDetailPage() {
  const { shiftId } = Route.useParams();
  const search = Route.useSearch();
  const { user, role } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [lastReview, setLastReview] = useState<ConfirmedWorkerLastReview | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [workerReview, setWorkerReview] = useState<{
    id: string;
    rating: number;
    comment: string | null;
    communication: number | null;
    professionalism: number | null;
    reliability: number | null;
    staff_collaboration: number | null;
    created_at: string;
  } | null>(null);
  const [jobReq, setJobReq] = useState<JobReq | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [appCount, setAppCount] = useState<number>(0);
  const [existingReview, setExistingReview] = useState<{ id: string; rating: number; comment: string | null; tags: string[] | null } | null>(null);
  const hasReview = !!existingReview;
  const [requiredReview, setRequiredReview] = useState<{ status: string; due_date: string; review_id?: string | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);

  const toggleFavorite = async () => {
    if (!user || !shift?.worker_id) return;
    if (shift.status !== "completed") {
      toast.error("Puoi aggiungere ai preferiti solo dopo aver completato il turno.");
      return;
    }
    setFavLoading(true);
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("restaurant_worker_favorites")
          .delete()
          .eq("restaurant_id", user.id)
          .eq("worker_id", shift.worker_id);
        if (error) throw error;
        setIsFavorite(false);
        toast.success("Lavoratore rimosso dai preferiti.");
      } else {
        const { error } = await supabase
          .from("restaurant_worker_favorites")
          .insert({ restaurant_id: user.id, worker_id: shift.worker_id });
        if (error) throw error;
        setIsFavorite(true);
        toast.success("Lavoratore aggiunto ai preferiti.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Errore aggiornamento preferiti");
    } finally {
      setFavLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setForbidden(false);
    setNotFound(false);
    const { data: sh, error } = await supabase
      .from("shifts").select("*").eq("id", shiftId).maybeSingle();
    if (error || !sh) { setNotFound(true); setLoading(false); return; }
    const s = sh as Shift;
    if (user && s.restaurant_id !== user.id && role !== "admin") {
      setForbidden(true); setLoading(false); return;
    }
    setShift(s);
    const [annRes, workerRes, restRes, appsRes, revsRes, reqRes] = await Promise.all([
      s.announcement_id
        ? supabase.from("announcements").select("*").eq("id", s.announcement_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles")
        .select("id, full_name, primary_role, professional_profile, badge, rating_avg, reviews_count, reliability_pct, completed_shifts, languages, spoken_languages, phone_verified, profile_completed, id_document_path")
        .eq("id", s.worker_id).maybeSingle(),
      supabase.from("profiles").select("id, business_name, full_name").eq("id", s.restaurant_id).maybeSingle(),
      s.announcement_id
        ? supabase.from("applications").select("id, worker_id, status").eq("announcement_id", s.announcement_id)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase.from("reviews").select("id, rating, comment, tags").eq("shift_id", s.id).eq("author_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase as any).from("required_reviews")
        .select("status, due_date, review_id")
        .eq("shift_id", s.id)
        .eq("restaurant_user_id", s.restaurant_id)
        .eq("worker_user_id", s.worker_id)
        .maybeSingle(),
    ]);
    setAnn((annRes.data as Announcement) ?? null);
    setWorker((workerRes.data as Worker) ?? null);
    if (s.worker_id) {
      const { data: rev } = await supabase
        .from("reviews")
        .select("rating, comment, created_at, is_visible_to_restaurants")
        .eq("target_id", s.worker_id)
        .eq("is_visible_to_restaurants", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastReview(rev ? { rating: (rev as any).rating, comment: (rev as any).comment, created_at: (rev as any).created_at } : null);
    } else {
      setLastReview(null);
    }
    // Recensione lasciata dal lavoratore al ristoratore per questo turno
    {
      const { data: wrev } = await supabase
        .from("reviews")
        .select("id, rating, comment, communication, professionalism, reliability, staff_collaboration, created_at")
        .eq("shift_id", s.id)
        .eq("author_id", s.worker_id)
        .eq("target_id", s.restaurant_id)
        .maybeSingle();
      setWorkerReview((wrev as any) ?? null);
    }
    setRestaurant((restRes.data as Restaurant) ?? null);
    const apps = (appsRes.data ?? []) as any[];
    setAppCount(apps.length);
    const matchedApp = apps.find((a) => a.worker_id === s.worker_id) ?? null;
    setAppId(matchedApp?.id ?? null);
    setExistingReview((revsRes.data as any) ?? null);
    setRequiredReview((reqRes as any).data ?? null);
    if (user && s.worker_id) {
      const { data: favRow } = await supabase
        .from("restaurant_worker_favorites")
        .select("id")
        .eq("restaurant_id", user.id)
        .eq("worker_id", s.worker_id)
        .maybeSingle();
      setIsFavorite(!!favRow);
    }
    if (s.announcement_id) {
      const { data: jr } = await supabase
        .from("job_requests")
        .select("announcement_id, role_required, title, description, workers_needed, operational_notes")
        .eq("announcement_id", s.announcement_id).maybeSingle();
      setJobReq((jr as JobReq) ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user, shiftId]);

  // Auto-scroll alla sezione recensione quando arrivi con ?section=recensione
  useEffect(() => {
    if (loading || !shift) return;
    if (search.section === "recensione" && reviewRef.current) {
      // piccolo delay per attendere il render
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [loading, shift, search.section]);

  const concludeShift = async () => {
    if (!shift) return;
    if (!shift.worker_id) { toast.error("Lavoratore non collegato al turno."); return; }
    if (!shift.restaurant_id) { toast.error("Turno non trovato."); return; }
    setClosing(true);
    const { error } = await supabase.from("shifts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", shift.id)
      .eq("restaurant_id", shift.restaurant_id);
    setClosing(false);
    if (error) {
      const msg = String(error.message ?? "");
      toast.error(
        msg.includes("required_reviews") || msg.includes("ON CONFLICT")
          ? "Impossibile creare la recensione obbligatoria. Riprova."
          : msg || "Errore durante la chiusura del turno"
      );
      return;
    }
    toast.success("Turno concluso. Lascia ora la recensione.");
    setConfirmOpen(false);
    await load();
    // resta sul dettaglio turno e apri direttamente il blocco recensione
    nav({ to: "/ristoratore/turni/$shiftId", params: { shiftId: shift.id }, search: { section: "recensione" } });
  };

  const submitFullReview = async (payload: {
    criteria: Record<string, number>;
    wouldRehire: "yes" | "maybe" | "no" | null;
    text: string;
    tags: string[];
  }) => {
    if (!user || !shift) return;
    const vals = Object.values(payload.criteria);
    if (vals.length < CRITERIA.length || vals.some((v) => !v)) {
      toast.error("Valuta tutti i criteri."); return;
    }
    if (!payload.wouldRehire) { toast.error('Rispondi a "Lo richiameresti?"'); return; }
    const trimmed = payload.text.trim();
    if (trimmed.length < 20) { toast.error("La recensione deve contenere almeno 20 caratteri."); return; }
    if (trimmed.length > 500) { toast.error("La recensione può contenere al massimo 500 caratteri."); return; }
    const rating = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

    const { data: dup } = await supabase.from("reviews")
      .select("id").eq("shift_id", shift.id).eq("author_id", user.id)
      .eq("target_id", shift.worker_id).maybeSingle();
    if (dup) { toast.error("Hai già recensito questo turno."); await load(); return; }

    const { data: created, error } = await supabase.from("reviews").insert({
      author_id: user.id,
      target_id: shift.worker_id,
      shift_id: shift.id,
      announcement_id: shift.announcement_id,
      application_id: appId,
      rating,
      comment: trimmed,
      tags: payload.tags,
      punctuality: payload.criteria.punctuality,
      professionalism: payload.criteria.professionalism,
      competence: payload.criteria.competence,
      reliability: payload.criteria.reliability,
      teamwork: payload.criteria.teamwork,
      communication: payload.criteria.communication,
      appearance: payload.criteria.appearance,
      would_rehire: payload.wouldRehire,
    } as never).select("id, rating, comment, tags").single();
    if (error) {
      toast.error(error.message.includes("duplicate") || error.message.includes("unique") ? "Recensione già presente per questo turno." : error.message);
      await load();
      return;
    }
    if (appId) {
      // UN SOLO messaggio combinato "Turno chiuso e recensione ricevuta"
      // in chat (anti-duplicato): se esiste già, non crearne un altro.
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("application_id", appId)
        .eq("template_id", "shift_closed_with_review")
        .limit(1)
        .maybeSingle();
      if (!existingMsg) {
        await supabase.from("messages").insert({
          application_id: appId,
          sender_id: user.id,
          receiver_id: shift.worker_id,
          body: "Turno chiuso e recensione ricevuta",
          template_id: "shift_closed_with_review",
          message_type: "system",
          action_type: "complete_shift",
        } as never);
      }
    }
    toast.success("Recensione inviata");
    setExistingReview(created as any);
    await load();
  };

  const reportIncident = async (kind: string, description: string) => {
    if (!user || !shift) return;
    if (!kind) { toast.error("Seleziona il tipo di problema."); return; }
    if (description.trim().length < 20) { toast.error("Descrivi il problema (min 20 caratteri)."); return; }
    const { error } = await supabase.from("worker_incidents").insert({
      worker_id: shift.worker_id,
      restaurant_id: user.id,
      application_id: appId,
      shift_id: shift.id,
      kind,
      description: description.trim(),
    } as never);
    if (error) { toast.error(error.message ?? "Errore invio segnalazione"); return; }
    toast.success("Segnalazione inviata. Sarà verificata dal team.");
  };

  if (loading) {
    return <AppShell><PageHeader title="Dettaglio turno" /><p className="text-muted-foreground">Caricamento…</p></AppShell>;
  }
  if (notFound) {
    return (
      <AppShell>
        <PageHeader title="Dettaglio turno" />
        <EmptyState title="Turno non trovato" hint="Il turno richiesto non esiste o è stato rimosso." />
      </AppShell>
    );
  }
  if (forbidden) {
    return (
      <AppShell>
        <PageHeader title="Dettaglio turno" />
        <EmptyState title="Permesso negato" hint="Non hai i permessi per visualizzare questo turno." />
      </AppShell>
    );
  }
  if (!shift) return null;

  const meta = shiftStatusMeta[shift.status];
  const StatusIcon = meta.Icon;

  // Orari
  const startTime = ann?.service_time?.slice(0, 5) ?? null;
  const dur = ann?.duration_hours ?? shift.hours;
  const endTime = (() => {
    if (!startTime || !dur) return null;
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + Math.round(dur * 60);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  })();
  const tariff = ann?.tariff_amount ?? null;
  const compenso = shift.amount ?? (tariff && dur ? Number(tariff) * Number(dur) : null);

  // Stato recensione
  const isOverdue = requiredReview?.status === "overdue";
  let reviewLabel = "non ancora disponibile";
  let reviewClass = "text-muted-foreground";
  if (shift.status === "completed") {
    if (hasReview) { reviewLabel = "inviata"; reviewClass = "text-emerald-600"; }
    else if (isOverdue) { reviewLabel = "obbligatoria scaduta"; reviewClass = "text-destructive"; }
    else { reviewLabel = "da lasciare"; reviewClass = "text-amber-700"; }
  }

  const restName = restaurant?.business_name || restaurant?.full_name || "—";
  const roleLabel = jobReq?.role_required || ann?.professional_profile || "Servizio";

  return (
    <AppShell>
      <PageHeader
        title="Dettaglio turno"
        subtitle="Riepilogo del servizio e lavoratore assegnato"
        action={
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Dashboard</Button>
          </Link>
        }
      />

      {/* Card 1 — Riepilogo turno */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Ruolo cercato</div>
            <div className="text-lg font-semibold">{roleLabel}</div>
            {jobReq?.title && jobReq.title !== roleLabel && (
              <div className="text-sm text-muted-foreground">{jobReq.title}</div>
            )}
            <div className="text-sm text-muted-foreground mt-1">{restName}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
              <StatusIcon className="h-3 w-3" /> {meta.label}
            </span>
            <span className={`text-[11px] ${reviewClass}`}>Recensione: {reviewLabel}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field icon={Calendar} label="Data turno" value={new Date(shift.shift_date).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} />
          {startTime && <Field icon={Clock} label="Orario" value={`${startTime}${endTime ? ` - ${endTime}` : ""}`} />}
          <Field icon={Clock} label="Durata stimata" value={dur ? `${dur} ore` : "—"} />
          {tariff != null && <Field icon={Euro} label={ann?.tariff_type === "hourly" ? "Tariffa oraria" : "Tariffa"} value={formatTariff(tariff, ann?.tariff_type)} />}
          {compenso != null && <Field icon={Euro} label="Compenso stimato" value={`€${Number(compenso).toFixed(2)}`} />}
          {ann?.location_address && <Field icon={MapPin} label="Luogo" value={ann.location_address} />}
        </div>

        {(ann?.notes || jobReq?.operational_notes) && (
          <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
            <div className="text-xs font-medium text-muted-foreground mb-1">Note operative</div>
            <div className="whitespace-pre-line">{ann?.notes || jobReq?.operational_notes}</div>
          </div>
        )}
      </div>

      {/* Card 2 — Lavoratore */}
      <div className="mt-4 rounded-2xl border bg-card p-5">
        <div className="text-sm font-semibold mb-3">Lavoratore confermato</div>
        {!worker ? (
          <p className="text-sm text-muted-foreground">Nessun lavoratore assegnato a questo turno.</p>
        ) : shift.status === "cancelled" ? (
          <p className="text-sm text-muted-foreground">Turno annullato — i dati del lavoratore non sono più visibili.</p>
        ) : (
          <>
            <ConfirmedWorkerCard
              worker={worker as any}
              applicationId={appId}
              lastReview={lastReview}
            />
            {shift.status === "completed" && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={isFavorite ? "default" : "outline"}
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className="gap-1"
                  aria-pressed={isFavorite}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                  {isFavorite ? "Preferito" : "Aggiungi ai preferiti"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Card 3 — Annuncio collegato */}
      {ann && (
        <div className="mt-4 rounded-2xl border bg-card p-5">
          <div className="text-sm font-semibold mb-3">Annuncio collegato</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field icon={Briefcase} label="Ruolo richiesto" value={roleLabel} />
            <Field icon={User} label="Lavoratori richiesti" value={String(jobReq?.workers_needed ?? 1)} />
            <Field icon={MessageSquare} label="Candidature ricevute" value={String(appCount)} />
            <Field icon={Calendar} label="Pubblicato il" value={new Date(ann.created_at).toLocaleDateString("it-IT")} />
            <Field icon={CheckCircle2} label="Stato annuncio" value={ann.status} />
          </div>

          {(ann.dress_code_items?.length || ann.dress_code_notes || ann.required_skills?.length || ann.language_requirements?.length || ann.job_access_restrictions) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ann.dress_code_items && ann.dress_code_items.length > 0 && (
                <Field label="Dress code" value={ann.dress_code_items.join(", ")} />
              )}
              {ann.required_skills && ann.required_skills.length > 0 && (
                <Field label="Competenze richieste" value={ann.required_skills.join(", ")} />
              )}
              {ann.language_requirements && ann.language_requirements.length > 0 && (
                <Field label="Lingue richieste" value={ann.language_requirements.join(", ")} />
              )}
              {ann.job_access_restrictions && (
                <Field label="Accesso al locale" value={ann.job_access_restrictions} />
              )}
            </div>
          )}

          <div className="mt-3">
            <Link to="/announcements/$id" params={{ id: ann.id }}>
              <Button size="sm" variant="ghost">Apri annuncio →</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Card 4 — Azioni turno */}
      {shift.status === "completed" && (
        <div className="mt-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recensione del lavoratore</div>
            {workerReview && (
              <span className="text-[11px] text-muted-foreground">
                {new Date(workerReview.created_at).toLocaleDateString("it-IT")}
              </span>
            )}
          </div>
          {!workerReview ? (
            <p className="text-sm text-muted-foreground">
              Il lavoratore non ha ancora lasciato una recensione per questo turno.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5" aria-label={`Valutazione ${workerReview.rating} su 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${n <= (workerReview.rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{workerReview.rating}/5</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                {workerReview.communication != null && (
                  <div className="flex justify-between rounded-md bg-muted/40 px-2 py-1">
                    <span className="text-muted-foreground">Comunicazione</span>
                    <span className="font-medium">{workerReview.communication}/5</span>
                  </div>
                )}
                {workerReview.professionalism != null && (
                  <div className="flex justify-between rounded-md bg-muted/40 px-2 py-1">
                    <span className="text-muted-foreground">Chiarezza istruzioni</span>
                    <span className="font-medium">{workerReview.professionalism}/5</span>
                  </div>
                )}
                {workerReview.reliability != null && (
                  <div className="flex justify-between rounded-md bg-muted/40 px-2 py-1">
                    <span className="text-muted-foreground">Puntualità pagamenti</span>
                    <span className="font-medium">{workerReview.reliability}/5</span>
                  </div>
                )}
                {workerReview.staff_collaboration != null && (
                  <div className="flex justify-between rounded-md bg-muted/40 px-2 py-1">
                    <span className="text-muted-foreground">Ambiente di lavoro</span>
                    <span className="font-medium">{workerReview.staff_collaboration}/5</span>
                  </div>
                )}
              </div>
              {workerReview.comment && (
                <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                  "{workerReview.comment}"
                </blockquote>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card 5 — Azioni turno */}
      <div ref={reviewRef} className={`mt-4 rounded-2xl border bg-card p-5 ${search.section === "recensione" ? "ring-2 ring-primary/40" : ""}`}>
        <div className="text-sm font-semibold mb-3">Azioni turno</div>
        <div className="flex flex-wrap gap-2">
          {shift.status === "scheduled" && worker && (
            <Button onClick={() => setConfirmOpen(true)} className="gap-1">
              <CheckCheck className="h-4 w-4" /> Concludi turno
            </Button>
          )}
          {shift.status === "cancelled" && (
            <span className="text-sm text-muted-foreground">Turno annullato</span>
          )}
          {shift.status === "no_show" && appId && (
            <Link to="/messages/$id" params={{ id: appId }}>
              <Button variant="outline" className="gap-1"><AlertTriangle className="h-4 w-4" /> Gestisci segnalazione</Button>
            </Link>
          )}
          <Link to="/dashboard" className="ml-auto">
            <Button variant="ghost" className="gap-1"><ArrowLeft className="h-4 w-4" /> Torna alla dashboard</Button>
          </Link>
        </div>
        {shift.status === "scheduled" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Dopo la chiusura potrai lasciare la recensione al lavoratore.
          </p>
        )}

        {/* Blocco recensione inline */}
        {shift.status === "completed" && (
          <div className="mt-5 border-t pt-5">
            <ReviewSection
              existing={existingReview}
              workerName={worker?.full_name ?? null}
              isOverdue={isOverdue}
              dueDate={requiredReview?.due_date ?? null}
              onSubmit={submitFullReview}
              onReportIncident={reportIncident}
            />
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !closing && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concludere questo turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Confermando la chiusura del turno, potrai lasciare una recensione al lavoratore.
              La recensione è necessaria per aggiornare il profilo reputazionale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); concludeShift(); }} disabled={closing}>
              {closing ? "Chiusura..." : "Conferma e lascia recensione"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Field({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{hint}</p>
      <Link to="/dashboard"><Button size="sm" variant="outline" className="mt-4 gap-1"><ArrowLeft className="h-4 w-4" /> Torna alla dashboard</Button></Link>
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Valutazione">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button key={n} type="button" role="radio" aria-checked={value === n}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`${n} stelle`}>
            <Star className={`h-7 w-7 transition ${active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} strokeWidth={1.5} />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground">
        {value ? RATING_LABELS[value] : "Seleziona valutazione"}
      </span>
    </div>
  );
}

function ReviewSection({
  existing,
  workerName,
  isOverdue,
  dueDate,
  onSubmit,
  onReportIncident,
}: {
  existing: { id: string; rating: number; comment: string | null; tags: string[] | null } | null;
  workerName: string | null;
  isOverdue: boolean;
  dueDate: string | null;
  onSubmit: (payload: {
    criteria: Record<string, number>;
    wouldRehire: "yes" | "maybe" | "no" | null;
    text: string;
    tags: string[];
  }) => Promise<void>;
  onReportIncident: (kind: string, description: string) => Promise<void>;
}) {
  const [criteria, setCriteria] = useState<Record<string, number>>({});
  const [wouldRehire, setWouldRehire] = useState<"yes" | "maybe" | "no" | null>(null);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportConfirmOpen, setReportConfirmOpen] = useState(false);
  const [incidentKind, setIncidentKind] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [reporting, setReporting] = useState(false);

  if (existing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          <h3 className="font-semibold text-sm">Recensione inviata</h3>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`h-5 w-5 ${n <= existing.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} strokeWidth={1.5} />
          ))}
          <span className="ml-2 text-sm font-medium">{existing.rating}.0 — {RATING_LABELS[existing.rating]}</span>
        </div>
        {existing.comment && <p className="text-sm">{existing.comment}</p>}
        {existing.tags && existing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {existing.tags.map((t) => (
              <span key={t} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Hai già recensito questo turno. Non è possibile modificarla.</p>
      </div>
    );
  }

  const charCount = text.trim().length;
  const allRated = CRITERIA.every((c) => criteria[c.key] > 0);
  const canSubmit = allRated && !!wouldRehire && charCount >= 20 && charCount <= 500 && !submitting;
  const toggleTag = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const setCriterion = (k: string, v: number) => setCriteria((p) => ({ ...p, [k]: v }));
  const avg = allRated
    ? Math.round((Object.values(criteria).reduce((a, b) => a + b, 0) / CRITERIA.length) * 10) / 10
    : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await onSubmit({ criteria, wouldRehire, text, tags }); }
    finally { setSubmitting(false); }
  };

  const handleReport = async () => {
    setReporting(true);
    try {
      await onReportIncident(incidentKind, incidentDesc);
      setReportOpen(false);
      setReportConfirmOpen(false);
      setIncidentKind("");
      setIncidentDesc("");
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-3 text-sm ${
        isOverdue
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      }`}>
        <div className="font-semibold">{isOverdue ? "Recensione scaduta" : "Recensione obbligatoria"}</div>
        <div className="text-xs mt-0.5">
          {isOverdue
            ? "Questa recensione è scaduta. Completarla riattiverà il contatto con nuovi lavoratori."
            : `Per chiudere correttamente il turno devi lasciare una valutazione al lavoratore${
                dueDate ? ` entro il ${new Date(dueDate).toLocaleDateString("it-IT")}` : " entro 3 giorni"
              }.`}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <h3 className="font-semibold text-base">Com'è andato il turno{workerName ? ` con ${workerName}` : ""}?</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Valuta il lavoratore su 7 criteri. Le risposte alimentano il punteggio di reputazione.
        </p>
      </div>

      {/* 7 criteri */}
      <div className="rounded-lg border bg-card/50 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Valutazione per criterio *</label>
          {allRated && (
            <span className="text-[11px] text-muted-foreground">
              Media: <span className="font-semibold text-foreground">{avg.toFixed(1)}/5</span>
            </span>
          )}
        </div>
        <div className="grid gap-2">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-[11px] text-muted-foreground">{c.hint}</div>
              </div>
              <CompactStars value={criteria[c.key] ?? 0} onChange={(v) => setCriterion(c.key, v)} ariaLabel={c.label} />
            </div>
          ))}
        </div>
      </div>

      {/* Lo richiameresti? */}
      <div className="rounded-lg border bg-card/50 p-3">
        <label className="block text-sm font-medium mb-2">Lo richiameresti? *</label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "yes" as const, label: "Sì", Icon: ThumbsUp, cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
            { key: "maybe" as const, label: "Forse", Icon: HelpCircle, cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
            { key: "no" as const, label: "No", Icon: ThumbsDown, cls: "bg-destructive/15 text-destructive border-destructive/40" },
          ].map((opt) => {
            const active = wouldRehire === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setWouldRehire(opt.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  active ? opt.cls : "bg-secondary border-transparent hover:bg-secondary/70"
                }`}
                aria-pressed={active}
              >
                <opt.Icon className="h-3.5 w-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium">Recensione *</label>
          <span className={`text-[11px] ${charCount > 500 ? "text-destructive" : "text-muted-foreground"}`}>{charCount}/500</span>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi una recensione chiara e utile sul lavoratore."
          rows={4}
          maxLength={500}
        />
        {charCount > 0 && charCount < 20 && (
          <p className="text-[11px] text-destructive mt-1">Minimo 20 caratteri ({20 - charCount} mancanti).</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-2">Tag rapidi (opzionali)</label>
        <div className="space-y-2">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Positivi</div>
            <div className="flex flex-wrap gap-1.5">
              {POSITIVE_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTag(t)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition ${active ? "bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300" : "bg-secondary border-transparent hover:bg-secondary/70"}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Critici</div>
            <div className="flex flex-wrap gap-1.5">
              {CRITICAL_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTag(t)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition ${active ? "bg-destructive/20 border-destructive text-destructive" : "bg-secondary border-transparent hover:bg-secondary/70"}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
        <Check className="h-4 w-4" />
        {submitting ? "Invio in corso…" : "Conferma fine turno e invia recensione"}
      </Button>

      {/* Segnala un problema */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-destructive flex items-center gap-1.5">
              <Flag className="h-4 w-4" /> Segnala un problema
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Per casi gravi (no-show, comportamenti scorretti). Le segnalazioni vengono verificate dal team prima di incidere sulla reputazione.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setReportOpen(true)}>
            Segnala
          </Button>
        </div>
      </div>

      <AlertDialog open={reportOpen} onOpenChange={(o) => !reporting && setReportOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-destructive" /> Segnala un problema</AlertDialogTitle>
            <AlertDialogDescription>
              La segnalazione sarà verificata dal team Pupillo prima di incidere sulla reputazione del lavoratore. Inserisci solo informazioni veritiere.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-2">Tipo di problema *</label>
              <div className="grid gap-2">
                {INCIDENT_KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setIncidentKind(k.key)}
                    className={`text-left rounded-md border px-3 py-2 transition ${
                      incidentKind === k.key ? "border-destructive bg-destructive/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="text-sm font-medium">{k.label}</div>
                    <div className="text-[11px] text-muted-foreground">{k.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Descrizione *</label>
              <Textarea
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
                placeholder="Spiega cosa è successo (min 20 caratteri)."
                rows={3}
                maxLength={1000}
              />
              <div className="text-[11px] text-muted-foreground mt-1">{incidentDesc.trim().length}/1000</div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={reporting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!incidentKind || incidentDesc.trim().length < 20) {
                  toast.error("Compila tipo e descrizione (min 20 caratteri).");
                  return;
                }
                setReportConfirmOpen(true);
              }}
              disabled={reporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reportConfirmOpen} onOpenChange={(o) => !reporting && setReportConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l'invio della segnalazione?</AlertDialogTitle>
            <AlertDialogDescription>
              La segnalazione sarà inviata al team per la verifica. Le segnalazioni false o ripetute possono comportare sanzioni sul tuo account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reporting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReport(); }}
              disabled={reporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reporting ? "Invio…" : "Sì, invia segnalazione"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CompactStars({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5 shrink-0" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`${n} stelle`}
          >
            <Star className={`h-5 w-5 transition ${active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}