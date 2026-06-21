import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, X, Euro, ThumbsUp, ThumbsDown, Send, Handshake, Ban, Sparkles, Star, Loader2 } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  publicLocationLabel,
  canSeePreciseAddress,
  getDisplayPartnerName,
  WORKED_TOGETHER_SHIFT_STATUSES,
} from "@/lib/public-location";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { CounterofferDialog } from "@/components/CounterofferDialog";
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { useRequiredReviews } from "@/lib/required-reviews";
import { summarizeReputation, type WorkerReputationInput, levelChipClass, scoreColorClass } from "@/lib/reputation";
import { shouldShowNewApplicationCard } from "@/lib/application-card";
import { Award } from "lucide-react";
import { ConfirmedWorkerCard, type ConfirmedWorkerProfile, type ConfirmedWorkerLastReview } from "@/components/ConfirmedWorkerCard";
import { ReviewLabelsPicker, ReviewLabelsDisplay } from "@/components/ReviewLabelsPicker";
import { SaveToFavoritesPrompt } from "@/components/SaveToFavoritesPrompt";
import { WouldRehirePicker, WouldRehireBadge } from "@/components/WouldRehirePicker";
import { CREDITS_PER_HIRE } from "@/lib/pricing";
import { PROPOSAL_TEMPLATE_ID } from "@/lib/shift-proposal";
import {
  CONFIRMATION_TEMPLATE_ID,
  CONFIRMATION_ACTION,
  CONFIRMATION_EMPTY_LABELS,
  buildConfirmationBody,
  computeEntryTime,
  DEFAULT_ARRIVAL_ADVANCE_MINUTES,
} from "@/lib/shift-confirmation";
import { canAssignShift } from "@/lib/proposal-assign.functions";
import { formatDateIT, formatTariff, formatOfferDateTime, formatJobLocation } from "@/lib/format";
import { getShiftEndDate } from "@/lib/announcement-time";
import { Calendar, Clock, MapPin, Briefcase, Building2, StickyNote, AlarmClock } from "lucide-react";
import { Shirt, ListChecks, Languages as LanguagesIcon, BadgeCheck, Info, Lock, Phone, User as UserIcon, Navigation, ExternalLink } from "lucide-react";
import { ShieldAlert, Unlock } from "lucide-react";
import {
  labelOf, labelsOf,
  LICENSE_OPTIONS, LANGUAGE_OPTIONS, SKILL_OPTIONS, DRESS_CODE_OPTIONS,
} from "@/lib/announcement-requirements";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfileGate } from "@/components/ProfileGate";
import {
  ReportDelayDialog,
  CancelPresenceDialog,
  type IncidentTarget,
} from "@/components/WorkerIncidentDialogs";
import {
  computeSpecialAvailabilityBlock,
  describeSpecialAvailability,
  fetchSpecialAvailabilityBlock,
  SPECIAL_ACCEPT_INCOMPATIBLE_MESSAGE,
  type SpecialAvailabilityBlock,
} from "@/lib/worker-special-availability";
import type { AvailabilityExceptionRow } from "@/lib/availability";
import {
  checkWorkerShiftConflict,
  CONFLICT_WORKER_ACCEPT_MESSAGE,
  CONFLICT_RESTAURANT_ASSIGN_MESSAGE,
} from "@/lib/shift-conflict";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversazione — Pupillo" }] }),
  component: () => <RequireAuth><Thread /></RequireAuth>,
  // Fallback friendly se il caricamento della conversazione fallisce
  // (link rotto, RLS, errore di rete). Niente più "This page didn't load":
  // mostriamo un messaggio chiaro e un bottone per tornare alla lista.
  errorComponent: ConversationErrorFallback,
  notFoundComponent: ConversationNotFoundFallback,
});

function ConversationErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  // Logga in console per debug ma non mostra dettagli tecnici all'utente.
  console.error("[messages/$id] errorComponent:", error);
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-card p-6 text-center">
        <h1 className="text-base font-semibold">Conversazione non disponibile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non è stato possibile aprire direttamente la conversazione. Seleziona
          il messaggio dalla lista.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            to="/messages"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Vai ai messaggi
          </Link>
          <button
            type="button"
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Riprova
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationNotFoundFallback() {
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-card p-6 text-center">
        <h1 className="text-base font-semibold">Conversazione non trovata</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non è stato possibile aprire direttamente la conversazione. Seleziona
          il messaggio dalla lista.
        </p>
        <div className="mt-4">
          <Link
            to="/messages"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Vai ai messaggi
          </Link>
        </div>
      </div>
    </div>
  );
}

type Msg = {
  id: string;
  application_id: string;
  sender_id: string;
  receiver_id?: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
  template_id?: string | null;
  message_type?: "template" | "system" | string | null;
  action_type?: string | null;
};
type App = {
  id: string; status: string; restaurant_id: string; worker_id: string;
  announcement_id: string; proposed_tariff: number | null;
};
type Ann = {
  id: string;
  service_date: string;
  service_time: string;
  end_time?: string | null;
  end_date?: string | null;
  duration_hours?: number | null;
  location_address: string;
  tariff_amount: number;
  tariff_type: string;
  job_city?: string | null;
  job_province?: string | null;
  restaurant_id?: string;
  status?: string | null;
  assigned_worker_id?: string | null;
  notes?: string | null;
  professional_profile?: string | null;
  dress_code_items?: string[] | null;
  dress_code_notes?: string | null;
  required_skills?: string[] | null;
  language_requirements?: string[] | null;
  license_requirement?: string | null;
  job_access_restrictions?: string | null;
  job_additional_directions?: string | null;
  job_location_notes?: string | null;
  job_address?: string | null;
  job_contact_person_name?: string | null;
  job_contact_person_phone?: string | null;
};

type Shift = {
  id: string;
  status: string;
  shift_date: string;
  worker_id: string;
  restaurant_id: string;
  announcement_id: string | null;
  reviewed_at: string | null;
  reviewed_by_restaurant_user_id: string | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  tags: string[] | null;
  created_at: string;
  author_id: string;
  target_id: string;
  shift_id: string | null;
  punctuality?: number | null;
  professionalism?: number | null;
  competence?: number | null;
  reliability?: number | null;
  teamwork?: number | null;
  would_rehire?: "yes" | "maybe" | "no" | string | null;
  positive_tags?: string[] | null;
  negative_tags?: string[] | null;
};

type WorkerReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  shift_id: string | null;
  announcement_id: string | null;
  positive_tags: string[] | null;
  negative_tags: string[] | null;
  would_rehire: string | null;
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

type TemplateCategory =
  | "application"
  | "availability"
  | "shift_organization"
  | "dress_code_access"
  | "shift_changes"
  | "post_shift"
  | "issue_report";

type TemplateAction =
  | "none"
  | "accept_application"
  | "reject_application"
  | "confirm_shift"
  | "cancel_shift"
  | "complete_shift"
  | "withdraw_application"
  | "confirm_arrival"
  | "report_issue"
  | "instructions_acknowledged";

type MsgTemplate = {
  key: string;
  role: "restaurant" | "worker" | "both";
  category: TemplateCategory;
  text: string; // may include {{vars}}
  action: TemplateAction;
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  application: "Candidatura",
  availability: "Conferma disponibilità",
  shift_organization: "Organizzazione turno",
  dress_code_access: "Dress code e accesso",
  shift_changes: "Modifiche turno",
  post_shift: "Chiusura turno",
  issue_report: "Problemi / segnalazioni",
};

const TEMPLATES: MsgTemplate[] = [
  // Restaurant — application
  { key: "r_app_seen", role: "restaurant", category: "application", text: "Ciao, ho visto la tua candidatura.", action: "none" },
  { key: "r_app_avail", role: "restaurant", category: "application", text: "Sei disponibile per il turno del {{shift_date}} alle {{start_time}}?", action: "none" },
  { key: "r_app_exp", role: "restaurant", category: "application", text: "Hai esperienza in questo ruolo?", action: "none" },
  { key: "r_app_similar", role: "restaurant", category: "application", text: "Hai già lavorato in un locale simile?", action: "none" },
  { key: "r_app_confirm_avail", role: "restaurant", category: "application", text: "Puoi confermare la tua disponibilità?", action: "none" },
  { key: "r_app_selected", role: "restaurant", category: "application", text: "Ti abbiamo selezionato per questo turno.", action: "accept_application" },
  { key: "r_app_other", role: "restaurant", category: "application", text: "Al momento abbiamo scelto un altro candidato.", action: "reject_application" },
  // Restaurant — shift organization
  { key: "r_org_15", role: "restaurant", category: "shift_organization", text: "Presentati 15 minuti prima dell'orario di inizio.", action: "none" },
  { key: "r_org_ref", role: "restaurant", category: "shift_organization", text: "Chiedi del referente indicato nell'annuncio.", action: "none" },
  { key: "r_org_dress", role: "restaurant", category: "dress_code_access", text: "Ricorda di rispettare il dress code indicato.", action: "none" },
  { key: "r_org_tools", role: "restaurant", category: "shift_organization", text: "Porta con te gli strumenti richiesti nell'annuncio.", action: "none" },
  { key: "r_org_confirmed", role: "restaurant", category: "shift_organization", text: "Il turno del {{shift_date}} alle {{start_time}} è confermato.", action: "confirm_shift" },
  { key: "r_org_modified", role: "restaurant", category: "shift_changes", text: "Il turno è stato modificato. Controlla i dettagli.", action: "none" },
  { key: "r_org_cancelled", role: "restaurant", category: "shift_changes", text: "Il turno è stato annullato.", action: "cancel_shift" },
  // Restaurant — post shift
  { key: "r_post_thanks", role: "restaurant", category: "post_shift", text: "Grazie per il lavoro svolto.", action: "none" },
  { key: "r_post_completed", role: "restaurant", category: "post_shift", text: "Confermo che il turno è stato completato.", action: "complete_shift" },
  { key: "r_post_again", role: "restaurant", category: "post_shift", text: "Ci piacerebbe collaborare ancora con te.", action: "none" },
  { key: "r_post_review", role: "restaurant", category: "post_shift", text: "Lascia recensione", action: "none" },
  { key: "r_post_issue", role: "restaurant", category: "issue_report", text: "Segnalo un problema sul turno.", action: "report_issue" },

  // Worker — application
  { key: "w_app_interest", role: "worker", category: "application", text: "Ciao, confermo il mio interesse per il turno.", action: "none" },
  { key: "w_app_avail", role: "worker", category: "availability", text: "Sono disponibile per questo turno.", action: "none" },
  { key: "w_app_exp", role: "worker", category: "application", text: "Ho esperienza in questo ruolo.", action: "none" },
  { key: "w_app_details", role: "worker", category: "application", text: "Vorrei maggiori dettagli sul turno.", action: "none" },
  { key: "w_app_dress_read", role: "worker", category: "dress_code_access", text: "Confermo di aver letto requisiti e dress code.", action: "none" },
  { key: "w_app_withdraw", role: "worker", category: "application", text: "Non sono più disponibile per questo turno.", action: "withdraw_application" },
  // Worker — shift organization
  { key: "w_org_present", role: "worker", category: "shift_organization", text: "Confermo la mia presenza.", action: "confirm_arrival" },
  { key: "w_org_15", role: "worker", category: "shift_organization", text: "Arriverò 15 minuti prima.", action: "none" },
  { key: "w_org_access", role: "worker", category: "dress_code_access", text: "Ho letto le indicazioni di accesso.", action: "none" },
  { key: "w_org_dress", role: "worker", category: "dress_code_access", text: "Ho letto il dress code richiesto.", action: "none" },
  { key: "w_org_coming", role: "worker", category: "shift_organization", text: "Sono in arrivo.", action: "none" },
  { key: "w_org_arrived", role: "worker", category: "shift_organization", text: "Sono arrivato sul posto.", action: "none" },
  { key: "w_org_help", role: "worker", category: "issue_report", text: "Ho bisogno di chiarimenti sull'ingresso.", action: "none" },
  // Worker — post shift
  { key: "w_post_done", role: "worker", category: "post_shift", text: "Il turno è stato completato.", action: "none" },
  { key: "w_post_thanks", role: "worker", category: "post_shift", text: "Grazie per l'opportunità.", action: "none" },
  { key: "w_post_more", role: "worker", category: "post_shift", text: "Sono disponibile per altri turni.", action: "none" },
  { key: "w_post_issue", role: "worker", category: "issue_report", text: "Vorrei segnalare un problema.", action: "report_issue" },
];

function renderTemplate(text: string, ann: Ann | null, restaurantName: string | null, addressOverride?: string | null): string {
  const date = ann?.service_date ? new Date(ann.service_date).toLocaleDateString("it-IT") : "—";
  const time = ann?.service_time ? ann.service_time.slice(0, 5) : "—";
  const address = addressOverride ?? ann?.location_address ?? "—";
  return text
    .replace(/{{shift_date}}/g, date)
    .replace(/{{start_time}}/g, time)
    .replace(/{{address}}/g, address)
    .replace(/{{restaurant_name}}/g, restaurantName ?? "Locale non specificato");
}
type LogEvent = {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  metadata: { tariff?: number; note?: string; by_role?: string } | null;
};

const TERMINAL = ["accepted", "rejected", "expired", "cancelled"];

type TimelineEvent = { at: string; label: string; note?: string; tone: "neutral" | "success" | "error" };

const ACTION_LABELS: Record<string, { label: string; tone: TimelineEvent["tone"] }> = {
  created: { label: "Richiesta inviata", tone: "neutral" },
  interested: { label: "Lavoratore interessato", tone: "success" },
  not_interested: { label: "Lavoratore non interessato", tone: "error" },
  counter_offer: { label: "Controfferta inviata", tone: "neutral" },
  accepted: { label: "Lavoratore assegnato", tone: "success" },
  rejected: { label: "Candidatura rifiutata", tone: "error" },
  expired: { label: "Offerta scaduta", tone: "error" },
  cancelled: { label: "Candidatura annullata dal lavoratore", tone: "error" },
};

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function buildEventList(app: App, events: LogEvent[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  if (events.length === 0 || !events.some(e => e.action === "created")) {
    out.push({ at: (app as any).created_at ?? new Date().toISOString(), label: "Richiesta inviata", tone: "neutral" });
  }
  for (const e of events) {
    const meta = ACTION_LABELS[e.action] ?? { label: e.action, tone: "neutral" as const };
    const role = e.metadata?.by_role;
    const tariff = e.metadata?.tariff;
    const note = [
      role && `da ${role === "restaurant" ? "ristoratore" : role === "worker" ? "lavoratore" : role}`,
      tariff != null && `€${tariff}`,
      e.metadata?.note,
    ].filter(Boolean).join(" · ") || undefined;
    out.push({ at: e.created_at, label: meta.label, tone: meta.tone, note });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

type StepState = "done" | "current" | "todo" | "error";
type Step = { key: string; label: string; icon: typeof Send; state: StepState };

function buildTimeline(status?: string, opts?: { slotTakenByOther?: boolean }): Step[] {
  const s = status ?? "pending";
  const isReject = s === "rejected" || s === "not_interested";
  const slotTaken = !!opts?.slotTakenByOther && s === "rejected";
  const isCounter = s === "counter_offer";
  const isAccepted = s === "accepted";
  const isInterested = s === "interested";
  const isExpired = s === "expired";
  const isCancelled = s === "cancelled";

  const mark = (cond: boolean, isCurrent: boolean): StepState =>
    cond ? "done" : isCurrent ? "current" : "todo";

  return [
    { key: "sent", label: "Inviata", icon: Send, state: "done" },
    { key: "interest", label: "Interesse", icon: ThumbsUp,
      state: isReject ? "error" : mark(isInterested || isCounter || isAccepted, s === "pending") },
    { key: "counter", label: "Controfferta", icon: Handshake,
      state: isCounter ? "current" : (isAccepted ? "done" : "todo") },
    { key: "outcome",
      label: isCancelled ? "Annullata" : slotTaken ? "Turno assegnato ad altri" : isReject ? "Rifiutata" : isExpired ? "Scaduta" : "Assegnata",
      icon: isReject || isExpired || isCancelled ? Ban : Check,
      state: isAccepted ? "done" : (isReject || isExpired || isCancelled) ? "error" : "todo" },
  ];
}

function Thread() {
  const { id } = Route.useParams();
  const { user, role, profile, refresh: refreshAuth } = useAuth();
  const { requireComplete, ensureTargetComplete } = useProfileGate();
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  // Ritorno dal flusso Stripe → mostra banner "Pagamento completato"
  // (la conferma del lavoratore resta sempre manuale). Esegue una sola
  // volta per evitare loop di refresh, poi ripulisce il query param.
  const paymentSuccessHandledRef = useRef(false);
  useEffect(() => {
    if (paymentSuccessHandledRef.current) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("payment_success") !== "1") return;
    paymentSuccessHandledRef.current = true;
    console.info("[PUPILLO_POST_PAYMENT_CHAT_RESUME_DEBUG]", {
      restaurant_user_id: user?.id ?? null,
      chat_id: id,
      chat_opened: true,
    });
    toast.success("Pagamento completato", {
      description: "Ora puoi confermare il lavoratore per questo turno.",
    });
    url.searchParams.delete("payment_success");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  }, [id, user?.id]);
  const [counterofferOpen, setCounterofferOpen] = useState(false);
  const { isBlocked, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [creditsAvailable, setCreditsAvailable] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [app, setApp] = useState<App | null>(null);
  const [ann, setAnn] = useState<Ann | null>(null);
  const [other, setOther] = useState<{ name: string; city: string | null; neighborhood: string | null; profile_completed: boolean; phone_verified: boolean } | null>(null);
  const [otherArrivalAdvance, setOtherArrivalAdvance] = useState<number | null>(null);
  const [otherIdentity, setOtherIdentity] = useState<{ businessName: string | null; fullName: string | null; firstName: string | null } | null>(null);
  const [hasWorkedTogether, setHasWorkedTogether] = useState(false);
  const [workerRep, setWorkerRep] = useState<WorkerReputationInput | null>(null);
  const [confirmedWorker, setConfirmedWorker] = useState<ConfirmedWorkerProfile | null>(null);
  const [confirmedWorkerLastReview, setConfirmedWorkerLastReview] = useState<ConfirmedWorkerLastReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const [counterConfirmOpen, setCounterConfirmOpen] = useState(false);
  const [sendingCounter, setSendingCounter] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Popup di conferma quando il LAVORATORE clicca "Sono interessato".
  // Serve a chiarire che NON si tratta di un turno confermato, ma solo
  // di una dichiarazione di disponibilità in attesa della conferma del
  // ristoratore. Mantiene nascosti nome locale e indirizzo completo.
  const [interestConfirmOpen, setInterestConfirmOpen] = useState(false);
  const [transitioning, setTransitioning] = useState<null | "interested" | "not_interested" | "accepted" | "rejected">(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [tplCategory, setTplCategory] = useState<TemplateCategory>("application");
  const [selectedTpl, setSelectedTpl] = useState<MsgTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, "accepted" | "rejected">>({});
  // Disponibilità speciale del lavoratore per la data dell'annuncio: se
  // esiste, prevale sulla disponibilità abituale. Se non è compatibile con
  // città/orario dell'annuncio, "Accetta proposta" deve risultare bloccato.
  const [workerSpecialExceptions, setWorkerSpecialExceptions] = useState<AvailabilityExceptionRow[]>([]);
  type ProposalDebugInfo = {
    responseId: string | null;
    responseStatus: string | null;
    responseAt: string | null;
    notifications: { id: string; user_id: string; title: string; read: boolean | null; created_at: string }[];
  };
  const [proposalDebug, setProposalDebug] = useState<Record<string, ProposalDebugInfo>>({});
  const [debugOpen, setDebugOpen] = useState(true);
  const [serverAssign, setServerAssign] = useState<{ canAssign: boolean; reason: string | null } | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Recensione lasciata dal LAVORATORE al ristoratore (worker_to_restaurant).
  // Distinta da `existingReview`, che rappresenta SOLO la recensione del
  // ristoratore verso il lavoratore (restaurant_to_worker).
  const [workerToRestaurantReview, setWorkerToRestaurantReview] = useState<Review | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [cancelPresenceOpen, setCancelPresenceOpen] = useState(false);
  const [workerReviews, setWorkerReviews] = useState<WorkerReview[]>([]);
  const [reviewRoles, setReviewRoles] = useState<Record<string, string | null>>({});
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const REJECT_REASONS = [
    "Profilo non in linea con la richiesta",
    "Esperienza non sufficiente",
    "Posizione già coperta",
    "Disponibilità non compatibile",
    "Preferiamo un altro candidato",
    "Altro motivo",
  ] as const;
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevLastIdRef = useRef<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [refetchSeq, setRefetchSeq] = useState(0);
  // Paginated history (load older on scroll-up)
  const PAGE_SIZE = 30;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestRef = useRef<string | null>(null); // ISO created_at of oldest loaded msg
  const pendingPrependHeightRef = useRef<number | null>(null);

  // Worker-side reminder to acknowledge the operational instructions after
  // the restaurant has confirmed the shift. Shown once per conversation
  // until the worker either confirms or dismisses; reopens automatically if
  // they navigate back and still haven't acknowledged.
  const [instructionsReminderOpen, setInstructionsReminderOpen] = useState(false);
  const [ackDialogBusy, setAckDialogBusy] = useState(false);
  const reminderShownForRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data: a, error: appError } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      if (appError) toast.error(appError.message);
      setApp(a as App | null);
      if (!a) {
        setNotFound(true);
        setMsgs([]);
        setLoading(false);
        return;
      }
      if (a) {
        const otherId = a.restaurant_id === user?.id ? a.worker_id : a.restaurant_id;
        setOtherId(otherId);
        const [{ data: p }, { data: an }] = await Promise.all([
          // NOTE: `id_document_path` and other PII are denied to authenticated
          // at the column-grant level — never select them cross-user here.
          supabase.from("profiles").select("full_name, first_name, last_name, business_name, city, neighborhood, reputation_score, reputation_level, completed_shifts, no_show_count, punctuality_pct, completion_pct, rehire_restaurants_count, rehire_yes_count, rehire_total_answers, distinct_restaurants_count, rating_avg, reviews_count, avatar_url, phone_verified, profile_completed, default_arrival_advance_minutes, phone_full, phone, primary_role, professional_profile, badge, is_deleted").eq("id", otherId).maybeSingle(),
          supabase.from("announcements").select("id, service_date, service_time, end_time, end_date, duration_hours, location_address, tariff_amount, tariff_type, job_city, job_province, restaurant_id, status, assigned_worker_id, notes, professional_profile, dress_code_items, dress_code_notes, required_skills, language_requirements, license_requirement, job_access_restrictions, job_additional_directions, job_location_notes, job_address").eq("id", a.announcement_id).maybeSingle(),
        ]);
        // Contact person is restricted at the DB level. Fetch via the
        // SECURITY DEFINER RPC: it returns the row only if the caller is
        // the owning restaurant or the assigned worker.
        try {
          const { data: contactRows } = await supabase.rpc("get_announcement_contact", {
            _announcement_id: a.announcement_id,
          });
          const contact = Array.isArray(contactRows) ? contactRows[0] : contactRows;
          if (an && contact) {
            (an as any).job_contact_person_name = (contact as any).job_contact_person_name ?? null;
            (an as any).job_contact_person_phone = (contact as any).job_contact_person_phone ?? null;
          }
        } catch {
          // Non-owner / non-assigned: contact stays hidden.
        }
        setOther({
          name: p?.business_name || p?.full_name || "Utente",
          city: (p as any)?.city ?? null,
          neighborhood: (p as any)?.neighborhood ?? null,
          profile_completed: !!(p as any)?.profile_completed,
          phone_verified: !!(p as any)?.phone_verified,
        });
        setOtherArrivalAdvance(
          typeof (p as any)?.default_arrival_advance_minutes === "number"
            ? (p as any).default_arrival_advance_minutes
            : null,
        );
        setOtherIdentity({
          businessName: (p as any)?.business_name ?? null,
          fullName: (p as any)?.full_name ?? null,
          firstName: (p as any)?.first_name ?? null,
        });
        // Privacy gate: detect any past confirmed shift between the two parties.
        try {
          const { data: priorShifts } = await supabase
            .from("shifts")
            .select("id")
            .eq("worker_id", a.worker_id)
            .eq("restaurant_id", a.restaurant_id)
            .in("status", [...WORKED_TOGETHER_SHIFT_STATUSES])
            .limit(1);
          setHasWorkedTogether(((priorShifts ?? []) as any[]).length > 0);
        } catch {
          setHasWorkedTogether(false);
        }
        setWorkerRep((p as WorkerReputationInput | null) ?? null);
        // Privacy-unlocked worker card data (shown to the restaurant only
        // after final confirmation). We always populate it from the same
        // profile fetch but only render it when role === "restaurant" and
        // the application status is "accepted".
        if (role === "restaurant" && a.worker_id) {
          const pp = (p as any) ?? {};
          setConfirmedWorker({
            id: a.worker_id,
            full_name: pp.full_name ?? null,
            first_name: pp.first_name ?? null,
            last_name: pp.last_name ?? null,
            primary_role: pp.primary_role ?? null,
            professional_profile: pp.professional_profile ?? null,
            badge: pp.badge ?? null,
            rating_avg: pp.rating_avg ?? null,
            reviews_count: pp.reviews_count ?? null,
            completed_shifts: pp.completed_shifts ?? null,
            phone_verified: !!pp.phone_verified,
            profile_completed: !!pp.profile_completed,
            id_document_path: pp.id_document_path ?? null,
            is_deleted: !!pp.is_deleted,
            phone_full: pp.phone_full ?? null,
            phone: pp.phone ?? null,
          });
          try {
            const { data: rev } = await supabase
              .from("reviews")
              .select("rating, comment, created_at, is_visible_to_restaurants")
              .eq("target_id", a.worker_id)
              .eq("is_visible_to_restaurants", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            setConfirmedWorkerLastReview(
              rev ? { rating: (rev as any).rating, comment: (rev as any).comment, created_at: (rev as any).created_at } : null,
            );
          } catch {
            setConfirmedWorkerLastReview(null);
          }
        } else {
          setConfirmedWorker(null);
          setConfirmedWorkerLastReview(null);
        }
        setAnn(an as Ann | null);
        // Se il ruolo è "worker" e l'annuncio ha una data, carico le
        // disponibilità speciali del lavoratore per quella data. Servono per
        // bloccare "Accetta proposta" se la disponibilità speciale non è
        // compatibile con città/orario del turno.
        if (user?.id === a.worker_id && (an as any)?.service_date) {
          const { data: excs } = await supabase
            .from("worker_availability_exceptions")
            .select("id, worker_id, date, is_available, time_slot, start_time, end_time, notes, city, province, district, latitude, longitude, radius_km")
            .eq("worker_id", a.worker_id)
            .eq("date", (an as any).service_date);
          setWorkerSpecialExceptions((excs as AvailabilityExceptionRow[] | null) ?? []);
        } else {
          setWorkerSpecialExceptions([]);
        }
        // Carica recensioni del lavoratore per il ristoratore (privacy: solo
        // recensioni verificate, collegate a turni reali, visibili ai ristoratori).
        const workerTargetId = a.worker_id;
        if (workerTargetId && user?.id === a.restaurant_id) {
          const { data: revs } = await supabase
            .from("reviews")
            .select("id, rating, comment, created_at, shift_id, announcement_id, positive_tags, negative_tags, would_rehire")
            .eq("target_id", workerTargetId)
            .eq("is_visible_to_restaurants", true)
            .not("shift_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(50);
          const list = (revs as WorkerReview[]) ?? [];
          setWorkerReviews(list);
          const annIds = Array.from(new Set(list.map(r => r.announcement_id).filter(Boolean))) as string[];
          if (annIds.length) {
            const { data: anns } = await supabase
              .from("announcements")
              .select("id, professional_profile")
              .in("id", annIds);
            const map: Record<string, string | null> = {};
            (anns ?? []).forEach((row: any) => { map[row.id] = row.professional_profile ?? null; });
            setReviewRoles(map);
          } else {
            setReviewRoles({});
          }
        } else {
          setWorkerReviews([]);
          setReviewRoles({});
        }
      }
      // Load only the most recent PAGE_SIZE messages; older ones are paged in on scroll-up.
      const { data: mDesc } = await supabase
        .from("messages")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      const descRows = (mDesc as Msg[]) ?? [];
      const more = descRows.length > PAGE_SIZE;
      const page = (more ? descRows.slice(0, PAGE_SIZE) : descRows).slice().reverse();
      setMsgs(page);
      setHasMore(more);
      oldestRef.current = page[0]?.created_at ?? null;
      // Reset bottom-stick anchor on (re)load.
      prevLastIdRef.current = page[page.length - 1]?.id ?? null;
      const m = page;
      // Per-proposal responses (decoupled from app.status so each
      // proposal card has its own accepted/rejected state).
      const proposalIds = ((m as Msg[]) ?? [])
        .filter((x) => x.template_id === PROPOSAL_TEMPLATE_ID)
        .map((x) => x.id);
      if (proposalIds.length) {
        const { data: resp } = await supabase
          .from("proposal_responses")
          .select("message_id, status, created_at")
          .in("message_id", proposalIds);
        const map: Record<string, "accepted" | "rejected"> = {};
        (resp ?? []).forEach((r: any) => { map[r.message_id] = r.status; });
        setProposalStatuses(map);
      } else {
        setProposalStatuses({});
      }
      // Mark received messages as read
      if (user) {
        const unreadIds = ((m as Msg[]) ?? [])
          .filter((x) => x.sender_id !== user.id && !x.read_at)
          .map((x) => x.id);
        if (unreadIds.length) {
          await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
        }
      }
      const { data: ev } = await supabase.from("activity_logs")
        .select("*").eq("entity_type", "application").eq("entity_id", id)
        .order("created_at");
      setEvents((ev as LogEvent[]) ?? []);
      // Carica turno collegato e recensione esistente
      if (a) {
        const { data: sh } = await supabase
          .from("shifts")
          .select("id, status, shift_date, worker_id, restaurant_id, announcement_id, reviewed_at, reviewed_by_restaurant_user_id")
          .eq("announcement_id", (a as any).announcement_id)
          .eq("worker_id", (a as any).worker_id)
          .eq("restaurant_id", (a as any).restaurant_id)
          .maybeSingle();
        setShift((sh as Shift | null) ?? null);
        if (sh && user) {
          // Recupera ENTRAMBE le direzioni di recensione per il turno:
          //   - restaurant_to_worker  (esistente: `existingReview`)
          //   - worker_to_restaurant  (nuovo:    `workerToRestaurantReview`)
          // Usare un'unica query "qualsiasi recensione del turno" porta al
          // bug per cui lato ristoratore appare "Recensione inviata" non
          // appena il LAVORATORE invia la sua recensione.
          const reviewCols = "id, rating, comment, tags, created_at, author_id, target_id, shift_id, punctuality, professionalism, competence, reliability, teamwork, would_rehire, positive_tags, negative_tags";
          const restaurantId = (sh as any).restaurant_id as string;
          const workerId = (sh as any).worker_id as string;
          const [{ data: rRev }, { data: wRev }] = await Promise.all([
            supabase
              .from("reviews")
              .select(reviewCols)
              .eq("shift_id", (sh as any).id)
              .eq("author_id", restaurantId)
              .eq("target_id", workerId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("reviews")
              .select(reviewCols)
              .eq("shift_id", (sh as any).id)
              .eq("author_id", workerId)
              .eq("target_id", restaurantId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
          setExistingReview((rRev as Review | null) ?? null);
          setWorkerToRestaurantReview((wRev as Review | null) ?? null);
          if (typeof console !== "undefined") {
            console.log("[PUPILLO_REVIEW_DIRECTION_CHECK]", {
              shift_id: (sh as any).id,
              restaurant_to_worker_review_id: (rRev as any)?.id ?? null,
              worker_to_restaurant_review_id: (wRev as any)?.id ?? null,
              viewer_role: role,
            });
          }
        }
      }
      setLoading(false);
    })();
    const ch = supabase.channel(`thread-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `application_id=eq.${id}` },
        (p) => {
          const m = p.new as Msg;
          setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          // Auto-mark as read if I'm the recipient and the chat is open
          if (user && m.sender_id !== user.id && !m.read_at) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `application_id=eq.${id}` },
        (p) => {
          const m = p.new as Msg;
          setMsgs(prev => {
            const idx = prev.findIndex(x => x.id === m.id);
            if (idx === -1) return prev;
            const cur = prev[idx];
            if (cur.body === m.body && cur.read_at === m.read_at && cur.action_type === m.action_type) return prev;
            const next = prev.slice();
            next[idx] = { ...cur, ...m };
            return next;
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` },
        (p) => {
          const next = p.new as App;
          setApp(prev => {
            if (!prev) return next;
            if (prev.status === next.status && prev.proposed_tariff === next.proposed_tariff) return prev;
            return { ...prev, ...next };
          });
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `entity_id=eq.${id}` },
        (p) => { const ev = p.new as LogEvent; setEvents(prev => prev.some(x => x.id === ev.id) ? prev : [...prev, ev]); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proposal_responses", filter: `application_id=eq.${id}` },
        (p) => {
          const r = p.new as { message_id: string; status: "accepted" | "rejected" };
          setProposalStatuses(prev => prev[r.message_id] === r.status ? prev : { ...prev, [r.message_id]: r.status });
        })
      .subscribe((status) => {
        // On transient error / timeout, trigger a refetch. NOTE: do NOT trigger
        // on "CLOSED" — removeChannel() in the effect cleanup emits CLOSED,
        // which would bump refetchSeq, re-run this effect, remove the new
        // channel, fire CLOSED again, and so on — causing the chat to
        // continuously reload/flicker.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setTimeout(() => setRefetchSeq((s) => s + 1), 1500);
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [id, user?.id, refetchSeq]);

  // Admin debug: fetch proposal_responses + related notifications for each
  // proposal message so admins can see where the flow breaks.
  useEffect(() => {
    if (role !== "admin") { setProposalDebug({}); return; }
    const proposalMsgs = msgs.filter((m) => m.template_id === PROPOSAL_TEMPLATE_ID);
    if (proposalMsgs.length === 0) { setProposalDebug({}); return; }
    let cancelled = false;
    (async () => {
      const msgIds = proposalMsgs.map((m) => m.id);
      const [respRes, notifRes] = await Promise.all([
        supabase
          .from("proposal_responses")
          .select("id, message_id, status, created_at")
          .in("message_id", msgIds),
        supabase
          .from("notifications")
          .select("id, user_id, title, read, created_at, link")
          .eq("link", `/messages/${id}`)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      const respByMsg: Record<string, { id: string; status: string; created_at: string }> = {};
      (respRes.data ?? []).forEach((r: any) => { respByMsg[r.message_id] = r; });
      const notifs = (notifRes.data ?? []) as any[];
      const out: Record<string, ProposalDebugInfo> = {};
      for (const m of proposalMsgs) {
        const r = respByMsg[m.id];
        // Match notifications created within +/- 10 minutes of the message
        const msgT = new Date(m.created_at).getTime();
        const related = notifs.filter((n) => Math.abs(new Date(n.created_at).getTime() - msgT) < 10 * 60_000);
        out[m.id] = {
          responseId: r?.id ?? null,
          responseStatus: r?.status ?? null,
          responseAt: r?.created_at ?? null,
          notifications: related.map((n) => ({ id: n.id, user_id: n.user_id, title: n.title, read: n.read, created_at: n.created_at })),
        };
      }
      setProposalDebug(out);
    })();
    return () => { cancelled = true; };
  }, [role, id, msgs, proposalStatuses]);

  // Smart auto-scroll: only react when the LAST message changes (i.e. a
  // new message was appended at the bottom). When older messages are
  // prepended via pagination, the last message id stays the same and we
  // skip the bottom-stick logic entirely.
  useEffect(() => {
    const last = msgs[msgs.length - 1];
    const lastId = last?.id ?? null;
    if (lastId === prevLastIdRef.current) return;
    const isFirstLoad = prevLastIdRef.current === null;
    prevLastIdRef.current = lastId;
    if (isFirstLoad) {
      // Jump to bottom on first render of the thread (no smooth scroll).
      endRef.current?.scrollIntoView({ block: "end" });
      return;
    }
    const mine = last && user && last.sender_id === user.id;
    if (nearBottomRef.current || mine) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewCount(0);
    } else {
      setNewCount((n) => n + 1);
    }
  }, [msgs, user]);

  // Preserve scroll position after prepending older messages.
  useLayoutEffect(() => {
    const pending = pendingPrependHeightRef.current;
    const el = scrollRef.current;
    if (pending == null || !el) return;
    el.scrollTop = el.scrollHeight - pending;
    pendingPrependHeightRef.current = null;
  }, [msgs]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore || !oldestRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    setLoadingMore(true);
    // Capture distance from the top so we can restore the same anchor after prepend.
    pendingPrependHeightRef.current = el.scrollHeight - el.scrollTop;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("application_id", id)
      .lt("created_at", oldestRef.current)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);
    const descRows = (data as Msg[]) ?? [];
    const more = descRows.length > PAGE_SIZE;
    const older = (more ? descRows.slice(0, PAGE_SIZE) : descRows).slice().reverse();
    if (older.length === 0) {
      setHasMore(false);
      pendingPrependHeightRef.current = null;
    } else {
      setMsgs((prev) => {
        const have = new Set(prev.map((x) => x.id));
        const fresh = older.filter((x) => !have.has(x.id));
        if (fresh.length === 0) return prev;
        return [...fresh, ...prev];
      });
      setHasMore(more);
      oldestRef.current = older[0]?.created_at ?? oldestRef.current;
    }
    setLoadingMore(false);
  };

  const pushMessage = (message: Msg) => {
    setMsgs(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
  };

  // Hoisted so both the in-chat ConfirmationCard button and the reminder
  // popup can trigger the same flow.
  const acknowledgeInstructions = async () => {
    if (!user || !app) return;
    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
    if (!receiverId) return;
    const body = "Ho confermato di aver letto le istruzioni del servizio.";
    const createdAt = new Date().toISOString();
    const { data, error } = await supabase.from("messages").insert({
      application_id: app.id,
      sender_id: user.id,
      receiver_id: receiverId,
      body,
      created_at: createdAt,
      read_at: null,
      template_id: null,
      message_type: "template",
      action_type: "instructions_acknowledged",
    } as never).select("*").single();
    if (error) {
      toast.error("Impossibile registrare la presa visione.");
      return;
    }
    if (data) pushMessage(data as Msg);
    await supabase.from("applications").update({
      last_message_preview: body,
      last_message_at: createdAt,
    } as never).eq("id", app.id);
    toast.success("Istruzioni confermate");
    setInstructionsReminderOpen(false);
    try {
      await supabase.from("notifications").insert({
        user_id: receiverId,
        title: "Istruzioni confermate",
        body: "Il lavoratore ha confermato la lettura delle istruzioni del servizio.",
        link: `/messages/${app.id}`,
      } as never);
    } catch (e) {
      console.error("[ack] notify restaurant failed", e);
    }
  };

  // Open the instructions reminder popup for the worker when the chat is for
  // a confirmed shift, the operational instructions card is in chat, and the
  // worker hasn't acknowledged yet. We check the DB directly (not the
  // paginated `msgs` list) so the popup stays hidden even if the ack message
  // is older than the loaded page.
  useEffect(() => {
    if (role !== "worker") return;
    if (!app || app.status !== "accepted") return;
    const confirmationMsg = msgs.find(m => m.template_id === CONFIRMATION_TEMPLATE_ID);
    if (!confirmationMsg) return;
    // Skip if the announcement is cancelled / closed / expired.
    const annStatus = (ann as any)?.status;
    if (annStatus && annStatus !== "active" && annStatus !== "assigned" && annStatus !== "confirmed") return;
    // Skip if the shift has already ended.
    if (ann?.service_date) {
      const d = new Date(ann.service_date);
      if (ann.end_time) {
        const [h, mn] = String(ann.end_time).split(":").map(Number);
        d.setHours(h || 0, mn || 0, 0, 0);
      } else {
        d.setHours(23, 59, 59, 999);
      }
      if (d.getTime() < Date.now()) return;
    }
    if (reminderShownForRef.current === id) return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("application_id", id)
        .eq("action_type", "instructions_acknowledged");
      if (cancelled) return;
      if (error) {
        console.error("[ack] check failed", error);
        return;
      }
      if ((count ?? 0) > 0) {
        // Already acknowledged in DB — never show the popup again.
        reminderShownForRef.current = id;
        return;
      }
      reminderShownForRef.current = id;
      setInstructionsReminderOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, app, msgs, ann, id]);

  const insertSystemMessage = async (text: string, actionType?: TemplateAction) => {
    if (!user || !app) return;
    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
    const createdAt = new Date().toISOString();
    const { data, error } = await supabase.from("messages").insert({
      application_id: id,
      sender_id: user.id,
      receiver_id: receiverId,
      body: `⚙️ Sistema: ${text}`,
      created_at: createdAt,
      read_at: null,
      template_id: null,
      message_type: "system",
      action_type: actionType ?? null,
    } as never).select("*").single();
    if (error) throw error;
    if (data) pushMessage(data as Msg);
  };

  // Inserisce UN SOLO messaggio combinato "Turno chiuso e recensione ricevuta"
  // in chat, evitando duplicati se già presente per la stessa application.
  const SHIFT_REVIEW_TEMPLATE_ID = "shift_closed_with_review";
  const insertShiftClosedWithReview = async () => {
    if (!user || !app) return;
    // Anti-duplicato lato client: se esiste già il messaggio combinato per
    // questa conversazione, non crearne un altro.
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("application_id", id)
      .eq("template_id", SHIFT_REVIEW_TEMPLATE_ID)
      .limit(1)
      .maybeSingle();
    if (existing) return;
    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
    const createdAt = new Date().toISOString();
    const { data, error } = await supabase.from("messages").insert({
      application_id: id,
      sender_id: user.id,
      receiver_id: receiverId,
      body: "Turno chiuso e recensione ricevuta",
      created_at: createdAt,
      read_at: null,
      template_id: SHIFT_REVIEW_TEMPLATE_ID,
      message_type: "system",
      action_type: "complete_shift",
    } as never).select("*").single();
    if (error) throw error;
    if (data) pushMessage(data as Msg);
  };

  const sendTemplate = async () => {
    // legacy template sender kept for internal flows; UI uses free text
    if (sending) return;
    if (!app) {
      toast.error("Seleziona una conversazione prima di inviare un messaggio.");
      return;
    }
    if (!selectedTpl) {
      toast.error("Seleziona un messaggio da inviare.");
      return;
    }
    if (!user) {
      toast.error("Accedi per inviare un messaggio.");
      return;
    }
    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
    if (!receiverId || receiverId === user.id) {
      toast.error("Seleziona una conversazione prima di inviare un messaggio.");
      return;
    }
    setSending(true);
    try {
      // Caso speciale: "Lascia recensione" apre solo il blocco recensione
      if (selectedTpl.key === "r_post_review") {
        setTplCategory("post_shift");
        setReviewOpen(true);
        setSelectedTpl(null);
        setSending(false);
        // scroll verso il blocco recensione
        setTimeout(() => {
          document.getElementById("review-block")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
        return;
      }
      const body = renderTemplate(selectedTpl.text, ann, venueName ?? null, displayAddress);
      const createdAt = new Date().toISOString();
      const actionType = selectedTpl.action === "none" ? null : selectedTpl.action;
      const { data, error } = await supabase.from("messages").insert({
        application_id: app.id,
        sender_id: user.id,
        receiver_id: receiverId,
        body,
        created_at: createdAt,
        read_at: null,
        template_id: selectedTpl.key,
        message_type: "template",
        action_type: actionType,
      } as never).select("*").single();
      if (error) throw error;
      if (data) pushMessage(data as Msg);

      const { error: conversationError } = await supabase.from("applications").update({
        last_message_preview: body,
        last_message_at: createdAt,
      } as never).eq("id", app.id);
      if (conversationError) throw conversationError;

      // Trigger collegate alle azioni
      switch (selectedTpl.action) {
        case "accept_application":
          if (role === "restaurant") {
            await transition("accepted");
            await insertSystemMessage("candidatura accettata.", selectedTpl.action);
          }
          break;
        case "reject_application":
          if (role === "restaurant") {
            await transition("rejected");
            await insertSystemMessage("candidatura rifiutata.", selectedTpl.action);
          }
          break;
        case "withdraw_application":
          if (role === "worker") {
            await transition("not_interested");
            await insertSystemMessage("candidatura ritirata.", selectedTpl.action);
          }
          break;
        case "confirm_shift":
          if (app?.announcement_id) {
            const { error: shiftError } = await supabase.from("shifts").update({ status: "scheduled" })
              .eq("announcement_id", app.announcement_id);
            if (shiftError) throw shiftError;
            await insertSystemMessage("turno confermato.", selectedTpl.action);
          }
          break;
        case "cancel_shift":
          if (app?.announcement_id) {
            const { error: shiftError } = await supabase.from("shifts").update({ status: "cancelled" })
              .eq("announcement_id", app.announcement_id);
            if (shiftError) throw shiftError;
            await insertSystemMessage("turno annullato.", selectedTpl.action);
          }
          break;
        case "complete_shift":
          if (app?.announcement_id) {
            const { error: shiftError } = await supabase.from("shifts").update({ status: "completed" })
              .eq("announcement_id", app.announcement_id);
            if (shiftError) throw shiftError;
            await insertSystemMessage("turno completato.", selectedTpl.action);
          }
          break;
        case "confirm_arrival":
          await insertSystemMessage("il lavoratore ha confermato la presenza.", selectedTpl.action);
          break;
        case "report_issue":
          await insertSystemMessage("è stato segnalato un problema sul turno.", selectedTpl.action);
          break;
      }
      setSelectedTpl(null);
      toast.success("Messaggio inviato.");
    } catch (error) {
      console.error("Errore invio messaggio template", error);
      toast.error("Errore durante l’invio del messaggio. Riprova.");
    } finally {
      setSending(false);
    }
  };

  const sendFreeMessage = async () => {
    if (sending) return;
    if (!app) {
      toast.error("Seleziona una conversazione prima di inviare un messaggio.");
      return;
    }
    if (!user) {
      toast.error("Accedi per inviare un messaggio.");
      return;
    }
    const body = composerText.trim();
    if (!body) return;
    if (body.length > 2000) {
      toast.error("Il messaggio è troppo lungo (massimo 2000 caratteri).");
      return;
    }
    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
    if (!receiverId || receiverId === user.id) {
      toast.error("Seleziona una conversazione prima di inviare un messaggio.");
      return;
    }
    if (other && !ensureTargetComplete(other.profile_completed)) return;
    setSending(true);
    try {
      const createdAt = new Date().toISOString();
      const { data, error } = await supabase.from("messages").insert({
        application_id: app.id,
        sender_id: user.id,
        receiver_id: receiverId,
        body,
        created_at: createdAt,
        read_at: null,
        template_id: null,
        message_type: "user",
        action_type: null,
      } as never).select("*").single();
      if (error) throw error;
      if (data) pushMessage(data as Msg);
      const { error: conversationError } = await supabase.from("applications").update({
        last_message_preview: body,
        last_message_at: createdAt,
      } as never).eq("id", app.id);
      if (conversationError) throw conversationError;
      setComposerText("");
    } catch (error) {
      console.error("Errore invio messaggio", error);
      toast.error("Errore durante l'invio del messaggio. Riprova.");
    } finally {
      setSending(false);
    }
  };

  const transition = async (
    next: "interested" | "not_interested" | "accepted" | "rejected",
    extra?: Record<string, unknown>,
  ) => {
    if (!app || !user) return;
    if (transitioning) return;
    setTransitioning(next);
    try {
    // Charge credits to the restaurant only on shift assignment confirmation.
    if (next === "accepted" && role === "restaurant" && app.status !== "accepted") {
      // ── Pre-validazioni lato client (il backend resta autorità finale via RLS/triggers).
      // Logghiamo sempre il contesto tecnico per facilitare il debug, senza esporre nulla all'utente.
      const techCtx = {
        application_id: app.id,
        announcement_id: app.announcement_id,
        restaurant_id: app.restaurant_id,
        worker_id: app.worker_id,
        app_status_before: app.status,
        ann_status: ann?.status ?? null,
        shift_status: shift?.status ?? null,
      };
      console.info("[accept-candidature] click", techCtx);

      // La candidatura deve essere ancora processabile.
      if (app.status !== "pending" && app.status !== "interested" && app.status !== "counter_offer") {
        toast.error("Questa candidatura non è più disponibile.");
        return;
      }
      // L'annuncio non deve essere annullato/concluso/assegnato in modo completo.
      if (ann && (ann.status === "cancelled" || ann.status === "completed")) {
        toast.error("Questa candidatura non è più disponibile.");
        return;
      }
      // Il turno collegato non deve essere già annullato o concluso.
      if (shift && (shift.status === "cancelled" || shift.status === "completed")) {
        toast.error("Questa candidatura non è più disponibile.");
        return;
      }
      // Server-side authority: verify the current proposal has been accepted by the worker.
      try {
        const check = await canAssignShift({ data: { applicationId: id } });
        if (!check.canAssign) {
          console.warn("[accept-candidature] canAssignShift denied", { ...techCtx, reason: check.reason });
          toast.error(check.reason ?? "Questa candidatura non è più disponibile.");
          return;
        }
      } catch (e: any) {
        console.error("[accept-candidature] canAssignShift failed", { ...techCtx, error: e });
        toast.error("Non è stato possibile accettare la candidatura. Riprova.");
        return;
      }
      if (isBlocked) {
        setBlockOpen(true);
        return;
      }
      // PUPILLO: regola di OCCUPAZIONE — prima di scalare crediti e
      // confermare il turno, verifica che il lavoratore non abbia un altro
      // turno gia' accettato in conflitto (buffer 1h). Sicurezza contro
      // doppie conferme concorrenti tra ristoratori diversi.
      try {
        const conflict = await checkWorkerShiftConflict(
          app.worker_id as string,
          ann as any,
          { ignoreApplicationId: app.id },
        );
        if (conflict) {
          console.warn("[accept-candidature] worker busy conflict", { ...techCtx, conflictApp: conflict.applicationId });
          toast.error(CONFLICT_RESTAURANT_ASSIGN_MESSAGE);
          return;
        }
      } catch (e) {
        console.error("[accept-candidature] conflict precheck failed", e);
      }
      // Pre-check credits to show a premium dialog instead of a generic toast.
      const { data: prof } = await supabase
        .from("profiles")
        .select("credits, plan")
        .eq("id", user.id)
        .maybeSingle();
      const balance = prof?.credits ?? profile?.credits ?? 0;
      const isPaid = (prof?.plan ?? profile?.plan) === "pro" || (prof?.plan ?? profile?.plan) === "business";
      if (!isPaid && balance < CREDITS_PER_HIRE) {
        console.info("[accept-candidature] insufficient credits", { ...techCtx, balance, required: CREDITS_PER_HIRE });
        setCreditsAvailable(balance);
        setInsufficientOpen(true);
        return;
      }
      // Use the application id as the idempotency key: one application
      // == one worker assignment, so the same shift can never be charged twice.
      const { consumeCredits } = await import("@/lib/credits");
      const ok = await consumeCredits(CREDITS_PER_HIRE, "assign_worker", app.id);
      if (!ok) {
        console.warn("[accept-candidature] consumeCredits returned false", techCtx);
        return;
      }
      // Refresh auth profile so the credit counter in the UI reflects the new balance.
      try { await refreshAuth?.(); } catch (e) { console.warn("[accept-candidature] refresh profile failed", e); }
      // Privacy unlock debug log — captures the credit + privacy state at the
      // exact moment the restaurant confirms the worker.
      try {
        const { data: balAfter } = await supabase
          .from("profiles").select("credits").eq("id", user.id).maybeSingle();
        const { data: wp } = await supabase
          .from("profiles")
          .select("first_name,last_name,phone_full,phone,phone_verified")
          .eq("id", app.worker_id)
          .maybeSingle();
        const wp2: any = wp ?? {};
        console.info("[PUPILLO_WORKER_PRIVACY_UNLOCK_AFTER_CONFIRM_DEBUG]", {
          restaurant_user_id: app.restaurant_id,
          worker_user_id: app.worker_id,
          proposal_id: app.id,
          shift_id: shift?.id ?? null,
          announcement_id: app.announcement_id,
          status_before: app.status,
          status_after: "accepted",
          credits_before: balance,
          credits_required: CREDITS_PER_HIRE,
          credits_after: (balAfter as any)?.credits ?? null,
          credit_transaction_created: true,
          privacy_unlocked: true,
          worker_first_name: wp2.first_name ?? null,
          worker_last_name: wp2.last_name ?? null,
          worker_phone_present: !!(wp2.phone_full || wp2.phone),
          worker_phone_verified: !!wp2.phone_verified,
        });
      } catch (e) {
        console.warn("[PUPILLO_WORKER_PRIVACY_UNLOCK_AFTER_CONFIRM_DEBUG] log failed", e);
      }
    }
    const patch: any = { status: next, ...extra };
    if (role === "worker") patch.worker_response_at = new Date().toISOString();
    const { error } = await supabase.from("applications").update(patch).eq("id", id);
    if (error) {
      console.error("[accept-candidature] application update failed", {
        application_id: app.id,
        restaurant_id: app.restaurant_id,
        worker_id: app.worker_id,
        target_status: next,
        supabase_error: error,
      });
      if (String(error.message || "").toLowerCase().includes("announcement_full")) {
        toast.error("Questo annuncio ha già raggiunto il numero massimo di lavoratori richiesti.");
      } else if (next === "accepted" && role === "restaurant") {
        toast.error("Non è stato possibile accettare la candidatura. Riprova.");
      } else {
        toast.error("Operazione non riuscita. Riprova.");
      }
      return;
    }
    if (next === "accepted" && app.announcement_id) {
      // Multi-position aware: only mark the announcement as `assigned` (which
      // closes it) when the last open slot is taken. Always record this worker
      // as the most recent assigned_worker_id for chat-side display.
      try {
        const { data: jr } = await supabase
          .from("job_requests")
          .select("workers_needed")
          .eq("announcement_id", app.announcement_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const needed = Math.max(1, Number((jr as any)?.workers_needed ?? 1) || 1);
        const { count } = await supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("announcement_id", app.announcement_id)
          .eq("status", "accepted");
        const filled = count ?? 0;
        const becameFull = filled >= needed;
        if (becameFull) {
          await supabase.from("announcements")
            .update({ status: "assigned", assigned_worker_id: app.worker_id })
            .eq("id", app.announcement_id);
        } else {
          await supabase.from("announcements")
            .update({ assigned_worker_id: app.worker_id })
            .eq("id", app.announcement_id);
        }
      } catch (e) {
        console.error("[transition] multi-position update failed", e);
        await supabase.from("announcements")
          .update({ assigned_worker_id: app.worker_id })
          .eq("id", app.announcement_id);
      }
    }
    // Quando il ristoratore accetta la candidatura, invia automaticamente al
    // lavoratore una "Conferma turno" con tutti i dettagli operativi in chiaro.
    // Lo stesso messaggio viene inviato anche quando il lavoratore accetta la
    // proposta, così riceve subito tutti i dati operativi sbloccati.
    if (next === "accepted" && !msgs.some(mm => mm.template_id === CONFIRMATION_TEMPLATE_ID && mm.application_id === app.id)) {
      try {
        // After acceptance the worker is allowed to see the real venue name;
        // by this point the application status is "accepted" so privacy is
        // already unlocked client-side too.
        const venueName = role === "restaurant"
          ? (profile?.business_name || profile?.full_name || null)
          : (otherIdentity?.businessName || otherIdentity?.fullName || null);
        // Refetch the on-site contact person now that the application is
        // `accepted` (RLS/security-definer RPC allows the worker only at this
        // point). Without this, the worker side would build a confirmation
        // body missing "Referente: …" because the initial page-load call to
        // get_announcement_contact returned no row.
        let annForBody: typeof ann = ann;
        if (app.announcement_id) {
          try {
            const { data: contactRows } = await supabase.rpc(
              "get_announcement_contact",
              { _announcement_id: app.announcement_id },
            );
            const contact = Array.isArray(contactRows) ? contactRows[0] : contactRows;
            if (annForBody && contact) {
              annForBody = {
                ...annForBody,
                job_contact_person_name:
                  (contact as any).job_contact_person_name ?? annForBody.job_contact_person_name ?? null,
                job_contact_person_phone:
                  (contact as any).job_contact_person_phone ?? annForBody.job_contact_person_phone ?? null,
              } as typeof ann;
              setAnn(annForBody);
            }
          } catch {
            // No access yet: build with whatever we already have.
          }
        }
        const body = buildConfirmationBody(annForBody, venueName, restaurantArrivalAdvance);
        const createdAt = new Date().toISOString();
        const receiverId = role === "restaurant" ? app.worker_id : app.restaurant_id;
        const { data: confMsg } = await supabase.from("messages").insert({
          application_id: app.id,
          sender_id: user.id,
          receiver_id: receiverId,
          body,
          created_at: createdAt,
          read_at: null,
          template_id: CONFIRMATION_TEMPLATE_ID,
          message_type: "template",
          action_type: CONFIRMATION_ACTION,
        } as never).select("*").single();
        if (confMsg) pushMessage(confMsg as Msg);
        await supabase.from("applications").update({
          last_message_preview: "Proposta accettata · dettagli operativi sbloccati",
          last_message_at: createdAt,
        } as never).eq("id", app.id);
        // Worker notification is emitted by the DB trigger
        // `notify_application_status_change` to guarantee a single
        // "Candidatura confermata" message regardless of UI path.
      } catch (e) {
        console.error("[accept] confirmation message failed", e);
      }
    }
    await logEvent(next, { by_role: role ?? undefined });
    // Quando il LAVORATORE comunica il proprio interesse su una proposta del
    // ristoratore, scriviamo in chat un messaggio di sistema che chiarisce
    // che il turno NON è ancora confermato e che alcuni dati (nome locale,
    // indirizzo completo, istruzioni operative finali) saranno visibili
    // solo dopo la conferma del ristoratore. Anti-duplicato: lo inseriamo
    // solo se non esiste già un system message con lo stesso testo per
    // questa application.
    if (next === "interested" && role === "worker") {
      try {
        const noteText =
          "Hai comunicato il tuo interesse per questa proposta. " +
          "Disponibilità inviata, in attesa di conferma del ristoratore. " +
          "Quando il ristoratore confermerà il turno, potrai vedere nome del locale, indirizzo completo e istruzioni operative.";
        const already = msgs.some(
          (m) => m.message_type === "system" && typeof m.body === "string" && m.body.includes("Disponibilità inviata"),
        );
        if (!already) await insertSystemMessage(noteText);
        // Debug log: privacy-safe restaurant notification is emitted by the
        // DB trigger `notify_application_status_change` (title
        // "Candidato interessato", no worker name). The generic
        // "Nuovo messaggio da …" duplicate is suppressed for system
        // messages by `notify_new_message`.
        try {
          console.info("[PUPILLO_WORKER_INTEREST_NOTIFICATION_DEBUG]", {
            restaurant_user_id: app.restaurant_id,
            worker_user_id: app.worker_id,
            proposal_id: app.id,
            announcement_id: app.announcement_id,
            shift_id: shift?.id ?? null,
            chat_id: app.id,
            worker_status_before: app.status,
            worker_status_after: "interested",
            notification_created: true,
            notification_title: "Candidato interessato",
            notification_body:
              "Un candidato ha mostrato interesse per la tua proposta. Apri la chat per confermare il lavoratore o inviare una controfferta.",
            notification_type: "candidate_interested",
            full_name_hidden: true,
            redirect_target: `/messages/${app.id}`,
            duplicate_notification_blocked: true,
          });
        } catch {}
      } catch (e) {
        console.error("[worker-interest] system note failed", e);
      }
    }
    const isRestaurant = role === "restaurant";
    const toastByStatus: Record<string, { title: string; description: string }> = {
      interested: {
        title: "Interesse inviato",
        description: "In attesa di conferma del ristoratore.",
      },
      not_interested: {
        title: "Offerta rifiutata",
        description: "Stato candidatura: Non interessato.",
      },
      accepted: {
        title: isRestaurant ? "Candidatura accettata" : "Turno assegnato",
        description: isRestaurant
          ? "Il lavoratore ha ricevuto i dettagli del turno."
          : "Stato candidatura: Accettata.",
      },
      rejected: {
        title: "Candidatura rifiutata",
        description: "Stato candidatura: Rifiutata.",
      },
    };
    const t = toastByStatus[next];
    if (next === "accepted" && isRestaurant) {
      toast.success("Candidatura accettata correttamente.", { description: t.description });
    } else {
      toast.success(t.title, { description: t.description });
    }
    setApp({ ...app, ...patch } as App);
    } catch (err) {
      // Cattura difensiva: niente errori tecnici grezzi all'utente, ma traccia tutto in console.
      console.error("[transition] unexpected failure", {
        application_id: app?.id,
        restaurant_id: app?.restaurant_id,
        worker_id: app?.worker_id,
        target_status: next,
        error: err,
      });
      if (next === "accepted" && role === "restaurant") {
        toast.error("Non è stato possibile accettare la candidatura. Riprova.");
      } else {
        toast.error("Operazione non riuscita. Riprova.");
      }
    } finally {
      setTransitioning(null);
    }
  };

  const submitReject = async () => {
    if (!app || !user || role !== "restaurant") return;
    if (transitioning) return;
    const reason = rejectReason;
    try {
      const createdAt = new Date().toISOString();
      const body = [
        "Grazie per la tua candidatura.",
        "",
        "Per questo turno il ristoratore ha scelto di procedere diversamente.",
        "",
        `Motivazione: ${reason}`,
        "",
        "Continua a candidarti: nuove richieste vengono pubblicate ogni giorno.",
      ].join("\n");
      const { data: msg } = await supabase.from("messages").insert({
        application_id: app.id,
        sender_id: user.id,
        receiver_id: app.worker_id,
        body,
        created_at: createdAt,
        read_at: null,
        template_id: "reject_with_reason",
        message_type: "template",
        action_type: "reject_application",
      } as never).select("*").single();
      if (msg) pushMessage(msg as Msg);
      await supabase.from("applications").update({
        last_message_preview: "Candidatura rifiutata",
        last_message_at: createdAt,
      } as never).eq("id", app.id);
      await supabase.from("notifications").insert({
        user_id: app.worker_id,
        title: "Candidatura non selezionata",
        body: `Motivazione: ${reason}`,
        link: `/messages/${app.id}`,
      } as never);
    } catch (e) {
      console.error("[reject] auto message failed", e);
    }
    setRejectOpen(false);
    await transition("rejected");
  };

  const cancelApplication = async () => {
    if (!app || !user || role !== "worker" || cancelling) return;
    if (app.status !== "pending") {
      toast.error("La candidatura non può più essere annullata.");
      return;
    }
    if (shift && (shift.status === "scheduled" || shift.status === "completed")) {
      toast.error("Il turno è già confermato: non puoi più annullare la candidatura.");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: "cancelled" as never, worker_response_at: new Date().toISOString() })
        .eq("id", id);
      if (error) { toast.error(error.message); return; }
      try { await insertSystemMessage("Il lavoratore ha annullato la candidatura per il turno.", "withdraw_application"); } catch (e) { console.error(e); }
      if (app.restaurant_id) {
        try {
          // Privacy: notify the restaurant using the worker's first name only.
          const fn = (profile as any)?.first_name;
          const firstName = (fn && String(fn).trim())
            || (profile?.full_name ? String(profile.full_name).trim().split(/\s+/)[0] : "")
            || "Un lavoratore";
          const workerName = firstName;
          await supabase.from("notifications").insert({
            user_id: app.restaurant_id,
            title: "Candidatura annullata",
            body: `${workerName} ha annullato la candidatura per il turno.`,
            link: `/messages/${id}`,
          } as never);
        } catch (e) { console.error("[cancel] notify failed", e); }
      }
      await logEvent("cancelled", { by_role: "worker" });
      setApp({ ...app, status: "cancelled" } as App);
      setCancelConfirmOpen(false);
      toast.success("Candidatura annullata.");
    } finally {
      setCancelling(false);
    }
  };

  const sendCounter = async () => {
    if (sendingCounter) return;
    const v = parseFloat(counterValue);
    if (!v || v <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (!app || !user) return;
    setSendingCounter(true);
    try {
    const { error } = await supabase.from("applications").update({
      status: "counter_offer", proposed_tariff: v,
      ...(role === "worker" ? { worker_response_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("messages").insert({
      application_id: id, sender_id: user.id,
      body: `💶 Controfferta: €${v} ${ann?.tariff_type === "hourly" ? "/ora" : "a servizio"}`,
    });
    await logEvent("counter_offer", { tariff: v, by_role: role ?? undefined });
    setApp({ ...app, status: "counter_offer", proposed_tariff: v });
    setCounterOpen(false);
    setCounterValue("");
    setCounterConfirmOpen(false);
    toast.success(
      role === "worker"
        ? "Controfferta inviata correttamente. Attendi la risposta del ristoratore."
        : "Controfferta inviata"
    );
    } finally {
      setSendingCounter(false);
    }
  };

  const requestSendCounter = () => {
    const v = parseFloat(counterValue);
    if (!v || v <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (role === "worker") {
      setCounterConfirmOpen(true);
    } else {
      void sendCounter();
    }
  };

  const canChangeStatus = app ? TERMINAL.includes(app.status) === false : false;

  // Server-side authority for the "Assegna" button.
  // Re-fetches whenever proposals or per-proposal responses change.
  useEffect(() => {
    if (role !== "restaurant" || !app || !canChangeStatus) {
      setServerAssign(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await canAssignShift({ data: { applicationId: id } });
        if (!cancelled) setServerAssign({ canAssign: !!res.canAssign, reason: res.reason ?? null });
      } catch {
        if (!cancelled) setServerAssign({ canAssign: false, reason: "Verifica server non disponibile." });
      }
    })();
    return () => { cancelled = true; };
  }, [role, id, app?.status, canChangeStatus, msgs.length, JSON.stringify(proposalStatuses)]);
  // Una chat è "chiusa" e in sola lettura quando il turno/annuncio collegato è
  // in uno stato finale (concluso o annullato) oppure quando la candidatura è
  // scaduta/annullata/rifiutata. Lo storico resta visibile, ma non si possono
  // più inviare nuovi messaggi.
  const closureReason: "completed" | "cancelled" | null = useMemo(() => {
    if (shift?.status === "completed") return "completed";
    if (shift?.status === "cancelled") return "cancelled";
    if (ann?.status === "completed") return "completed";
    if (ann?.status === "cancelled") return "cancelled";
    if (app?.status === "expired") return "cancelled";
    if (app?.status === "cancelled") return "cancelled";
    if (app?.status === "rejected") return "cancelled";
    // Time-based closure: il turno è assegnato (shift esiste e non è
    // annullato) e la fine effettiva del turno è già passata. La chat passa
    // in sola lettura per entrambi i ruoli, lo storico resta visibile.
    if (shift && shift.status !== "cancelled" && ann) {
      const end = getShiftEndDate(ann);
      if (end && end.getTime() < Date.now()) {
        if (typeof window !== "undefined") {
          console.log("[PUPILLO_CHAT_DISABLED_AFTER_SHIFT_END]", {
            application_id: app?.id ?? null,
            shift_id: shift.id,
            end: end.toISOString(),
          });
        }
        return "completed";
      }
    }
    return null;
  }, [shift, ann, app?.status, app?.id]);
  const isConversationClosed = closureReason !== null;
  const closureNoticeText = closureReason === "completed"
    ? "Questo turno è stato concluso. La chat è disponibile solo come storico."
    : "Questo turno è stato annullato. La chat è disponibile solo come storico.";
  useEffect(() => {
    if (!isConversationClosed || !app) return;
    if (typeof window === "undefined") return;
    if (role === "worker") {
      console.log("[PUPILLO_WORKER_READONLY_CHAT_OPEN]", {
        application_id: app.id,
        shift_id: shift?.id ?? null,
        closure: closureReason,
      });
      console.log("[PUPILLO_WORKER_CHAT_INPUT_DISABLED_AFTER_SHIFT_END]", {
        application_id: app.id,
      });
    }
  }, [isConversationClosed, app?.id, role, shift?.id, closureReason]);
  const closureSystemTemplateId = closureReason === "completed"
    ? "chat_closed_completed"
    : "chat_closed_cancelled";
  const closureSystemBody = closureReason === "completed"
    ? "Il turno è stato concluso. Questa chat è ora disponibile solo come storico."
    : "Il turno è stato annullato. Questa chat è ora disponibile solo come storico.";

  // Anti-duplicato: inserisce UNA sola volta il messaggio di sistema di
  // chiusura nella chat. Idempotente lato client (controllo in-memory dei
  // messaggi caricati) e lato server (chiave template_id + select prima
  // dell'insert). Funziona indipendentemente da dove è stata triggerata
  // la chiusura (pagina turno, annullamento annuncio, chat).
  const closureInsertedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !app || !closureReason) return;
    const alreadyInMsgs = msgs.some(
      (m) => m.template_id === "chat_closed_completed" || m.template_id === "chat_closed_cancelled",
    );
    if (alreadyInMsgs) return;
    const key = `${app.id}:${closureSystemTemplateId}`;
    if (closureInsertedRef.current === key) return;
    closureInsertedRef.current = key;
    (async () => {
      try {
        const { data: existing } = await supabase
          .from("messages")
          .select("id")
          .eq("application_id", app.id)
          .in("template_id", ["chat_closed_completed", "chat_closed_cancelled"])
          .limit(1)
          .maybeSingle();
        if (existing) return;
        const receiverId = app.restaurant_id === user.id ? app.worker_id : app.restaurant_id;
        const createdAt = new Date().toISOString();
        const { data, error } = await supabase.from("messages").insert({
          application_id: app.id,
          sender_id: user.id,
          receiver_id: receiverId,
          body: closureSystemBody,
          created_at: createdAt,
          read_at: null,
          template_id: closureSystemTemplateId,
          message_type: "system",
          action_type: null,
        } as never).select("*").single();
        if (error) {
          // Non bloccante: la chat resta comunque chiusa lato UI/DB.
          console.warn("[chat-closure] insert system message failed", error);
          return;
        }
        if (data) pushMessage(data as Msg);
      } catch (e) {
        console.warn("[chat-closure] unexpected error", e);
      }
    })();
  }, [user, app, closureReason, closureSystemTemplateId, closureSystemBody, msgs]);
  const currentTariff = app?.proposed_tariff ?? ann?.tariff_amount;

  const canSeeAddress = canSeePreciseAddress({
    isOwner: !!(user && app && app.restaurant_id === user.id),
    isAdmin: role === "admin",
    applicationStatus: app?.status ?? null,
  });
  // Minutes the worker must show up before service_time. When the viewer is
  // the restaurant we read it from their own profile; when the viewer is the
  // worker we read it from the partner (restaurant) profile.
  const restaurantArrivalAdvance: number | null = role === "restaurant"
    ? (typeof (profile as any)?.default_arrival_advance_minutes === "number"
        ? (profile as any).default_arrival_advance_minutes
        : null)
    : otherArrivalAdvance;
  const restaurantHints = role === "restaurant"
    ? null
    : { city: other?.city ?? null, neighborhood: other?.neighborhood ?? null };
  const displayAddress = canSeeAddress
    ? (formatJobLocation({
        address: ann?.location_address ?? ann?.job_address ?? null,
        city: ann?.job_city ?? null,
        neighborhood: restaurantHints?.neighborhood ?? null,
        province: ann?.job_province ?? null,
      }) || ann?.location_address || null)
    : publicLocationLabel({
        job_city: ann?.job_city ?? null,
        city: restaurantHints?.city ?? null,
        neighborhood: restaurantHints?.neighborhood ?? null,
      });

  const slotTakenByOther = !!(
    app && ann &&
    app.status === "rejected" &&
    ann.assigned_worker_id &&
    ann.assigned_worker_id !== app.worker_id
  );
  const steps = buildTimeline(app?.status, { slotTakenByOther });

  const logEvent = async (action: string, metadata: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from("activity_logs").insert({
      user_id: user.id, action, entity_type: "application", entity_id: id,
      metadata: metadata as never,
    });
  };

  const submitReview = async (payload: {
    general: number;
    reliability: number;
    punctuality: number;
    professionalism: number;
    serviceQuality: number;
    teamwork: number;
    comment: string;
    positiveLabels: string[];
    negativeLabels: string[];
    wouldRehire: "yes" | "maybe" | "no" | null;
  }) => {
    if (!user || !app) return;
    if (role !== "restaurant") {
      toast.error("Solo il ristoratore può lasciare una recensione.");
      return;
    }
    const { general, reliability, punctuality, professionalism, serviceQuality, teamwork, comment, positiveLabels, negativeLabels, wouldRehire } = payload;
    if (!general || !reliability || !punctuality || !professionalism || !serviceQuality) {
      toast.error("Completa tutte le valutazioni prima di inviare la recensione.");
      return;
    }
    if (!wouldRehire) {
      toast.error("Seleziona se richiameresti questo lavoratore per un prossimo turno.");
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length > 500) {
      toast.error("Il commento può contenere al massimo 500 caratteri.");
      return;
    }

    // Anti-duplicato lato client (DB ha vincolo uniq_reviews_shift_author come backstop)
    if (existingReview) {
      try {
        console.log("[PUPILLO_REVIEW_ALREADY_EXISTS_BLOCKED]", {
          restaurant_id: app.restaurant_id, worker_id: app.worker_id,
          shift_id: shift?.id ?? null, review_id: existingReview.id,
        });
      } catch { /* */ }
      toast.error("Hai già lasciato una recensione per questo turno.");
      setReviewOpen(false);
      return;
    }

    // Guard temporale: la chiusura turno è ammessa solo dopo la fine effettiva.
    const endRef = ann
      ? getShiftEndDate(ann)
      : (shift?.shift_date ? new Date(`${shift.shift_date}T23:59:00`) : null);
    if (endRef && Date.now() < endRef.getTime()) {
      const hhmm = ann?.end_time ? ann.end_time.slice(0, 5) : null;
      toast.error(
        hhmm
          ? `Il turno non è ancora concluso. Potrai chiuderlo dopo le ${hhmm}.`
          : "Il turno non è ancora concluso. Potrai chiuderlo dopo l'orario di fine.",
      );
      return;
    }

    // Crea il turno se non esiste (caso in cui non sia mai stato confermato)
    let shiftId = shift?.id ?? null;
    if (!shiftId && app.announcement_id && ann) {
      const { data: created, error: createErr } = await supabase.from("shifts").insert({
        announcement_id: app.announcement_id,
        restaurant_id: app.restaurant_id,
        worker_id: app.worker_id,
        shift_date: ann.service_date,
        hours: 4,
        amount: app.proposed_tariff ?? ann.tariff_amount ?? null,
        status: "completed",
      } as never).select("*").single();
      if (createErr) { toast.error("Impossibile creare il turno: " + createErr.message); return; }
      shiftId = (created as any).id;
      setShift(created as Shift);
    } else if (shiftId && shift && shift.status !== "completed") {
      await supabase.from("shifts").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      } as never).eq("id", shiftId);
    }

    const { data, error } = await supabase.from("reviews").insert({
      author_id: user.id,
      target_id: app.worker_id,
      shift_id: shiftId,
      rating: general,
      comment: trimmed ? trimmed : null,
      tags: [],
      positive_tags: positiveLabels,
      negative_tags: negativeLabels,
      punctuality,
      professionalism,
      competence: serviceQuality,
      reliability,
      teamwork,
      application_id: app.id,
      announcement_id: app.announcement_id,
      is_visible_to_restaurants: true,
      is_visible_to_worker: true,
      would_rehire: wouldRehire,
    } as never).select("*").single();
    if (error) {
      if (String(error.message).toLowerCase().includes("uniq_reviews_shift_author") || (error as any).code === "23505") {
        try { console.log("[PUPILLO_REVIEW_ALREADY_EXISTS_BLOCKED]", {
          restaurant_id: app.restaurant_id, worker_id: app.worker_id, shift_id: shiftId,
        }); } catch { /* */ }
        toast.error("Hai già lasciato una recensione per questo turno.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setExistingReview(data as Review);
    try {
      console.log("[PUPILLO_REVIEW_SAVED_SUCCESS]", {
        restaurant_id: app.restaurant_id, worker_id: app.worker_id,
        shift_id: shiftId, review_id: (data as any)?.id ?? null,
        review_saved: true,
      });
      if (workerToRestaurantReview) {
        console.log("[PUPILLO_RECEIVED_REVIEW_UNLOCKED]", {
          restaurant_id: app.restaurant_id, worker_id: app.worker_id,
          shift_id: shiftId, received_review_id: workerToRestaurantReview.id,
          received_review_unlocked: true,
        });
      }
    } catch { /* */ }
    // UN SOLO messaggio di sistema combinato in chat ("Turno chiuso e
    // recensione ricevuta"), con anti-duplicato. Non inviare anche il
    // vecchio messaggio "Turno chiuso" — evita doppioni lato lavoratore.
    try {
      await insertShiftClosedWithReview();
    } catch (e) { /* non bloccante */ }
    // Nota: la notifica "Hai ricevuto una recensione" viene creata
    // automaticamente dal trigger DB `handle_new_review` per evitare duplicati.
    // Marca l'annuncio come completato
    if (app.announcement_id) {
      await supabase.from("announcements").update({ status: "completed" } as never).eq("id", app.announcement_id);
    }
    setReviewOpen(false);
    toast.success("Turno completato e recensione inviata al lavoratore.");
  };

  // Centralized privacy-aware display name for the "other" party (used in
  // chat header, proposal/confirmation cards, automatic messages, etc.).
  const displayOtherName = useMemo(() => getDisplayPartnerName({
    viewerRole: role,
    appStatus: app?.status,
    hasWorkedTogether,
    partner: {
      businessName: otherIdentity?.businessName ?? null,
      fullName: otherIdentity?.fullName ?? other?.name ?? null,
      firstName: otherIdentity?.firstName ?? null,
    },
  }), [role, app?.status, hasWorkedTogether, otherIdentity, other?.name]);

  // Nome reale del LOCALE collegato all'annuncio. Indipendente dal ruolo
  // di chi sta guardando la chat:
  //  - se l'utente corrente è il ristoratore → usa il suo profilo
  //  - se l'utente corrente è il lavoratore → usa il profilo del ristoratore
  //    (l'"altra parte" della conversazione)
  // Non deve MAI cadere sul nome del lavoratore: dove non disponibile,
  // mostriamo un fallback neutro.
  const venueName = useMemo<string | null>(() => {
    if (role === "restaurant") {
      return (profile?.business_name as string | null) || (profile?.full_name as string | null) || null;
    }
    return otherIdentity?.businessName || otherIdentity?.fullName || null;
  }, [role, profile?.business_name, profile?.full_name, otherIdentity?.businessName, otherIdentity?.fullName]);

  if (loading) {
    return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Caricamento chat…</div>;
  }

  if (notFound) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
        Conversazione non trovata o non accessibile.
      </div>
    );
  }

  return (
      <div className="max-w-3xl mx-auto lg:mx-0">
        <div className="flex items-center justify-between mb-4">
          <Link to="/messages" className="lg:hidden"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Indietro</Button></Link>
          {app && (
            <span
              className={`text-xs rounded-full px-2 py-1 capitalize ${
                app.status === "cancelled"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : "bg-secondary"
              }`}
            >
              {app.status === "cancelled" ? "Annullata" : app.status}
            </span>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <UserAvatar userId={otherId} name={displayOtherName} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
            {otherId ? (
              <Link
                to="/messages"
                search={{ with: otherId }}
                className="font-semibold text-primary hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                title="Vedi tutte le conversazioni con questa persona"
              >
                {displayOtherName}
              </Link>
            ) : (
              <div className="font-semibold">{displayOtherName}</div>
            )}
            {ann && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                <div>
                  <Link to="/announcements/$id" params={{ id: ann.id }} className="text-primary hover:underline underline-offset-2 font-medium">
                    Annuncio del{" "}
                    {formatOfferDateTime({
                      service_date: ann.service_date,
                      service_time: ann.service_time,
                      end_date: ann.end_date,
                      end_time: ann.end_time,
                    })}
                  </Link>
                </div>
                {ann.professional_profile && (
                  <div>
                    <span className="text-foreground/80">Mansione:</span>{" "}
                    {ann.professional_profile}
                  </div>
                )}
                {displayAddress && (
                  <div className="break-words">
                    <span className="text-foreground/80">Luogo:</span> {displayAddress}
                  </div>
                )}
                {currentTariff != null && (
                  <div className="flex items-center gap-1">
                    <Euro className="h-3 w-3 shrink-0" />
                    <span className="whitespace-nowrap">
                      <span className="text-foreground/80">Tariffa:</span>{" "}
                      €{currentTariff}
                      {ann?.tariff_type === "hourly" ? "/ora" : " a servizio"}
                    </span>
                    {app?.proposed_tariff != null && (
                      <span className="ml-1 text-primary">(controfferta)</span>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {role === "restaurant" && app?.status === "accepted" && confirmedWorker && (
          <div className="mb-4">
            <div className="mb-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              Lavoratore confermato. Ora puoi visualizzare i dati operativi del lavoratore.
            </div>
            <ConfirmedWorkerCard
              worker={confirmedWorker}
              applicationId={app.id}
              lastReview={confirmedWorkerLastReview}
            />
          </div>
        )}

        {app && shouldShowNewApplicationCard({ role: role as any, status: app.status as any, hasWorkerReputation: !!workerRep }) && workerRep && (() => {
          const s = summarizeReputation(workerRep);
          // ============================================================
          // FONTE DATI VERIFICATA: usiamo le recensioni reali caricate
          // dalla tabella `reviews` (filtrate per shift_id non nullo e
          // visibili ai ristoratori) come fonte di verità per rating e
          // numero recensioni. I campi cache su `profiles` (rating_avg,
          // reviews_count, completed_shifts) possono essere stantii o
          // contenere dati demo: non vanno mai mostrati da soli.
          // ============================================================
          const verifiedReviewsCount = workerReviews.length;
          const verifiedRating = verifiedReviewsCount > 0
            ? workerReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / verifiedReviewsCount
            : 0;
          const verifiedDistinctShiftsFromReviews = new Set(
            workerReviews.map(r => r.shift_id).filter(Boolean) as string[],
          ).size;
          // Turni completati: mostriamo il valore di profilo SOLO se è
          // coerente con il numero di recensioni verificate (≥ shift unici
          // dalle recensioni). Altrimenti usiamo i turni unici dalle
          // recensioni come minimo verificabile.
          const profileShifts = Number(s.completedShifts || 0);
          const verifiedCompletedShifts = profileShifts >= verifiedDistinctShiftsFromReviews
            ? profileShifts
            : verifiedDistinctShiftsFromReviews;
          // Mostra i turni solo se abbiamo almeno una prova reale (una
          // recensione collegata a un turno) oppure il dato profilo
          // coincide con quanto verificabile. In assenza di recensioni
          // reali NON mostriamo il numero turni: non è verificabile.
          const showCompletedShifts = verifiedDistinctShiftsFromReviews > 0;
          // Diagnostica: se i contatori cache divergono dai dati reali,
          // logghiamo in console (silenzioso per l'utente) e ignoriamo il
          // valore cache nella UI.
          if (typeof window !== "undefined") {
            if (s.reviewsCount !== verifiedReviewsCount) {
              console.warn(
                `[application-card] reviews_count cache (${s.reviewsCount}) ≠ recensioni reali (${verifiedReviewsCount}) per worker ${app.worker_id}. Uso dati reali.`,
              );
            }
            if (profileShifts > 0 && profileShifts < verifiedDistinctShiftsFromReviews) {
              console.warn(
                `[application-card] completed_shifts cache (${profileShifts}) < turni unici da recensioni (${verifiedDistinctShiftsFromReviews}) per worker ${app.worker_id}.`,
              );
            }
          }
          const hasEnoughReviews = verifiedReviewsCount >= 3;
          const reliability = Math.max(0, Math.min(100, s.completionPct || 0));
          // Privacy gating: mostra dati identità/reputazione completi solo se
          // il lavoratore ha completato il profilo. Telefono verificato è un
          // requisito ulteriore per considerare la reputazione "pubblica".
          const identityVisible = !!other?.profile_completed;
          const reputationVisible = identityVisible && !!other?.phone_verified;
          const displayName = identityVisible ? (displayOtherName ?? "Lavoratore") : "Profilo in verifica";
          // Messaggio: basato esclusivamente su dati reali verificati.
          const microSummary = !reputationVisible
            ? "Alcuni dati del lavoratore non sono ancora pubblici: identità e reputazione visibili solo dopo la verifica."
            : verifiedReviewsCount === 0 && !showCompletedShifts
              ? "Questo lavoratore non ha ancora recensioni verificate. Puoi comunque valutare profilo, competenze e disponibilità."
              : verifiedReviewsCount === 0 && showCompletedShifts
                ? "Questo lavoratore ha turni completati, ma non ha ancora recensioni verificate."
                : `Profilo con ${verifiedReviewsCount} ${verifiedReviewsCount === 1 ? "recensione verificata" : "recensioni verificate"}. Valuta media e commenti disponibili.`;
          // Livello reputazione coerente: se non ci sono dati reali,
          // non promuoviamo oltre "Nuovo" / "Nuovo verificato".
          const hasRealReputation = verifiedReviewsCount > 0 || showCompletedShifts;
          const displayLevel = hasRealReputation
            ? s.level
            : (other?.phone_verified ? "new_verified" : "new");
          const displayLevelLabel = hasRealReputation
            ? s.levelLabel
            : (other?.phone_verified ? "Nuovo verificato" : "Nuovo");
          const showScore = hasRealReputation && s.showScore;
          return (
            <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-5 mb-4 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.35)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[11px] px-2.5 py-1 font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" />Nuova candidatura
                </span>
                <span className="text-xs text-muted-foreground">Decidi se procedere</span>
              </div>

              <div className="flex items-start gap-4">
                <UserAvatar userId={identityVisible ? otherId : null} name={identityVisible ? displayOtherName : undefined} className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  {/*
                    Titolo della card: per la privacy del lavoratore, finché
                    non c'è collaborazione reale (turno completato) o la
                    candidatura non è accettata/confermata, NON usiamo il
                    nome del lavoratore come titolo. Mostriamo una dicitura
                    neutra "Nuovo candidato" e portiamo il nome locale in
                    evidenza come richiesto dalle regole progetto.
                  */}
                  <div className="font-semibold text-base truncate flex items-center gap-2">
                    <span>{hasWorkedTogether ? (displayName || "Nuovo candidato") : "Nuovo candidato"}</span>
                    {!identityVisible && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">Privacy</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    Locale: <span className="text-foreground font-medium">{venueName ?? "Locale non specificato"}</span>
                  </div>
                  {ann?.professional_profile && (
                    <div className="text-sm text-muted-foreground truncate">
                      Mansione: <span className="text-foreground font-medium">{ann.professional_profile}</span>
                    </div>
                  )}
                  {ann && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Data: {new Date(ann.service_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                      {ann.service_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Orario: {ann.service_time.slice(0, 5)}</span>}
                    </div>
                  )}
                  {!hasWorkedTogether && identityVisible && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Candidato: <span className="text-foreground">{displayName}</span>{" "}
                      <span className="opacity-75">(cognome visibile solo dopo collaborazione confermata)</span>
                    </div>
                  )}
                </div>
              </div>

              {reputationVisible ? (
              <div className="mt-4 rounded-xl bg-muted/40 border p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${levelChipClass(displayLevel as any)}`}>
                  <Award className="h-3 w-3" />{displayLevelLabel}
                </span>
                {showScore && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span className="text-muted-foreground">Score</span>
                    <span className={`tabular-nums font-semibold ${scoreColorClass(s.score)}`}>{s.score}/100</span>
                  </span>
                )}
                {hasEnoughReviews && verifiedRating > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="tabular-nums">{verifiedRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">· {verifiedReviewsCount} recensioni</span>
                  </span>
                ) : verifiedReviewsCount > 0 && verifiedRating > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="tabular-nums">{verifiedRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">· {verifiedReviewsCount} {verifiedReviewsCount === 1 ? "recensione" : "recensioni"}</span>
                  </span>
                ) : verifiedReviewsCount > 0 ? (
                  <span className="text-muted-foreground">Recensioni: <span className="font-medium text-foreground tabular-nums">{verifiedReviewsCount}</span></span>
                ) : null}
                {showCompletedShifts && verifiedCompletedShifts > 0 && (
                  <span className="text-muted-foreground">
                    Turni: <span className="font-medium text-foreground tabular-nums">{verifiedCompletedShifts}</span>
                  </span>
                )}
                {showCompletedShifts && verifiedCompletedShifts > 0 && reliability > 0 && (
                  <span className="text-muted-foreground">
                    Affidabilità: <span className="font-medium text-foreground tabular-nums">{reliability}%</span>
                  </span>
                )}
                {s.noShow > 0 && (
                  <span className="text-destructive">No-show: <span className="tabular-nums font-medium">{s.noShow}</span></span>
                )}
              </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Award className="h-3.5 w-3.5 opacity-60" />
                  Reputazione non ancora pubblica · dati oscurati in attesa di verifica del profilo.
                </div>
              )}

              <p className="mt-3 text-sm text-muted-foreground">{microSummary}</p>

              {reputationVisible && (
                <div className="mt-4 rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recensioni lavoratore
                    </div>
                    {workerReviews.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setReviewsOpen(true)}
                      >
                        Vedi tutte ({workerReviews.length})
                      </Button>
                    )}
                  </div>
                  {workerReviews.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Questo lavoratore non ha ancora recensioni verificate. Puoi comunque valutare profilo, competenze e disponibilità.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
                        {verifiedRating > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold tabular-nums">{verifiedRating.toFixed(1)}</span>
                            <span className="text-muted-foreground">· {verifiedReviewsCount} {verifiedReviewsCount === 1 ? "recensione" : "recensioni"}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{verifiedReviewsCount} {verifiedReviewsCount === 1 ? "recensione" : "recensioni"}</span>
                        )}
                        {showCompletedShifts && verifiedCompletedShifts > 0 && reliability > 0 && (
                          <span className="text-muted-foreground">
                            Affidabilità: <span className="font-medium text-foreground tabular-nums">{reliability}%</span>
                          </span>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {workerReviews.slice(0, 2).map((r) => (
                          <li key={r.id} className="rounded-lg bg-muted/40 p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="inline-flex items-center gap-0.5">
                                {[1,2,3,4,5].map(n => (
                                  <Star key={n} className={`h-3 w-3 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                                ))}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            {r.comment ? (
                              <p className="text-xs text-foreground/90 line-clamp-2">"{r.comment}"</p>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">Nessun commento</p>
                            )}
                            <ReviewLabelsDisplay
                              positive={r.positive_tags}
                              negative={r.negative_tags}
                              className="mt-1.5"
                            />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(() => {
                  // CASO B — Proposta inviata dal ristoratore: il lavoratore deve
                  // ancora dichiarare interesse. Finché non lo fa, il ristoratore
                  // NON può confermare il turno.
                  const restaurantId = app?.restaurant_id;
                  const restaurantProposalMsg = msgs.find(
                    (m) => m.template_id === PROPOSAL_TEMPLATE_ID && m.sender_id === restaurantId,
                  );
                  const restaurantProposalAccepted = restaurantProposalMsg
                    ? proposalStatuses[restaurantProposalMsg.id] === "accepted"
                    : false;
                  const waitingWorkerInterest =
                    !!restaurantProposalMsg &&
                    !restaurantProposalAccepted &&
                    app?.status === "pending";
                  if (typeof window !== "undefined") {
                    // eslint-disable-next-line no-console
                    console.log("[PUPILLO_RESTAURANT_PROPOSAL_STATUS_DEBUG]", {
                      restaurant_user_id: restaurantId,
                      worker_user_id: app?.worker_id,
                      announcement_id: app?.announcement_id,
                      proposal_id: restaurantProposalMsg?.id ?? null,
                      application_id: app?.id,
                      source: restaurantProposalMsg ? "restaurant_proposal" : "worker_application",
                      current_status: app?.status,
                      worker_has_shown_interest: !waitingWorkerInterest,
                      restaurant_can_confirm: !waitingWorkerInterest,
                      button_rendered: "Accetta candidatura / Conferma lavoratore",
                      button_enabled: !waitingWorkerInterest && transitioning === null,
                    });
                  }
                  const workerInterested = !!restaurantProposalMsg && !waitingWorkerInterest && app?.status !== "accepted";
                  if (typeof window !== "undefined") {
                    // eslint-disable-next-line no-console
                    console.log("[PUPILLO_RESTAURANT_INTEREST_ACTIONS_DEBUG]", {
                      restaurant_user_id: restaurantId,
                      worker_user_id: app?.worker_id,
                      proposal_id: restaurantProposalMsg?.id ?? null,
                      announcement_id: app?.announcement_id,
                      application_id: app?.id,
                      current_status: app?.status,
                      worker_interested: workerInterested,
                      can_confirm: workerInterested && transitioning === null,
                      can_send_counteroffer: !!restaurantProposalMsg && transitioning === null,
                      buttons_rendered: ["Chatta", "Rifiuta", restaurantProposalMsg ? "Conferma lavoratore" : "Accetta candidatura", restaurantProposalMsg ? "Invia controfferta" : null].filter(Boolean),
                      credits_balance: creditsAvailable,
                      credits_required: CREDITS_PER_HIRE,
                    });
                  }
                  return (
                    <>
                {waitingWorkerInterest && (
                  <div className="sm:col-span-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                    Proposta inviata. In attesa della risposta del lavoratore. Potrai confermare il turno quando il lavoratore avrà mostrato interesse.
                  </div>
                )}
                {workerInterested && (
                  <div className="sm:col-span-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-900">
                    <div className="font-semibold">Il lavoratore è interessato</div>
                    Il lavoratore ha confermato la disponibilità per questa proposta. Ora puoi confermare il servizio oppure inviare una controfferta.
                  </div>
                )}
                <Button
                  variant="outline"
                  className="gap-2 w-full"
                  onClick={() => {
                    document.getElementById("chat-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  disabled={transitioning !== null}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chatta
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2 w-full"
                  onClick={() => setRejectOpen(true)}
                  disabled={transitioning !== null}
                >
                  {transitioning === "rejected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  {transitioning === "rejected" ? "Rifiuto in corso…" : "Rifiuta"}
                </Button>
                <Button
                  className="gap-2 w-full bg-lime-600 hover:bg-lime-600/90 text-white shadow-md"
                  onClick={() => transition("accepted")}
                  disabled={transitioning !== null || waitingWorkerInterest}
                  title={waitingWorkerInterest ? "Attendi la risposta del lavoratore" : undefined}
                >
                  {transitioning === "accepted" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {transitioning === "accepted"
                    ? "Conferma in corso…"
                    : restaurantProposalMsg
                      ? "Conferma lavoratore"
                      : "Accetta candidatura"}
                </Button>
                {restaurantProposalMsg && (
                  <Button
                    variant="outline"
                    className="gap-2 w-full sm:col-span-3 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => setCounterofferOpen(true)}
                    disabled={transitioning !== null}
                  >
                    <Handshake className="h-4 w-4" />
                    Invia controfferta
                  </Button>
                )}
                    </>
                  );
                })()}
              </div>
              <PayOnHireBox className="mt-3" compact />
            </div>
          );
        })()}

        {app && (
          <div className="rounded-2xl border bg-card p-4 mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-3">Stato della richiesta</div>
            <ol className="flex items-start justify-between gap-2">
              {steps.map((s: Step, i: number) => (
                <li key={s.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                  <div className="flex items-center w-full">
                    <div className={`h-px flex-1 ${i === 0 ? "invisible" : s.state === "todo" ? "bg-border" : "bg-primary"}`} />
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                      s.state === "done" ? "bg-primary border-primary text-primary-foreground" :
                      s.state === "current" ? "bg-primary/15 border-primary text-primary" :
                      s.state === "error" ? "bg-destructive border-destructive text-destructive-foreground" :
                      "bg-card border-border text-muted-foreground"
                    }`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className={`h-px flex-1 ${i === steps.length - 1 ? "invisible" : s.state === "done" ? "bg-primary" : "bg-border"}`} />
                  </div>
                  <div className={`mt-2 text-[11px] leading-tight ${s.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                </li>
              ))}
            </ol>
            {(() => {
              const ts = buildEventList(app, events);
              if (ts.length === 0) return null;
              return (
                <ul className="mt-5 border-t pt-4 space-y-3">
                  {ts.map((e: TimelineEvent, i: number) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${e.tone === "error" ? "bg-destructive" : e.tone === "success" ? "bg-primary" : "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{e.label}</span>
                          <span className="text-[11px] text-muted-foreground">{formatTs(e.at)}</span>
                        </div>
                        {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        )}

        {canChangeStatus && app && (
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {role === "worker" && app.status === "pending" && (<>
                <Button size="sm" className="gap-2" disabled={transitioning !== null} onClick={() => setInterestConfirmOpen(true)}>
                  {transitioning === "interested" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  {transitioning === "interested" ? "Invio in corso…" : "Sono interessato"}
                </Button>
                <Button size="sm" variant="outline" className="gap-2" disabled={transitioning !== null} onClick={() => transition("not_interested")}>
                  {transitioning === "not_interested" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  {transitioning === "not_interested" ? "Invio in corso…" : "Non interessato"}
                </Button>
                {(() => {
                  // CASO A — Proposta inviata dal ristoratore al lavoratore:
                  // se in chat esiste già un messaggio "shift_proposal" inviato
                  // dal ristoratore e il worker non ha ancora risposto (status
                  // ancora "pending"), allora non è una candidatura del
                  // lavoratore: nascondiamo "Annulla candidatura".
                  const restaurantId = app?.restaurant_id;
                  const hasRestaurantProposal = msgs.some(
                    (m) => m.template_id === PROPOSAL_TEMPLATE_ID && m.sender_id === restaurantId,
                  );
                  const shiftBlocks = shift && (shift.status === "scheduled" || shift.status === "completed");
                  const show = !hasRestaurantProposal && !shiftBlocks;
                  if (typeof window !== "undefined") {
                    // eslint-disable-next-line no-console
                    console.log("[PUPILLO_CHAT_ACTION_BUTTONS_DEBUG]", {
                      worker_user_id: app?.worker_id,
                      restaurant_user_id: restaurantId,
                      application_id: app?.id,
                      source: hasRestaurantProposal ? "restaurant_proposal" : "worker_application",
                      application_status: app?.status,
                      buttons_rendered: show
                        ? ["Sono interessato", "Non interessato", "Annulla candidatura"]
                        : ["Sono interessato", "Non interessato"],
                      cancel_hidden_reason: show
                        ? null
                        : hasRestaurantProposal
                          ? "restaurant_proposal_pending"
                          : "shift_scheduled_or_completed",
                    });
                  }
                  if (!show) return null;
                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2 text-muted-foreground hover:text-destructive"
                      disabled={transitioning !== null || cancelling}
                      onClick={() => setCancelConfirmOpen(true)}
                    >
                      <Ban className="h-4 w-4" />Annulla candidatura
                    </Button>
                  );
                })()}
              </>)}
              {role === "restaurant" && app.status === "counter_offer" && ann?.tariff_amount != null && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={async () => {
                    if (!app) return;
                    const orig = ann.tariff_amount;
                    const { error } = await supabase.from("applications").update({
                      status: "pending", proposed_tariff: orig,
                    }).eq("id", id);
                    if (error) { toast.error(error.message); return; }
                    await supabase.from("notifications").insert({
                      user_id: app.worker_id,
                      title: "Il ristoratore propone la tariffa originale",
                      body: `Il ristoratore propone di tornare a € ${orig}${ann.tariff_type === "hourly" ? "/h" : ""}.`,
                      link: `/messages/${id}`,
                    });
                    await logEvent("original_rate_proposed", { tariff: orig });
                    setApp({ ...app, status: "pending", proposed_tariff: orig } as App);
                    toast.success("Hai riproposto la tariffa originale.");
                  }}
                >
                  <Euro className="h-4 w-4" />Proponi tariffa originale
                </Button>
              )}
            </div>
            {role === "restaurant" && app.status === "counter_offer" && app.proposed_tariff != null && ann && (
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs px-2.5 py-1 font-semibold">
                    <Euro className="h-3 w-3" />Contro offerta ricevuta
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Tariffa proposta</div>
                    <div className="font-semibold">€ {ann.tariff_amount}{ann.tariff_type === "hourly" ? "/h" : ""}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Richiesta lavoratore</div>
                    <div className="font-semibold text-primary">€ {app.proposed_tariff}{ann.tariff_type === "hourly" ? "/h" : ""}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Differenza</div>
                    <div className="font-semibold">+ € {(Number(app.proposed_tariff) - Number(ann.tariff_amount)).toFixed(2)}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Accettando confermerai il lavoratore alla tariffa richiesta. I crediti vengono scalati solo alla conferma.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="relative">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
            nearBottomRef.current = dist < 80;
            if (nearBottomRef.current && newCount > 0) setNewCount(0);
            // Load older messages when the user reaches the top.
            if (el.scrollTop < 80 && hasMore && !loadingMore) {
              loadOlder();
            }
          }}
          className="rounded-2xl border bg-card p-4 h-[min(52vh,520px)] min-h-[360px] overflow-y-auto space-y-2"
        >
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingMore}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-60"
              >
                {loadingMore ? "Caricamento…" : "Carica messaggi precedenti"}
              </button>
            </div>
          )}
          {!hasMore && msgs.length > 0 && (
            <div className="flex justify-center pb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Inizio della conversazione</span>
            </div>
          )}
          {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Inizia la conversazione.</p>}
          {msgs.map(m => {
            const isSystem = m.message_type === "system" || m.body.startsWith("⚙️ Sistema:");
            // Card combinata "Turno chiuso e recensione ricevuta" — UN SOLO
            // messaggio visibile sia al ristoratore sia al lavoratore.
            if (m.template_id === SHIFT_REVIEW_TEMPLATE_ID) {
              return (
                <div key={m.id} className="flex justify-center">
                  <ShiftClosedWithReviewCard review={existingReview} />
                </div>
              );
            }
            if (isSystem) {
              const isAccept = m.action_type === "accept_application";
              const isReject = m.action_type === "reject_application";
              const isCancel = m.action_type === "withdraw_application";
              const tone = isAccept
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : isReject
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : isCancel
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : "bg-muted text-muted-foreground border";
              const label = isAccept
                ? "Proposta accettata"
                : isReject
                  ? "Proposta rifiutata"
                  : isCancel
                    ? "Candidatura annullata dal lavoratore"
                    : m.body.replace(/^⚙️ Sistema:\s*/, "").replace(/^⚙️ /, "");
              return (
                <div key={m.id} className="flex justify-center">
                  <div className={`rounded-full px-3 py-1 text-xs font-medium border ${tone}`}>
                    {label}
                  </div>
                </div>
              );
            }
            if (m.template_id === CONFIRMATION_TEMPLATE_ID) {
              const venueName = role === "worker"
                ? displayOtherName
                : (profile?.business_name || profile?.full_name || null);
              const hasAcknowledged = msgs.some(
                mm => mm.action_type === "instructions_acknowledged" && mm.application_id === id,
              );
              return (
                <div key={m.id} id="instructions-card" data-instructions-card>
                  <ConfirmationCard
                    ann={ann}
                    venueName={venueName}
                    applicationId={id}
                    announcementId={app?.announcement_id ?? null}
                    isWorker={role === "worker"}
                    acknowledged={hasAcknowledged}
                    arrivalAdvanceMinutes={restaurantArrivalAdvance}
                    onAcknowledge={acknowledgeInstructions}
                  />
                </div>
              );
            }
            if (m.template_id === PROPOSAL_TEMPLATE_ID) {
              const ownStatus = proposalStatuses[m.id];
              const hasAnyResponse = Object.keys(proposalStatuses).length > 0;
              // Per-proposal status is authoritative. Legacy proposals (no recorded
              // response anywhere) fall back to the application status once.
              const effectiveStatus = ownStatus ?? (hasAnyResponse ? "pending" : (app?.status ?? "pending"));
              const specialBlock = role === "worker"
                ? computeSpecialAvailabilityBlock(workerSpecialExceptions, ann)
                : null;
              if (typeof console !== "undefined") {
                console.debug("[PUPILLO_CHAT_PROPOSAL_MESSAGE_MAPPING_DEBUG]", {
                  role,
                  restaurant_user_id: app?.restaurant_id ?? null,
                  worker_user_id: app?.worker_id ?? null,
                  announcement_id: app?.announcement_id ?? null,
                  message_id: m.id,
                  worker_name: role === "worker" ? null : displayOtherName,
                  restaurant_name_other: role === "worker" ? displayOtherName : null,
                  business_name_self: profile?.business_name ?? null,
                  full_name_self: profile?.full_name ?? null,
                  venue_value_shown: venueName,
                });
              }
              return (
                <div key={m.id} className="flex flex-col gap-2">
                <ProposalCard
                  message={m}
                  ann={ann}
                  venueName={venueName}
                  displayAddress={displayAddress}
                  canSeePreciseInfo={canSeeAddress}
                  isWorker={role === "worker"}
                  status={effectiveStatus}
                  specialBlock={specialBlock}
                  lockReason={
                    closureReason === "completed"
                      ? "completed"
                      : closureReason === "cancelled"
                        ? "cancelled"
                        : null
                  }
                  onAccept={async () => {
                    if (closureReason) {
                      console.warn("[proposal] accept blocked: chat closed", { closureReason, shiftStatus: shift?.status, annStatus: ann?.status, appStatus: app?.status });
                      toast.error("Non puoi accettare questa proposta perché il turno è stato annullato.");
                      return;
                    }
                    if (role === "worker" && user) {
                      const fresh = await fetchSpecialAvailabilityBlock(user.id, ann);
                      if (fresh?.blocked) {
                        toast.error(SPECIAL_ACCEPT_INCOMPATIBLE_MESSAGE);
                        return;
                      }
                      // PUPILLO: regola di OCCUPAZIONE — il lavoratore non
                      // puo' accettare se ha gia' un altro turno confermato
                      // in conflitto (buffer 1h post-fine).
                      const conflict = await checkWorkerShiftConflict(user.id, ann as any, {
                        ignoreApplicationId: id,
                      });
                      if (conflict) {
                        toast.error(CONFLICT_WORKER_ACCEPT_MESSAGE);
                        return;
                      }
                    }
                    if (user) {
                      const { error: respErr } = await supabase.from("proposal_responses").insert({
                        message_id: m.id,
                        application_id: id,
                        responder_id: user.id,
                        status: "accepted",
                      } as never);
                      if (!respErr) {
                        setProposalStatuses((prev) => ({ ...prev, [m.id]: "accepted" }));
                      } else if (!String(respErr.message ?? "").toLowerCase().includes("duplicate")) {
                        console.error("[proposal] response insert failed", respErr);
                      }
                    }
                    // Notify the restaurant that the worker accepted the proposal.
                    if (app?.restaurant_id) {
                      try {
                        const workerName = role === "worker" ? (profile?.full_name ?? "Il lavoratore") : (displayOtherName ?? "Il lavoratore");
                        await supabase.from("notifications").insert({
                          user_id: app.restaurant_id,
                          title: "Proposta accettata",
                          body: `${workerName} ha accettato la tua proposta di lavoro. Ora puoi assegnare il turno dalla chat.`,
                          link: `/messages/${id}`,
                        } as never);
                      } catch (err) {
                        console.error("[proposal] notify accept failed", err);
                      }
                    }
                    // NON transizionare automaticamente l'applicazione a "accepted":
                    // la conferma del turno deve essere esplicita lato ristoratore
                    // perché comporta lo scalamento dei crediti (7 crediti per conferma).
                    // Il lavoratore qui sta solo segnalando la disponibilità ad accettare
                    // la proposta; il ristoratore confermerà cliccando "Conferma lavoratore".
                    try {
                      await insertSystemMessage(
                        "Proposta accettata dal lavoratore.\nIl ristoratore deve confermare il turno per finalizzare l'assegnazione.",
                        "accept_application",
                      );
                    } catch (err) {
                      console.error("[proposal] system message insert failed", err);
                    }
                  }}
                  onReject={async (reason?: string) => {
                    if (closureReason) {
                      console.warn("[proposal] reject blocked: chat closed", { closureReason, shiftStatus: shift?.status, annStatus: ann?.status, appStatus: app?.status });
                      toast.error("Non puoi rifiutare questa proposta perché il turno è stato annullato.");
                      return;
                    }
                    if (user) {
                      const { error: respErr } = await supabase.from("proposal_responses").insert({
                        message_id: m.id,
                        application_id: id,
                        responder_id: user.id,
                        status: "rejected",
                      } as never);
                      if (!respErr) {
                        setProposalStatuses((prev) => ({ ...prev, [m.id]: "rejected" }));
                      } else if (!String(respErr.message ?? "").toLowerCase().includes("duplicate")) {
                        console.error("[proposal] response insert failed", respErr);
                      }
                    }
                    // Notify the restaurant that the worker rejected the proposal.
                    if (app?.restaurant_id) {
                      try {
                        const workerName = role === "worker" ? (profile?.full_name ?? "Il lavoratore") : (displayOtherName ?? "Il lavoratore");
                        await supabase.from("notifications").insert({
                          user_id: app.restaurant_id,
                          title: "Proposta rifiutata",
                          body: `${workerName} ha rifiutato la tua proposta di lavoro. Puoi proporgli un altro turno o contattare un altro lavoratore.`,
                          link: `/messages/${id}`,
                        } as never);
                      } catch (err) {
                        console.error("[proposal] notify reject failed", err);
                      }
                    }
                    try {
                      // Do NOT close the whole application on a single proposal refusal —
                      // other live proposals may exist in the same conversation. The
                      // per-proposal record + system message communicate THIS refusal.
                    } finally {
                      try {
                        const base = "Proposta rifiutata.\nHai rifiutato questa proposta di lavoro.";
                        const body = reason ? `${base}\nMotivo: ${reason}` : base;
                        await insertSystemMessage(body, "reject_application");
                      } catch (err) {
                        console.error("[proposal] system message insert failed", err);
                      }
                    }
                  }}
                />
                {role === "admin" && (
                  <ProposalDebugPanel
                    conversationId={id}
                    messageId={m.id}
                    info={proposalDebug[m.id]}
                    effectiveStatus={effectiveStatus}
                    open={debugOpen}
                    onToggle={() => setDebugOpen((v) => !v)}
                  />
                )}
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex items-end gap-2 ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                {m.sender_id === app?.worker_id && m.sender_id !== user?.id && (
                  <UserAvatar userId={app?.worker_id} name={other?.name} className="h-8 w-8 shrink-0" />
                )}
                <div className={`flex flex-col gap-0.5 max-w-[75%] ${m.sender_id === user?.id ? "items-end" : "items-start"}`}>
                  <div className={`rounded-2xl px-4 py-2 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.body}</div>
                  {m.sender_id === user?.id && (
                    <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground" aria-label={m.read_at ? "Letto" : "Inviato"} title={m.read_at ? `Letto ${new Date(m.read_at).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : "Inviato"}>
                      {m.read_at
                        ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                        : <Check className="h-3.5 w-3.5" />}
                      <span>{m.read_at ? "Letto" : "Inviato"}</span>
                    </div>
                  )}
                </div>
                {m.sender_id === app?.worker_id && m.sender_id === user?.id && (
                  <UserAvatar userId={app?.worker_id} name={undefined} className="h-8 w-8 shrink-0" />
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {newCount > 0 && (
          <button
            type="button"
            onClick={() => {
              endRef.current?.scrollIntoView({ behavior: "smooth" });
              setNewCount(0);
            }}
            className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 rounded-full bg-primary text-primary-foreground text-xs px-3 py-1 shadow"
          >
            {newCount === 1 ? "1 nuovo messaggio" : `${newCount} nuovi messaggi`} ↓
          </button>
        )}
        </div>
        {role === "restaurant" && app && shift && (() => {
          const reviewed = !!existingReview;
          const completed = shift.status === "completed";
          const isCancelled = shift.status === "cancelled" || shift.status === "no_show";
          if (isCancelled) return null;
          // Server-time gate: il ristoratore può chiudere/recensire SOLO dopo la
          // fine effettiva del turno (Europa/Roma, gestendo turni oltre mezzanotte).
          const shiftEnd = ann ? getShiftEndDate(ann) : (shift?.shift_date ? new Date(`${shift.shift_date}T23:59:00`) : null);
          const shiftEnded = shiftEnd ? Date.now() >= shiftEnd.getTime() : false;
          const endLabel = ann?.end_time ? ann.end_time.slice(0, 5) : null;
          const endDateLabel = shiftEnd
            ? shiftEnd.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
            : null;
          let title = "Chiusura turno";
          let subtitle = "Quando il servizio è finito, chiudi il turno e lascia la recensione al lavoratore.";
          let cta = "Chiudi turno e recensisci";
          if (reviewed) {
            title = "Recensione inviata";
            subtitle = "Hai già recensito questo turno. Puoi rivedere la valutazione qui sotto.";
            cta = "Vedi recensione";
          } else if (completed) {
            title = "Lascia recensione";
            subtitle = "Il turno è stato completato. Lascia ora la valutazione al lavoratore.";
            cta = "Lascia recensione";
          } else if (!shiftEnded) {
            title = "Turno non ancora concluso";
            subtitle = endLabel
              ? `Potrai chiudere e recensire il turno dopo le ${endLabel}${endDateLabel ? ` del ${endDateLabel}` : ""}.`
              : "Potrai chiudere e recensire il turno dopo la fine del servizio.";
            cta = "In attesa di fine turno";
          }
          const openClosure = () => {
            if (!reviewed && !shiftEnded) {
              toast.info("Puoi chiudere il turno solo dopo la fine del servizio.");
              return;
            }
            setTplCategory("post_shift");
            setReviewOpen(true);
            setTimeout(() => {
              document.getElementById("review-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 60);
          };
          const locked = !reviewed && !shiftEnded;
          return (
            <button
              type="button"
              onClick={openClosure}
              aria-disabled={locked}
              title={locked ? "Puoi chiudere il turno solo dopo la fine del servizio." : undefined}
              className={`mt-4 w-full text-left rounded-2xl border-2 p-4 flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary transition ${
                locked
                  ? "border-muted bg-muted/40 cursor-not-allowed opacity-80"
                  : "border-primary bg-primary/15 hover:bg-primary/25 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.55)]"
              }`}
            >
              <div className={`shrink-0 rounded-xl p-2.5 flex items-center justify-center ${locked ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                {locked ? <Clock className="h-5 w-5" /> : <Star className="h-5 w-5" fill="currentColor" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base sm:text-lg leading-tight">{title}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</div>
                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${locked ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                  {locked ? <Clock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {cta}
                </div>
              </div>
            </button>
          );
        })()}
        {role === "restaurant" && app && existingReview && (
          <div className="mt-3">
            <SaveToFavoritesPrompt
              restaurantId={app.restaurant_id}
              workerId={app.worker_id}
              workerName={other?.name ?? null}
              applicationId={app.id}
            />
          </div>
        )}
        {role === "restaurant" && app && workerToRestaurantReview && (() => {
          if (typeof console !== "undefined") {
            console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_LOADED]", {
              review_id: workerToRestaurantReview.id,
              shift_id: shift?.id ?? null,
              author_id: workerToRestaurantReview.author_id,
              target_id: workerToRestaurantReview.target_id,
            });
          }
          const rev = workerToRestaurantReview;
          const tags = [
            ...((rev.positive_tags as string[] | null) ?? []),
            ...((rev.negative_tags as string[] | null) ?? []),
          ];
          // BLIND rule: restaurant cannot read the received review until it
          // has left its own restaurant_to_worker review for the same shift.
          const restaurantHasReviewed = !!existingReview;
          if (!restaurantHasReviewed) {
            try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_LOCKED]", { review_id: rev.id, shift_id: shift?.id ?? null }); } catch { /* */ }
            return (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="h-4 w-4 text-amber-600" />
                  Hai ricevuto una recensione
                </div>
                <p className="text-xs text-muted-foreground">
                  Lascia la tua recensione al lavoratore per visualizzarla.
                </p>
                <div className="blur-sm select-none pointer-events-none">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className="h-4 w-4 fill-yellow-400 text-yellow-400" strokeWidth={1.5} />
                    ))}
                    <span className="ml-2 text-sm font-medium">★/5</span>
                  </div>
                  <p className="text-xs italic text-muted-foreground mt-1">Commento e tag nascosti</p>
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      setReviewOpen(true);
                      setTimeout(() => {
                        document.getElementById("review-block")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 60);
                    }}
                  >
                    Recensisci e sblocca
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Star className="h-4 w-4 text-emerald-600" fill="currentColor" />
                Recensione ricevuta
              </div>
              <p className="text-xs text-muted-foreground">
                Il lavoratore ha lasciato una recensione per questo turno.
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${n <= (rev.rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
                    strokeWidth={1.5}
                  />
                ))}
                <span className="ml-2 text-sm font-medium">{rev.rating}/5</span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">{t}</span>
                  ))}
                </div>
              )}
              {rev.comment && (
                <blockquote className="border-l-2 border-emerald-500/40 pl-3 text-sm italic text-muted-foreground">
                  "{rev.comment}"
                </blockquote>
              )}
              <div className="text-[11px] text-muted-foreground">
                {new Date(rev.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          );
        })()}
        {role === "worker"
          && !isConversationClosed
          && app
          && shift
          && user
          && shift.worker_id === user.id
          && (shift.status === "scheduled" || shift.status === "confirmed")
          && (() => {
          const target: IncidentTarget = {
            shiftId: shift.id,
            workerId: shift.worker_id,
            restaurantId: shift.restaurant_id,
            applicationId: app.id,
            announcementId: shift.announcement_id ?? app.announcement_id ?? null,
            context: {
              role: ann?.professional_profile ?? null,
              date: ann?.service_date ?? shift.shift_date ?? null,
              time: ann?.service_time ?? null,
            },
          };
          return (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlarmClock className="h-4 w-4 text-amber-600" />
                Gestione turno
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa queste azioni solo se hai un problema con questo turno.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayOpen(true)}
                  className="border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  Segnala ritardo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelPresenceOpen(true)}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Ban className="h-4 w-4 mr-1.5" />
                  Annulla presenza
                </Button>
              </div>
              <ReportDelayDialog
                open={delayOpen}
                onClose={() => setDelayOpen(false)}
                target={target}
                onDone={() => {
                  // Refresh shift state from DB
                  void supabase
                    .from("shifts")
                    .select("id, status, shift_date, worker_id, restaurant_id, announcement_id, reviewed_at, reviewed_by_restaurant_user_id")
                    .eq("id", shift.id)
                    .maybeSingle()
                    .then(({ data }) => { if (data) setShift(data as Shift); });
                }}
              />
              <CancelPresenceDialog
                open={cancelPresenceOpen}
                onClose={() => setCancelPresenceOpen(false)}
                target={target}
                onDone={() => {
                  void supabase
                    .from("shifts")
                    .select("id, status, shift_date, worker_id, restaurant_id, announcement_id, reviewed_at, reviewed_by_restaurant_user_id")
                    .eq("id", shift.id)
                    .maybeSingle()
                    .then(({ data }) => { if (data) setShift(data as Shift); });
                }}
              />
            </div>
          );
        })()}
        <div id="chat-composer">
        {isConversationClosed ? (
          <div className="mt-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-semibold mb-2">
              <Ban className="h-3.5 w-3.5" />
              {closureReason === "completed" ? "Turno concluso" : "Turno annullato"}
            </div>
            <p className="text-sm text-foreground/90">{closureNoticeText}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Non puoi inviare messaggi perché questo turno è stato chiuso o annullato.
            </p>
          </div>
        ) : (
        <TemplatePicker
          role={role === "restaurant" ? "restaurant" : "worker"}
          category={tplCategory}
          setCategory={(c) => {
            setTplCategory(c);
            if (role === "restaurant" && c === "post_shift") {
              setReviewOpen(true);
              setTimeout(() => {
                document.getElementById("review-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 60);
            }
          }}
          selected={selectedTpl}
          setSelected={setSelectedTpl}
          onSend={requireComplete(() => {
            // Blocca l'invio se il TARGET ha profilo incompleto.
            // Se `other` non è ancora caricato, evitiamo di mostrare il popup
            // per non confondere l'utente: l'invio resta bloccato sotto da
            // altri stati (es. sending/disabled).
            if (other && !ensureTargetComplete(other.profile_completed)) return;
            void sendTemplate();
          })}
          sending={sending}
          ann={ann}
          otherName={venueName ?? null}
          addressOverride={displayAddress}
          disabled={isConversationClosed}
        />
        )}
        </div>

        {role === "restaurant" && tplCategory === "post_shift" && app && (
          <ReviewBlock
            id="review-block"
            existing={existingReview}
          />
        )}
        {role === "restaurant" && app && (
          <ReviewDialog
            open={reviewOpen && !existingReview}
            onOpenChange={(v) => setReviewOpen(v)}
            workerName={other?.name ?? null}
            workerRole={ann?.professional_profile ?? null}
            shiftDate={ann?.service_date ?? shift?.shift_date ?? null}
            startTime={ann?.service_time ?? null}
            endTime={ann?.end_time ?? null}
            venue={displayAddress}
            shiftStatus={shift?.status ?? null}
            workerId={app.worker_id}
            restaurantId={app.restaurant_id}
            shiftId={shift?.id ?? null}
            onSubmit={submitReview}
          />
        )}

        <InsufficientCreditsDialog
          open={insufficientOpen}
          onOpenChange={setInsufficientOpen}
          currentCredits={creditsAvailable}
          returnTo={`/messages/${id}`}
        />
        {role === "restaurant" && app && ann && (
          <CounterofferDialog
            open={counterofferOpen}
            onOpenChange={setCounterofferOpen}
            applicationId={app.id}
            restaurantId={app.restaurant_id}
            workerId={app.worker_id}
            announcement={{
              id: ann.id,
              service_date: ann.service_date ?? null,
              service_time: ann.service_time ?? null,
              end_time: (ann as any).end_time ?? null,
              tariff_amount: ann.tariff_amount ?? null,
              tariff_type: ann.tariff_type ?? null,
              professional_profile: ann.professional_profile ?? null,
              notes: (ann as any).notes ?? null,
            }}
          />
        )}
        <BlockedContactDialog open={blockOpen} onClose={() => setBlockOpen(false)} shifts={actionShifts} />
        <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rifiuta candidatura</AlertDialogTitle>
              <AlertDialogDescription>
                Seleziona una motivazione. Il lavoratore riceverà un messaggio automatico professionale e neutro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
                {REJECT_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/40">
                    <RadioGroupItem id={`rr-${r}`} value={r} />
                    <Label htmlFor={`rr-${r}`} className="cursor-pointer text-sm font-normal">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transitioning === "rejected"}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void submitReject(); }}
                disabled={transitioning === "rejected"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {transitioning === "rejected" ? "Rifiuto in corso…" : "Conferma rifiuto"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vuoi annullare la candidatura?</AlertDialogTitle>
              <AlertDialogDescription>
                Se annulli questa candidatura, il ristoratore verrà avvisato e non potrà più accettarti per questo turno.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Torna indietro</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void cancelApplication(); }}
                disabled={cancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelling ? "Annullamento…" : "Conferma annullamento"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Popup di conferma per il LAVORATORE quando dichiara interesse. */}
        <AlertDialog open={interestConfirmOpen} onOpenChange={setInterestConfirmOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confermi il tuo interesse?</AlertDialogTitle>
              <AlertDialogDescription>
                Stai inviando la tua disponibilità al ristoratore. Dopo l'invio dovrai attendere la sua conferma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-1 text-sm">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="font-semibold">ATTENZIONE: il turno non è ancora confermato.</div>
                <div className="text-xs mt-1">
                  Stai inviando la tua disponibilità al ristoratore. Dopo l'invio dovrai attendere la sua conferma.
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
                <div>
                  Solo quando il ristoratore confermerà definitivamente il turno, sbloccherai:
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>nome del locale</li>
                  <li>indirizzo completo</li>
                  <li>referente sul posto</li>
                  <li>istruzioni operative finali</li>
                </ul>
                <div>
                  Fino a quel momento vedrai solo città, zona e informazioni generali del servizio.
                </div>
              </div>
              {ann && (() => {
                const rows: Array<{ label: string; value: string }> = [];
                const roleLabel = (ann.professional_profile ?? "").toString().trim();
                if (roleLabel) rows.push({ label: "Ruolo", value: roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1) });
                if (ann.service_date) rows.push({ label: "Data", value: formatDateIT(ann.service_date) });
                const start = ann.service_time ? String(ann.service_time).slice(0, 5) : "";
                const end = (ann as any).end_time ? String((ann as any).end_time).slice(0, 5) : "";
                if (start) rows.push({ label: "Orario", value: end ? `${start} - ${end}` : start });
                const zona = [ann.job_city, (ann as any).job_province].filter(Boolean).join(" · ");
                if (zona) rows.push({ label: "Città/Zona", value: zona });
                const amt = ann.tariff_amount == null ? null : Number(ann.tariff_amount);
                if (amt != null && Number.isFinite(amt) && amt > 0) {
                  rows.push({ label: "Compenso", value: formatTariff(ann.tariff_amount ?? null, ann.tariff_type ?? null) });
                }
                const dress = labelsOf((ann as any).dress_code_items ?? [], DRESS_CODE_OPTIONS as any).filter(Boolean);
                if (dress.length) rows.push({ label: "Dress code", value: dress.join(", ") });
                const tasks = labelsOf((ann as any).required_skills ?? [], SKILL_OPTIONS as any).filter(Boolean);
                if (tasks.length) rows.push({ label: "Mansioni", value: tasks.join(", ") });
                if (rows.length === 0) return null;
                return (
                  <ul className="rounded-md border divide-y text-xs">
                    {rows.map((r) => (
                      <li key={r.label} className="flex gap-2 px-3 py-1.5">
                        <span className="w-24 shrink-0 text-muted-foreground">{r.label}</span>
                        <span className="flex-1 font-medium">{r.value}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transitioning === "interested"}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                disabled={transitioning === "interested"}
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== "undefined") {
                    // eslint-disable-next-line no-console
                    console.log("[PUPILLO_WORKER_INTEREST_CONFIRMATION_POPUP_DEBUG]", {
                      worker_user_id: app?.worker_id,
                      restaurant_user_id: app?.restaurant_id,
                      proposal_id: msgs.find((m) => m.template_id === PROPOSAL_TEMPLATE_ID && m.sender_id === app?.restaurant_id)?.id ?? null,
                      job_request_id: app?.announcement_id ?? null,
                      shift_id: shift?.id ?? null,
                      status_before: app?.status ?? null,
                      status_after: "interested",
                      visible_before_confirm: ["ruolo", "data", "orario", "città", "zona", "compenso", "dress_code", "mansioni_generali", "requisiti_generali"],
                      hidden_until_confirm: ["nome_reale_locale", "indirizzo_completo", "referente_sul_posto", "istruzioni_operative_complete", "dettagli_accesso", "contatto_operativo"],
                      popup_shown: true,
                      cta_text: "Confermo interesse",
                    });
                  }
                  setInterestConfirmOpen(false);
                  void transition("interested");
                }}
              >
                {transitioning === "interested" ? "Invio in corso…" : "Confermo interesse"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet open={reviewsOpen} onOpenChange={setReviewsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Recensioni del lavoratore</SheetTitle>
              <SheetDescription>
                Solo recensioni verificate collegate a turni completati. I nomi dei locali precedenti sono oscurati per privacy.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {workerReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Questo lavoratore non ha ancora recensioni. Puoi comunque valutare il profilo, le competenze e le informazioni disponibili.
                </p>
              ) : (
                workerReviews.map((r) => {
                  const roleLabel = r.announcement_id ? reviewRoles[r.announcement_id] : null;
                  return (
                    <div key={r.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="inline-flex items-center gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          <Lock className="h-3 w-3" /> Locale verificato
                        </span>
                        {roleLabel && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                            <Briefcase className="h-3 w-3" /> {roleLabel}
                          </span>
                        )}
                        <WouldRehireBadge value={r.would_rehire as ("yes" | "maybe" | "no" | null)} />
                      </div>
                      {r.comment ? (
                        <p className="text-sm text-foreground/90 whitespace-pre-line">"{r.comment}"</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nessun commento</p>
                      )}
                      <ReviewLabelsDisplay
                        positive={r.positive_tags}
                        negative={r.negative_tags}
                        className="mt-2"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </SheetContent>
        </Sheet>
        <AlertDialog open={instructionsReminderOpen} onOpenChange={setInstructionsReminderOpen}>
          <AlertDialogContent className="bg-background border-2 border-primary/50 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold">
                Conferma le istruzioni del turno
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Prima di iniziare il servizio devi leggere e confermare le istruzioni ricevute dal ristoratore.
                  </p>
                  <p>Controlla con attenzione:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>orario di arrivo</li>
                    <li>indirizzo</li>
                    <li>dress code</li>
                    <li>referente sul posto</li>
                    <li>note operative</li>
                  </ul>
                  <p>
                    Dopo aver letto tutto, clicca su "Ho letto e confermo le istruzioni".
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setInstructionsReminderOpen(false);
                  requestAnimationFrame(() => {
                    const el = document.getElementById("instructions-card");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                Vai alle istruzioni
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={ackDialogBusy}
                onClick={async (e) => {
                  e.preventDefault();
                  if (ackDialogBusy) return;
                  setAckDialogBusy(true);
                  try {
                    await acknowledgeInstructions();
                  } finally {
                    setAckDialogBusy(false);
                  }
                }}
              >
                {ackDialogBusy ? "Conferma in corso…" : "Confermo ora"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}

function TemplatePicker(props: {
  role: "restaurant" | "worker";
  category: TemplateCategory;
  setCategory: (c: TemplateCategory) => void;
  selected: MsgTemplate | null;
  setSelected: (t: MsgTemplate | null) => void;
  onSend: () => void;
  sending: boolean;
  ann: Ann | null;
  otherName: string | null;
  addressOverride?: string | null;
  disabled?: boolean;
}) {
  const { role, category, setCategory, selected, setSelected, onSend, sending, ann, otherName, addressOverride, disabled } = props;
  const available = TEMPLATES.filter(t => (t.role === role || t.role === "both") && t.category !== "post_shift");
  const categories = Array.from(new Set(available.map(t => t.category))) as TemplateCategory[];
  const inCat = available.filter(t => t.category === category);
  const isClosureForRestaurant = role === "restaurant" && category === "post_shift";

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Scegli un messaggio</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Per la sicurezza di tutti, in chat si possono inviare solo messaggi preimpostati. Non è possibile scrivere testo libero.
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { setCategory(c); setSelected(null); }}
            className={`text-xs rounded-full px-3 py-1 border transition ${category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      {isClosureForRestaurant ? (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <div className="font-semibold mb-1">Chiusura turno</div>
          <p className="text-muted-foreground text-xs">
            Conferma la fine del servizio e lascia una recensione al lavoratore nel blocco qui sotto.
          </p>
        </div>
      ) : inCat.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nessun messaggio preimpostato disponibile per questa fase.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {inCat.map(t => {
            const isSelected = selected?.key === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(t)}
                className={`text-left text-sm rounded-xl border px-3 py-2 transition ${isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/40"}`}
              >
                {renderTemplate(t.text, ann, otherName, addressOverride)}
              </button>
            );
          })}
        </div>
      )}
      {selected && !isClosureForRestaurant && (
        <div className="rounded-xl border bg-secondary/30 p-3 text-sm">
          <div className="text-xs text-muted-foreground mb-1">Anteprima:</div>
          {renderTemplate(selected.text, ann, otherName, addressOverride)}
        </div>
      )}
      {!isClosureForRestaurant && (
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSend}
          disabled={!selected || sending || disabled}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {sending ? "Invio in corso…" : "Invia messaggio"}
        </Button>
      </div>
      )}
      {disabled && (
        <p className="text-xs text-muted-foreground text-center">
          Conversazione chiusa: non è possibile inviare nuovi messaggi.
        </p>
      )}
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
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`${n} stelle`}
          >
            <Star
              className={`h-7 w-7 transition ${active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground">
        {value ? RATING_LABELS[value] : "Seleziona valutazione"}
      </span>
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Insufficiente",
  2: "Da migliorare",
  3: "Buono",
  4: "Molto buono",
  5: "Eccellente",
};

function ReviewBlock(props: {
  id?: string;
  existing: Review | null;
}) {
  const { id, existing } = props;
  if (!existing) return null;
    return (
      <div id={id} className="mt-4 rounded-2xl border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Recensione inviata</h3>
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(n => (
            <Star key={n} className={`h-5 w-5 ${n <= existing.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} strokeWidth={1.5} />
          ))}
          <span className="ml-2 text-sm font-medium">{existing.rating}.0 — {RATING_LABELS[existing.rating]}</span>
        </div>
        {existing.comment && <p className="text-sm">{existing.comment}</p>}
        {existing.tags && existing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {existing.tags.map(t => (
              <span key={t} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">{t}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Hai già recensito questo turno. Non è possibile modificarla.</p>
      </div>
    );
}

function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workerName: string | null;
  workerRole: string | null;
  shiftDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  shiftStatus: string | null;
  workerId?: string | null;
  restaurantId?: string | null;
  shiftId?: string | null;
  onSubmit: (payload: {
    general: number;
    reliability: number;
    punctuality: number;
    professionalism: number;
    serviceQuality: number;
    teamwork: number;
    comment: string;
    positiveLabels: string[];
    negativeLabels: string[];
    wouldRehire: "yes" | "maybe" | "no" | null;
  }) => Promise<void>;
}) {
  const { open, onOpenChange, workerName, workerRole, shiftDate, startTime, endTime, venue, shiftStatus, workerId, restaurantId, shiftId, onSubmit } = props;
  const [reliability, setReliability] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [professionalism, setProfessionalism] = useState(5);
  const [serviceQuality, setServiceQuality] = useState(5);
  const [teamwork, setTeamwork] = useState(5);
  const [comment, setComment] = useState("");
  const [positiveLabels, setPositiveLabels] = useState<string[]>([]);
  const [negativeLabels, setNegativeLabels] = useState<string[]>([]);
  const [wouldRehire, setWouldRehire] = useState<"yes" | "maybe" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Default: 5 stelle su ogni criterio
      setReliability(5); setPunctuality(5); setProfessionalism(5);
      setServiceQuality(5); setTeamwork(5);
      try {
        console.log("[PUPILLO_REVIEW_MODAL_OPENED]", {
          restaurant_id: restaurantId ?? null,
          worker_id: workerId ?? null,
          shift_id: shiftId ?? null,
        });
        console.log("[PUPILLO_REVIEW_DEFAULT_STARS_SET]", {
          puntualita: 5, professionalita: 5, qualita_servizio: 5,
          affidabilita: 5, collaborazione_team: 5,
        });
      } catch { /* */ }
    } else {
      setComment(""); setError(null);
      setPositiveLabels([]); setNegativeLabels([]); setWouldRehire(null);
    }
  }, [open, restaurantId, workerId, shiftId]);

  const allRated = reliability > 0 && punctuality > 0 && professionalism > 0 && serviceQuality > 0 && teamwork > 0;

  const handleSubmit = async () => {
    try {
      console.log("[PUPILLO_REVIEW_SUBMIT_ATTEMPT]", {
        restaurant_id: restaurantId ?? null,
        worker_id: workerId ?? null,
        shift_id: shiftId ?? null,
        default_ratings: { punctuality, professionalism, serviceQuality, reliability, teamwork },
        would_rehire: wouldRehire,
      });
    } catch { /* */ }
    if (!allRated) {
      setError("Completa tutte le valutazioni prima di inviare la recensione.");
      return;
    }
    if (!wouldRehire) {
      setError("Seleziona se richiameresti questo lavoratore per un prossimo turno.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // "general" = media arrotondata dei 5 criteri (non più input separato)
      const general = Math.round((reliability + punctuality + professionalism + serviceQuality + teamwork) / 5);
      await onSubmit({ general, reliability, punctuality, professionalism, serviceQuality, teamwork, comment, positiveLabels, negativeLabels, wouldRehire });
    } finally { setSubmitting(false); }
  };

  const dateStr = shiftDate ? new Date(shiftDate).toLocaleDateString("it-IT") : "—";
  const timeStr = [startTime?.slice(0,5), endTime?.slice(0,5)].filter(Boolean).join(" – ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recensisci il lavoratore</DialogTitle>
          <DialogDescription>Valuta il lavoratore per il servizio appena concluso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border bg-secondary/30 p-3">
            {workerId && <UserAvatar userId={workerId} name={workerName ?? undefined} className="h-12 w-12 shrink-0" />}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-base truncate">{workerName ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[workerRole, dateStr, timeStr].filter(Boolean).join(" · ")}
              </div>
              {venue && <div className="text-[11px] text-muted-foreground truncate">{venue}</div>}
            </div>
          </div>

          <CriterionRow label="Puntualità" value={punctuality} onChange={setPunctuality} />
          <CriterionRow label="Professionalità" value={professionalism} onChange={setProfessionalism} />
          <CriterionRow label="Qualità del servizio" value={serviceQuality} onChange={setServiceQuality} />
          <CriterionRow label="Affidabilità" value={reliability} onChange={setReliability} />
          <CriterionRow label="Collaborazione con il team" value={teamwork} onChange={setTeamwork} />

          <div>
            <label className="block text-xs font-medium mb-1">Commento (opzionale)</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Scrivi un commento sul servizio svolto, se vuoi."
              rows={3}
              maxLength={500}
            />
          </div>

          <ReviewLabelsPicker
            positive={positiveLabels}
            negative={negativeLabels}
            onChange={({ positive, negative }) => { setPositiveLabels(positive); setNegativeLabels(negative); }}
            disabled={submitting}
          />

          <WouldRehirePicker value={wouldRehire} onChange={setWouldRehire} disabled={submitting} />

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Salva recensione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CriterionRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-medium">{label}</div>
      <StarPicker value={value} onChange={onChange} />
    </div>
  );
}

function ProposalDebugPanel({ conversationId, messageId, info, effectiveStatus, open, onToggle }: {
  conversationId: string;
  messageId: string;
  info: { responseId: string | null; responseStatus: string | null; responseAt: string | null; notifications: { id: string; user_id: string; title: string; read: boolean | null; created_at: string }[] } | undefined;
  effectiveStatus: string;
  open: boolean;
  onToggle: () => void;
}) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiato");
    } catch {
      toast.error("Copia non riuscita");
    }
  };
  const notifCount = info?.notifications.length ?? 0;
  const unreadCount = (info?.notifications ?? []).filter((n) => !n.read).length;
  return (
    <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 text-[11px] font-mono text-foreground/80 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-amber-100/60 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
      >
        <span className="font-semibold tracking-wide">DEBUG · proposta</span>
        <span className="text-[10px] opacity-70">
          stato: {effectiveStatus} · notif: {notifCount} ({unreadCount} non lette) · {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1 break-all">
          <div className="flex items-start gap-2">
            <span className="opacity-60 shrink-0">conversation_id:</span>
            <button type="button" onClick={() => copy(conversationId)} className="underline-offset-2 hover:underline text-left">{conversationId}</button>
          </div>
          <div className="flex items-start gap-2">
            <span className="opacity-60 shrink-0">message_id:</span>
            <button type="button" onClick={() => copy(messageId)} className="underline-offset-2 hover:underline text-left">{messageId}</button>
          </div>
          <div className="flex items-start gap-2">
            <span className="opacity-60 shrink-0">proposal_id:</span>
            {info?.responseId ? (
              <button type="button" onClick={() => copy(info.responseId!)} className="underline-offset-2 hover:underline text-left">
                {info.responseId} <span className="opacity-60">({info.responseStatus})</span>
              </button>
            ) : (
              <span className="opacity-60">— nessuna risposta registrata</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="opacity-60 shrink-0">response_at:</span>
            <span>{info?.responseAt ? new Date(info.responseAt).toLocaleString("it-IT") : "—"}</span>
          </div>
          <div>
            <div className="opacity-60">notifications ({notifCount}):</div>
            {notifCount === 0 ? (
              <div className="pl-2 opacity-60">— nessuna notifica trovata per questa conversazione</div>
            ) : (
              <ul className="pl-2 space-y-0.5">
                {info!.notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-1">
                    <span className={n.read ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                      {n.read ? "✓ letta" : "● non letta"}
                    </span>
                    <span className="opacity-80">·</span>
                    <span className="opacity-80">{n.title}</span>
                    <span className="opacity-60">·</span>
                    <span className="opacity-60">user: {n.user_id.slice(0, 8)}…</span>
                    <span className="opacity-60">·</span>
                    <span className="opacity-60">{new Date(n.created_at).toLocaleString("it-IT")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalCard(props: {
  message: Msg;
  ann: Ann | null;
  venueName: string | null;
  displayAddress: string | null;
  canSeePreciseInfo: boolean;
  isWorker: boolean;
  status: string;
  lockReason?: "completed" | "cancelled" | null;
  specialBlock?: SpecialAvailabilityBlock | null;
  onAccept: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
}) {
  const { ann, venueName, displayAddress, canSeePreciseInfo, isWorker, status, onAccept, onReject } = props;
  const lockReason = props.lockReason ?? null;
  const specialBlock = props.specialBlock ?? null;
  const incompatibleSpecial = !!specialBlock?.blocked;
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const WORKER_REJECT_REASONS = [
    "Non sono disponibile",
    "Orario non compatibile",
    "Zona troppo distante",
    "Compenso non adatto",
    "Ho già un altro impegno",
    "Altro motivo",
  ] as const;
  // The proposal expires at the SHIFT START (full local datetime). After the
  // service has started, the worker can no longer accept/refuse — but until
  // then the proposal must remain active even if end_time is "00:00" of the
  // next day. Never compare bare HH:MM strings.
  const deadline = useMemo<Date | null>(() => {
    if (!ann?.service_date) return null;
    const startTime = (ann.service_time ?? "").slice(0, 5);
    if (!startTime) return null;
    const start = new Date(`${ann.service_date}T${startTime}:00`);
    return isNaN(start.getTime()) ? null : start;
  }, [ann?.service_date, ann?.service_time]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [deadline]);
  const timeExpired = deadline ? deadline.getTime() <= now : false;
  const accepted = status === "accepted";
  const rejected = status === "rejected" || status === "not_interested";
  const expired = status === "expired" || (!accepted && !rejected && timeExpired);
  const locked = lockReason !== null;
  const decided = accepted || rejected || expired || locked;

  const openAccept = () => {
    if (busy || decided) return;
    setConfirmAccept(true);
  };
  const openReject = () => {
    if (busy || decided) return;
    setRejectReason("");
    setConfirmReject(true);
  };
  const doAccept = async () => {
    if (busy) return;
    if (incompatibleSpecial) {
      toast.error(SPECIAL_ACCEPT_INCOMPATIBLE_MESSAGE);
      setConfirmAccept(false);
      return;
    }
    if (locked) {
      toast.error("Non puoi accettare questa proposta perché il turno è stato annullato.");
      setConfirmAccept(false);
      return;
    }
    if (decided) {
      toast.error("Questa proposta non è più disponibile.");
      setConfirmAccept(false);
      return;
    }
    setBusy("accept");
    try {
      await onAccept();
      setConfirmAccept(false);
    } finally {
      setBusy(null);
    }
  };
  const doReject = async () => {
    if (busy) return;
    if (locked) {
      toast.error("Non puoi rifiutare questa proposta perché il turno è stato annullato.");
      setConfirmReject(false);
      return;
    }
    if (decided) {
      toast.error("Questa proposta non è più disponibile.");
      setConfirmReject(false);
      return;
    }
    const reason = rejectReason.trim() || undefined;
    setBusy("reject");
    try {
      await onReject(reason);
      setConfirmReject(false);
    } finally {
      setBusy(null);
    }
  };

  // Compact recap rows used inside the confirmation dialogs.
  const recapRows: Array<{ label: string; value: string }> = [];
  const role = ann?.professional_profile?.trim();
  if (role) recapRows.push({ label: "Ruolo", value: role });
  if (ann?.service_date) recapRows.push({ label: "Data", value: formatDateIT(ann.service_date) });
  if (ann?.service_time) {
    recapRows.push({
      label: "Orario",
      value: `${ann.service_time.slice(0, 5)}${ann.end_time ? " - " + ann.end_time.slice(0, 5) : ""}`,
    });
  }
  if (ann?.duration_hours) recapRows.push({ label: "Durata", value: `${ann.duration_hours} h` });
  const zona = [displayAddress, ann?.job_city]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find((v) => v && v.toLowerCase() !== "undefined" && v.toLowerCase() !== "null");
  if (zona) recapRows.push({ label: canSeePreciseInfo ? "Luogo" : "Zona", value: zona });
  if (ann?.tariff_amount != null) {
    const n = Number(ann.tariff_amount);
    if (Number.isFinite(n) && n > 0) {
      recapRows.push({ label: "Compenso", value: formatTariff(ann.tariff_amount, ann.tariff_type ?? null) });
    }
  }
  const dressItems = labelsOf(ann?.dress_code_items ?? [], DRESS_CODE_OPTIONS as any);
  const dressNotes = (ann?.dress_code_notes ?? "").trim();
  const dressValue = [dressItems.join(", "), dressNotes].filter(Boolean).join(" — ");
  if (dressValue) recapRows.push({ label: "Dress code", value: dressValue });
  const tasks = labelsOf(ann?.required_skills ?? [], SKILL_OPTIONS as any);
  if (tasks.length) recapRows.push({ label: "Mansioni", value: tasks.join(", ") });

  return (
    <>
    <div className="flex justify-center my-2">
      <div className="w-full max-w-md rounded-2xl border-2 border-primary/40 bg-card shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.45)] overflow-hidden">
        <div className="bg-primary/10 px-4 py-3 border-b border-primary/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm">Nuova proposta di lavoro</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ciao, sei disponibile per questo turno?</p>
        </div>
        <dl className="px-4 py-3 space-y-2 text-sm">
          <ProposalRow icon={Briefcase} label="Ruolo" value={ann?.professional_profile?.trim() || "Da definire"} />
          {ann?.service_date && (
            <ProposalRow icon={Calendar} label="Data" value={formatDateIT(ann.service_date)} />
          )}
          {ann?.service_time && (
            <ProposalRow
              icon={Clock}
              label="Orario"
              value={`${ann.service_time.slice(0, 5)}${ann.end_time ? " - " + ann.end_time.slice(0, 5) : ""}`}
            />
          )}
          {canSeePreciseInfo && (
            <ProposalRow icon={Building2} label="Locale" value={venueName?.trim() || "Locale da confermare"} />
          )}
          {(() => {
            const luogo = [displayAddress, ann?.job_city]
              .map((v) => (typeof v === "string" ? v.trim() : ""))
              .find((v) => v && v.toLowerCase() !== "undefined" && v.toLowerCase() !== "null");
            const label = canSeePreciseInfo ? "Luogo" : "Zona";
            return luogo ? <ProposalRow icon={MapPin} label={label} value={luogo} /> : null;
          })()}
          {(() => {
            if (ann?.tariff_amount == null) return null;
            const n = Number(ann.tariff_amount);
            if (!Number.isFinite(n) || n <= 0) return null;
            return <ProposalRow icon={Euro} label="Compenso" value={formatTariff(ann.tariff_amount, ann.tariff_type ?? null)} />;
          })()}
          {(() => {
            const items = labelsOf(ann?.dress_code_items ?? [], DRESS_CODE_OPTIONS as any);
            const notes = (ann?.dress_code_notes ?? "").trim();
            const value = [items.join(", "), notes].filter(Boolean).join(" — ");
            return value ? <ProposalRow icon={Shirt} label="Dress code" value={value} /> : null;
          })()}
          {(() => {
            const items = labelsOf(ann?.required_skills ?? [], SKILL_OPTIONS as any);
            return items.length ? <ProposalRow icon={ListChecks} label="Mansioni" value={items.join(", ")} /> : null;
          })()}
          {(() => {
            const items = labelsOf(ann?.language_requirements ?? [], LANGUAGE_OPTIONS as any);
            return items.length ? <ProposalRow icon={LanguagesIcon} label="Lingue richieste" value={items.join(", ")} /> : null;
          })()}
          {(() => {
            const lic = labelOf(ann?.license_requirement ?? null, LICENSE_OPTIONS as any);
            return lic ? <ProposalRow icon={BadgeCheck} label="Requisiti" value={lic} /> : null;
          })()}
          {(() => {
            const directions = (ann?.job_additional_directions ?? "").trim();
            return directions ? <ProposalRow icon={Info} label="Indicazioni operative" value={directions} /> : null;
          })()}
          {ann?.notes && ann.notes.trim() && ann.notes.trim().toLowerCase() !== "undefined" && (
            <ProposalRow icon={StickyNote} label="Note" value={ann.notes.trim()} />
          )}
        </dl>
        {!canSeePreciseInfo ? (
          <div className="mx-4 mb-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Dati completi disponibili dopo l'accettazione
            </div>
            <p className="mt-1 text-xs leading-relaxed">
              Per proteggere la privacy del locale, nome reale, indirizzo completo, referente e istruzioni operative verranno mostrati solo dopo che avrai accettato la proposta.
            </p>
          </div>
        ) : (
          <div className="mx-4 mb-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-semibold">
              <Unlock className="h-4 w-4 shrink-0" />
              Dati operativi sbloccati
            </div>
            <p className="mt-1 text-xs leading-relaxed">
              Trovi nome del locale, indirizzo completo, referente e indicazioni nel messaggio "Proposta accettata: dettagli operativi disponibili" qui sotto in chat.
            </p>
          </div>
        )}

        {deadline && !accepted && !rejected && (
          <div className={`mx-4 mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            expired
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}>
            <AlarmClock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {expired
                ? `Scaduta il ${deadline.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} alle ${deadline.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
                : `Scade il ${deadline.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} alle ${deadline.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        )}

        {locked && !accepted && !rejected ? (
          <div className="px-4 py-3 border-t text-sm font-semibold flex items-center justify-center gap-2 bg-destructive/10 text-destructive border-destructive/30 text-center">
            <X className="h-4 w-4 shrink-0" />
            <span>
              {lockReason === "completed"
                ? "Questo turno è stato concluso. Non è più possibile accettare o rifiutare la proposta."
                : "Questo turno è stato annullato. Non è più possibile accettare o rifiutare la proposta."}
            </span>
          </div>
        ) : decided ? (
          <div className={`px-4 py-3 border-t text-sm font-semibold flex items-center justify-center gap-2 ${
            accepted
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              : expired
                ? "bg-muted text-muted-foreground border-border"
                : "bg-destructive/10 text-destructive border-destructive/30"
          }`}>
            {accepted ? <Check className="h-4 w-4" /> : expired ? <AlarmClock className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {accepted ? (isWorker ? "Hai accettato la proposta. Attendi l'assegnazione definitiva da parte del ristoratore." : "Proposta accettata") :
              expired ? "Proposta scaduta" :
              (isWorker ? "Hai rifiutato questa proposta." : "Proposta rifiutata")}
          </div>
        ) : isWorker ? (
          incompatibleSpecial ? (
            <div className="px-4 py-3 border-t bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm">
              <div className="font-semibold inline-flex items-center gap-1">
                <X className="h-4 w-4" />
                Questa proposta non è compatibile con la disponibilità speciale che hai impostato per questa data.
              </div>
              {specialBlock?.specials.map((e) => (
                <p key={e.id} className="mt-0.5 text-xs opacity-90">· {describeSpecialAvailability(e)}</p>
              ))}
              <div className="mt-2 flex gap-2">
                <Button type="button" disabled className="flex-1 h-11 bg-emerald-600/50 text-white font-semibold gap-2 cursor-not-allowed">
                  <Check className="h-4 w-4" /> Accetta proposta
                </Button>
                <Button
                  type="button"
                  onClick={openReject}
                  disabled={!!busy}
                  variant="outline"
                  className="flex-1 h-11 border-destructive text-destructive hover:bg-destructive/10 font-semibold gap-2"
                >
                  <X className="h-4 w-4" />
                  {busy === "reject" ? "Operazione in corso…" : "Rifiuta"}
                </Button>
              </div>
            </div>
          ) : (
          <div className="px-4 py-3 border-t bg-secondary/30 flex gap-2">
            <Button
              type="button"
              onClick={openAccept}
              disabled={!!busy}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              <Check className="h-4 w-4" />
              {busy === "accept" ? "Operazione in corso…" : "Accetta proposta"}
            </Button>
            <Button
              type="button"
              onClick={openReject}
              disabled={!!busy}
              variant="outline"
              className="flex-1 h-11 border-destructive text-destructive hover:bg-destructive/10 font-semibold gap-2"
            >
              <X className="h-4 w-4" />
              {busy === "reject" ? "Operazione in corso…" : "Rifiuta"}
            </Button>
          </div>
          )
        ) : (
          <div className="px-4 py-3 border-t bg-secondary/20 text-xs text-muted-foreground text-center">
            In attesa di risposta dal lavoratore.
          </div>
        )}
      </div>
    </div>

    {/* Confirm ACCEPT */}
    <AlertDialog open={confirmAccept} onOpenChange={(o) => { if (!busy) setConfirmAccept(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confermi di voler accettare?</AlertDialogTitle>
          <AlertDialogDescription>
            Stai per accettare questa proposta di lavoro. Dopo la conferma il turno sarà assegnato a te e il ristoratore riceverà la tua risposta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold">
            <Unlock className="h-4 w-4 shrink-0" />
            Sbloccherai subito tutti i dati operativi
          </div>
          <p className="mt-1 text-xs leading-relaxed">
            Accettando questa proposta riceverai subito tutti i dettagli operativi: nome locale, indirizzo completo, referente, orario di ingresso, anticipo richiesto, dress code e istruzioni per il servizio.
          </p>
        </div>
        {recapRows.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            {recapRows.map((r) => (
              <div key={r.label} className="flex gap-2">
                <span className="text-muted-foreground min-w-24">{r.label}:</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy === "accept"}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void doAccept(); }}
            disabled={busy === "accept"}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {busy === "accept" ? "Operazione in corso…" : "Sì, accetto la proposta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Confirm REJECT */}
    <AlertDialog open={confirmReject} onOpenChange={(o) => { if (!busy) setConfirmReject(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confermi di voler rifiutare?</AlertDialogTitle>
          <AlertDialogDescription>
            Stai per rifiutare questa proposta di lavoro. Il ristoratore riceverà la tua risposta e la proposta non sarà più disponibile.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {recapRows.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            {recapRows
              .filter((r) => ["Ruolo", "Data", "Orario", "Zona", "Luogo", "Compenso"].includes(r.label))
              .map((r) => (
                <div key={r.label} className="flex gap-2">
                  <span className="text-muted-foreground min-w-24">{r.label}:</span>
                  <span className="font-medium">{r.value}</span>
                </div>
              ))}
          </div>
        )}
        <div className="py-1">
          <Label className="text-sm font-medium">Motivo del rifiuto (facoltativo)</Label>
          <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="mt-2 space-y-1.5">
            {WORKER_REJECT_REASONS.map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-md border px-3 py-1.5 hover:bg-muted/40">
                <RadioGroupItem id={`wrr-${r}`} value={r} />
                <Label htmlFor={`wrr-${r}`} className="cursor-pointer text-sm font-normal">{r}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy === "reject"}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void doReject(); }}
            disabled={busy === "reject"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy === "reject" ? "Operazione in corso…" : "Sì, rifiuto la proposta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function ShiftClosedWithReviewCard({ review }: { review: Review | null }) {
  const wouldRehireLabel = (v?: string | null) => {
    if (v === "yes") return "Sì";
    if (v === "maybe") return "Forse";
    if (v === "no") return "No";
    return null;
  };
  const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    );
  };
  const formatScore = (n?: number | null) => (typeof n === "number" && n > 0 ? `${n}/5` : null);
  const tags = [
    ...((review?.positive_tags as string[] | null) ?? []),
    ...((review?.negative_tags as string[] | null) ?? []),
  ].filter(Boolean);
  const comment = review?.comment?.trim() ?? "";
  const rehire = wouldRehireLabel(review?.would_rehire ?? null);
  return (
    <div className="w-full max-w-md rounded-2xl border bg-emerald-500/10 border-emerald-500/30 px-4 py-3 space-y-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Turno chiuso e recensione ricevuta
          </span>
        </div>
        <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
          Servizio completato
        </span>
      </div>
      <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
        Il turno è stato chiuso dal ristoratore e hai ricevuto una recensione per il servizio svolto.
      </p>
      {review ? (
        <div className="rounded-xl bg-background/70 p-3 space-y-1.5 border border-emerald-500/20">
          <Row label="Valutazione generale" value={formatScore(review.rating)} />
          <Row label="Affidabilità" value={formatScore(review.reliability ?? null)} />
          <Row label="Puntualità" value={formatScore(review.punctuality ?? null)} />
          <Row label="Professionalità" value={formatScore(review.professionalism ?? null)} />
          <Row label="Qualità del servizio" value={formatScore(review.competence ?? null)} />
          {rehire && <Row label="Lo richiamerebbe" value={rehire} />}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
          {comment && (
            <div className="pt-1.5 border-t border-emerald-500/20 mt-1.5">
              <p className="text-xs text-foreground italic">"{comment}"</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProposalRow({ icon: Icon, label, value }: { icon: typeof Send; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className="font-medium break-words">{value}</span>
      </div>
    </div>
  );
}

function ConfirmationCard(props: {
  ann: Ann | null;
  venueName: string | null;
  applicationId: string;
  announcementId: string | null;
  isWorker: boolean;
  acknowledged?: boolean;
  arrivalAdvanceMinutes?: number | null;
  onAcknowledge?: () => Promise<void> | void;
}) {
  const { ann, venueName, applicationId, isWorker, acknowledged = false, arrivalAdvanceMinutes, onAcknowledge } = props;
  const [ackBusy, setAckBusy] = useState(false);
  const clean = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
    return s;
  };
  const role = clean(ann?.professional_profile) || "Ruolo non specificato";
  const venue = clean(venueName) || "Locale da confermare";
  const fullAddress = clean(ann?.location_address) || clean(ann?.job_address) || clean(ann?.job_city) || "Indirizzo non disponibile";
  const start = ann?.service_time ? ann.service_time.slice(0, 5) : null;
  const end = ann?.end_time ? ann.end_time.slice(0, 5) : null;
  const advMin = Number.isFinite(Number(arrivalAdvanceMinutes)) && Number(arrivalAdvanceMinutes) > 0
    ? Number(arrivalAdvanceMinutes)
    : DEFAULT_ARRIVAL_ADVANCE_MINUTES;
  const entryTime = computeEntryTime(ann?.service_time ?? null, advMin);
  const skills = labelsOf(ann?.required_skills ?? [], SKILL_OPTIONS as any);
  const dressItems = labelsOf(ann?.dress_code_items ?? [], DRESS_CODE_OPTIONS as any);
  const dressNotes = clean(ann?.dress_code_notes);
  const dressValue = [dressItems.join(", "), dressNotes].filter(Boolean).join(" — ");
  const contactName = clean(ann?.job_contact_person_name);
  const contactPhone = clean(ann?.job_contact_person_phone);
  const directions = clean(ann?.job_additional_directions) || clean(ann?.job_location_notes);
  const notes = clean(ann?.notes);
  const tariff = ann?.tariff_amount != null && Number.isFinite(Number(ann.tariff_amount)) && Number(ann.tariff_amount) > 0
    ? formatTariff(ann.tariff_amount, ann.tariff_type ?? null)
    : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  // Hide the acknowledge button after the shift end date has passed
  const shiftEnded = (() => {
    if (!ann?.service_date) return false;
    const d = new Date(ann.service_date);
    if (ann.end_time) {
      const [h, m] = ann.end_time.split(":").map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
    return d.getTime() < Date.now();
  })();
  const showAckButton = isWorker && !shiftEnded;

  return (
    <div className="flex justify-center my-2">
      <div className="w-full max-w-md rounded-2xl border-2 border-emerald-500/40 bg-card shadow-[0_8px_30px_-12px_rgb(16_185_129/0.45)] overflow-hidden">
        <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-wide">
              <Check className="h-3 w-3" />Confermato
            </span>
            <h4 className="font-bold text-sm">Candidatura confermata</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isWorker
              ? "Il ristoratore ha confermato la tua candidatura per questo servizio. Leggi attentamente le istruzioni operative prima del turno: sono informazioni importanti per presentarti nel modo corretto."
              : (acknowledged
                  ? "Il lavoratore ha confermato la lettura delle istruzioni."
                  : "In attesa di conferma lettura istruzioni da parte del lavoratore.")}
          </p>
        </div>
        <dl className="px-4 py-3 space-y-2 text-sm">
          <ProposalRow icon={Building2} label="Locale" value={venue} />
          <ProposalRow icon={Briefcase} label="Ruolo" value={role} />
          {ann?.service_date && (
            <ProposalRow icon={Calendar} label="Data" value={formatDateIT(ann.service_date)} />
          )}
          <ProposalRow
            icon={Clock}
            label="Orario"
            value={start ? `${start}${end ? ` - ${end}` : ""}` : CONFIRMATION_EMPTY_LABELS.endTime}
          />
          {entryTime && (
            <ProposalRow
              icon={AlarmClock}
              label="Orario ingresso"
              value={`${entryTime} · presentati ${advMin} minuti prima`}
            />
          )}
          <ProposalRow icon={MapPin} label="Indirizzo" value={fullAddress} />
          <ProposalRow
            icon={UserIcon}
            label="Referente"
            value={contactName || CONFIRMATION_EMPTY_LABELS.contactPerson}
          />
          {contactPhone && (
            <ProposalRow icon={Phone} label="Telefono" value={contactPhone} />
          )}
          <ProposalRow
            icon={Shirt}
            label="Dress code"
            value={dressValue || CONFIRMATION_EMPTY_LABELS.dressCode}
          />
          {skills.length > 0 && (
            <ProposalRow icon={ListChecks} label="Mansioni" value={skills.join(", ")} />
          )}
          {tariff && <ProposalRow icon={Euro} label="Compenso" value={tariff} />}
          <ProposalRow
            icon={Info}
            label="Istruzioni per l'arrivo"
            value={directions || CONFIRMATION_EMPTY_LABELS.directions}
          />
          <ProposalRow
            icon={StickyNote}
            label="Note operative"
            value={notes || CONFIRMATION_EMPTY_LABELS.notes}
          />
        </dl>
        <div className="mx-4 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          Ti consigliamo di arrivare almeno 10 minuti prima dell'orario di ingresso.
        </div>
        {acknowledged && (
          <div className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <BadgeCheck className="h-5 w-5" />
            Istruzioni confermate
          </div>
        )}
        <div className="px-4 py-4 border-t bg-secondary/20 flex flex-col gap-3">
          {showAckButton && (
            <Button
              size="lg"
              disabled={acknowledged || ackBusy}
              className="w-full h-12 text-base font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              onClick={async () => {
                if (acknowledged || ackBusy || !onAcknowledge) return;
                setAckBusy(true);
                try { await onAcknowledge(); } finally { setAckBusy(false); }
              }}
            >
              {acknowledged ? (
                <>
                  <BadgeCheck className="h-5 w-5" />
                  Istruzioni confermate
                </>
              ) : ackBusy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Registrazione…
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Ho letto e confermo le istruzioni
                </>
              )}
            </Button>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="flex-1 h-11 text-sm font-semibold gap-2 border-2 border-primary/60 text-primary hover:bg-primary/10"
            >
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Indicazioni
              </a>
            </Button>
            {isWorker && (
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-11 text-sm font-semibold gap-2 border-2 border-primary/60 text-primary hover:bg-primary/10"
                onClick={() => {
                  document.getElementById(`thread-template-picker-${applicationId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <Send className="h-4 w-4" />
                Scrivi al ristoratore
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}