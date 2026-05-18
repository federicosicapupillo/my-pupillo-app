import { createFileRoute, Link } from "@tanstack/react-router";
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
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { useRequiredReviews } from "@/lib/required-reviews";
import { summarizeReputation, type WorkerReputationInput, levelChipClass, scoreColorClass } from "@/lib/reputation";
import { shouldShowNewApplicationCard } from "@/lib/application-card";
import { Award } from "lucide-react";
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
} from "@/lib/shift-confirmation";
import { canAssignShift } from "@/lib/proposal-assign.functions";
import { formatDateIT, formatTariff } from "@/lib/format";
import { Calendar, Clock, MapPin, Briefcase, Building2, StickyNote, AlarmClock } from "lucide-react";
import { Shirt, ListChecks, Languages as LanguagesIcon, BadgeCheck, Info, Lock, Phone, User as UserIcon, Navigation, ExternalLink } from "lucide-react";
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

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversazione — Pupillo" }] }),
  component: () => <RequireAuth><Thread /></RequireAuth>,
});

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
  duration_hours?: number | null;
  location_address: string;
  tariff_amount: number;
  tariff_type: string;
  job_city?: string | null;
  restaurant_id?: string;
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

function renderTemplate(text: string, ann: Ann | null, otherName: string | null, addressOverride?: string | null): string {
  const date = ann?.service_date ? new Date(ann.service_date).toLocaleDateString("it-IT") : "—";
  const time = ann?.service_time ? ann.service_time.slice(0, 5) : "—";
  const address = addressOverride ?? ann?.location_address ?? "—";
  return text
    .replace(/{{shift_date}}/g, date)
    .replace(/{{start_time}}/g, time)
    .replace(/{{address}}/g, address)
    .replace(/{{restaurant_name}}/g, otherName ?? "—");
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

function buildTimeline(status?: string): Step[] {
  const s = status ?? "pending";
  const isReject = s === "rejected" || s === "not_interested";
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
      label: isCancelled ? "Annullata" : isReject ? "Rifiutata" : isExpired ? "Scaduta" : "Assegnata",
      icon: isReject || isExpired || isCancelled ? Ban : Check,
      state: isAccepted ? "done" : (isReject || isExpired || isCancelled) ? "error" : "todo" },
  ];
}

function Thread() {
  const { id } = Route.useParams();
  const { user, role, profile } = useAuth();
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const { isBlocked, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [creditsAvailable, setCreditsAvailable] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [app, setApp] = useState<App | null>(null);
  const [ann, setAnn] = useState<Ann | null>(null);
  const [other, setOther] = useState<{ name: string; city: string | null; neighborhood: string | null; profile_completed: boolean; phone_verified: boolean } | null>(null);
  const [otherIdentity, setOtherIdentity] = useState<{ businessName: string | null; fullName: string | null; firstName: string | null } | null>(null);
  const [hasWorkedTogether, setHasWorkedTogether] = useState(false);
  const [workerRep, setWorkerRep] = useState<WorkerReputationInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const [counterConfirmOpen, setCounterConfirmOpen] = useState(false);
  const [sendingCounter, setSendingCounter] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [transitioning, setTransitioning] = useState<null | "interested" | "not_interested" | "accepted" | "rejected">(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [tplCategory, setTplCategory] = useState<TemplateCategory>("application");
  const [selectedTpl, setSelectedTpl] = useState<MsgTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, "accepted" | "rejected">>({});
  const [serverAssign, setServerAssign] = useState<{ canAssign: boolean; reason: string | null } | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
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
          supabase.from("profiles").select("full_name, first_name, business_name, city, neighborhood, reputation_score, reputation_level, completed_shifts, no_show_count, punctuality_pct, completion_pct, rehire_restaurants_count, rehire_yes_count, rehire_total_answers, distinct_restaurants_count, rating_avg, reviews_count, avatar_url, phone_verified, profile_completed, id_document_path").eq("id", otherId).maybeSingle(),
          supabase.from("announcements").select("id, service_date, service_time, end_time, duration_hours, location_address, tariff_amount, tariff_type, job_city, restaurant_id, assigned_worker_id, notes, professional_profile, dress_code_items, dress_code_notes, required_skills, language_requirements, license_requirement, job_access_restrictions, job_additional_directions, job_location_notes, job_address, job_contact_person_name, job_contact_person_phone").eq("id", a.announcement_id).maybeSingle(),
        ]);
        setOther({
          name: p?.business_name || p?.full_name || "Utente",
          city: (p as any)?.city ?? null,
          neighborhood: (p as any)?.neighborhood ?? null,
          profile_completed: !!(p as any)?.profile_completed,
          phone_verified: !!(p as any)?.phone_verified,
        });
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
        setAnn(an as Ann | null);
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
          const { data: rev } = await supabase
            .from("reviews")
            .select("id, rating, comment, tags, created_at, author_id, target_id, shift_id")
            .eq("shift_id", (sh as any).id)
            .eq("author_id", user.id)
            .maybeSingle();
          setExistingReview((rev as Review | null) ?? null);
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
          setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x));
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` },
        (p) => setApp(p.new as App))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `entity_id=eq.${id}` },
        (p) => setEvents(prev => [...prev, p.new as LogEvent]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "proposal_responses", filter: `application_id=eq.${id}` },
        (p) => {
          const r = p.new as { message_id: string; status: "accepted" | "rejected" };
          setProposalStatuses(prev => prev[r.message_id] === r.status ? prev : { ...prev, [r.message_id]: r.status });
        })
      .subscribe((status) => {
        // On disconnect / error, trigger a refetch when the channel comes back.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setTimeout(() => setRefetchSeq((s) => s + 1), 1500);
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [id, user, refetchSeq]);

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

  const sendTemplate = async () => {
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
      const body = renderTemplate(selectedTpl.text, ann, other?.name ?? null, displayAddress);
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
      // Server-side authority: verify the current proposal has been accepted by the worker.
      try {
        const check = await canAssignShift({ data: { applicationId: id } });
        if (!check.canAssign) {
          toast.error(check.reason ?? "Impossibile assegnare il turno in questo momento.");
          return;
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Verifica server non riuscita.");
        return;
      }
      if (isBlocked) {
        setBlockOpen(true);
        return;
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
        setCreditsAvailable(balance);
        setInsufficientOpen(true);
        return;
      }
      const { consumeCredits } = await import("@/lib/credits");
      const ok = await consumeCredits(CREDITS_PER_HIRE, "assign_worker", app.announcement_id ?? id);
      if (!ok) return;
    }
    const patch: any = { status: next, ...extra };
    if (role === "worker") patch.worker_response_at = new Date().toISOString();
    const { error } = await supabase.from("applications").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (next === "accepted" && app.announcement_id) {
      await supabase.from("announcements").update({ status: "assigned", assigned_worker_id: app.worker_id }).eq("id", app.announcement_id);
    }
    // Quando il ristoratore accetta la candidatura, invia automaticamente al
    // lavoratore una "Conferma turno" con tutti i dettagli operativi in chiaro.
    if (next === "accepted" && role === "restaurant") {
      try {
        const venueName = profile?.business_name || profile?.full_name || null;
        const body = buildConfirmationBody(ann, venueName);
        const createdAt = new Date().toISOString();
        const receiverId = app.worker_id;
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
          last_message_preview: "Candidatura accettata · dettagli del turno inviati",
          last_message_at: createdAt,
        } as never).eq("id", app.id);
        await supabase.from("notifications").insert({
          user_id: receiverId,
          title: "Candidatura accettata",
          body: `Il ristoratore ha confermato la tua presenza per il turno${ann?.service_date ? ` del ${formatDateIT(ann.service_date)}` : ""}.`,
          link: `/messages/${app.id}`,
        } as never);
      } catch (e) {
        console.error("[accept] confirmation message failed", e);
      }
    }
    await logEvent(next, { by_role: role ?? undefined });
    const isRestaurant = role === "restaurant";
    const toastByStatus: Record<string, { title: string; description: string }> = {
      interested: {
        title: "Interesse confermato",
        description: "Stato candidatura: Interessato.",
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
    toast.success(t.title, { description: t.description });
    setApp({ ...app, ...patch } as App);
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
          const workerName = profile?.full_name ?? "Un lavoratore";
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
  const isConversationClosed = app?.status === "expired";
  const currentTariff = app?.proposed_tariff ?? ann?.tariff_amount;

  const canSeeAddress = canSeePreciseAddress({
    isOwner: !!(user && app && app.restaurant_id === user.id),
    isAdmin: role === "admin",
    applicationStatus: app?.status ?? null,
  });
  const restaurantHints = role === "restaurant"
    ? null
    : { city: other?.city ?? null, neighborhood: other?.neighborhood ?? null };
  const displayAddress = canSeeAddress
    ? (ann?.location_address ?? null)
    : publicLocationLabel({
        job_city: ann?.job_city ?? null,
        city: restaurantHints?.city ?? null,
        neighborhood: restaurantHints?.neighborhood ?? null,
      });

  const steps = buildTimeline(app?.status);

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
    const { general, reliability, punctuality, professionalism, serviceQuality, comment, positiveLabels, negativeLabels, wouldRehire } = payload;
    if (!general || !reliability || !punctuality || !professionalism || !serviceQuality) {
      toast.error("Completa tutte le valutazioni prima di inviare la recensione.");
      return;
    }
    if (!wouldRehire) {
      toast.error("Indica se richiameresti questo lavoratore.");
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length > 500) {
      toast.error("Il commento può contenere al massimo 500 caratteri.");
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
      teamwork: serviceQuality,
      application_id: app.id,
      announcement_id: app.announcement_id,
      is_visible_to_restaurants: true,
      is_visible_to_worker: true,
      would_rehire: wouldRehire,
    } as never).select("*").single();
    if (error) {
      if (String(error.message).toLowerCase().includes("uniq_reviews_shift_author") || (error as any).code === "23505") {
        toast.error("Hai già recensito questo turno.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setExistingReview(data as Review);
    // Messaggio di sistema in chat
    try {
      await insertSystemMessage(`Turno chiuso. Il ristoratore ha inviato la recensione del servizio.`, "complete_shift");
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
            <UserAvatar userId={otherId} name={maskPartnerNameForWorker(other?.name, role, app?.status)} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
            {otherId ? (
              <Link
                to="/messages"
                search={{ with: otherId }}
                className="font-semibold text-primary hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                title="Vedi tutte le conversazioni con questa persona"
              >
                {maskPartnerNameForWorker(other?.name, role, app?.status)}
              </Link>
            ) : (
              <div className="font-semibold">{maskPartnerNameForWorker(other?.name, role, app?.status)}</div>
            )}
            {ann && (
              <div className="mt-1 text-xs text-muted-foreground">
                <Link to="/announcements/$id" params={{ id: ann.id }} className="text-primary hover:underline underline-offset-2">
                  Annuncio del {new Date(ann.service_date).toLocaleDateString("it-IT")}
                </Link>
                {ann.service_time && <> · {ann.service_time.slice(0, 5)}</>}
                {displayAddress && <> · {displayAddress}</>}
              </div>
            )}
            {currentTariff != null && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Euro className="h-3 w-3" />
                Tariffa attuale: €{currentTariff} {ann?.tariff_type === "hourly" ? "/ora" : "a servizio"}
                {app?.proposed_tariff != null && <span className="ml-1 text-primary">(controfferta)</span>}
              </div>
            )}
            </div>
          </div>
        </div>

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
          const displayName = identityVisible ? (other?.name ?? "Lavoratore") : "Profilo in verifica";
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
                <UserAvatar userId={identityVisible ? otherId : null} name={identityVisible ? other?.name : undefined} className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-base truncate flex items-center gap-2">
                    <span className={identityVisible ? "" : "italic text-muted-foreground"}>{displayName}</span>
                    {!identityVisible && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">Privacy</span>
                    )}
                  </div>
                  {ann?.professional_profile && (
                    <div className="text-sm text-muted-foreground truncate">
                      Ruolo: <span className="text-foreground font-medium">{ann.professional_profile}</span>
                    </div>
                  )}
                  {ann && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(ann.service_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                      {ann.service_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{ann.service_time.slice(0, 5)}</span>}
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
                  disabled={transitioning !== null}
                >
                  {transitioning === "accepted" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {transitioning === "accepted" ? "Conferma in corso…" : "Accetta candidatura"}
                </Button>
              </div>
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
                <Button size="sm" className="gap-2" disabled={transitioning !== null} onClick={() => transition("interested")}>
                  {transitioning === "interested" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  {transitioning === "interested" ? "Invio in corso…" : "Sono interessato"}
                </Button>
                <Button size="sm" variant="outline" className="gap-2" disabled={transitioning !== null} onClick={() => transition("not_interested")}>
                  {transitioning === "not_interested" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  {transitioning === "not_interested" ? "Invio in corso…" : "Non interessato"}
                </Button>
                {(!shift || (shift.status !== "scheduled" && shift.status !== "completed")) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-muted-foreground hover:text-destructive"
                    disabled={transitioning !== null || cancelling}
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    <Ban className="h-4 w-4" />Annulla candidatura
                  </Button>
                )}
              </>)}
              {role === "restaurant" && (() => {
                const statuses = Object.values(proposalStatuses);
                const hasAccepted = statuses.includes("accepted");
                const hasProposal = msgs.some((x) => x.template_id === PROPOSAL_TEMPLATE_ID);
                const lastProposalRejected =
                  hasProposal && !hasAccepted && statuses.length > 0 && statuses.every((s) => s === "rejected");
                // Server-side check is authoritative. While loading, fall back to client heuristics.
                const serverDisabled = serverAssign ? !serverAssign.canAssign : !hasAccepted;
                const disabled = serverDisabled;
                const helper = serverAssign?.reason
                  ? serverAssign.reason
                  : !hasProposal
                  ? "Invia una proposta di lavoro per poter assegnare il turno."
                  : !hasAccepted && lastProposalRejected
                    ? "Il lavoratore ha rifiutato la proposta."
                    : !hasAccepted
                      ? "In attesa che il lavoratore accetti la proposta."
                      : isBlocked
                        ? "Prima di assegnare nuovi turni devi chiudere e recensire i turni conclusi."
                        : null;
                return (
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={disabled || transitioning !== null}
                      onClick={() => transition("accepted")}
                    >
                      <Check className="h-4 w-4" />
                      {transitioning === "accepted" ? "Assegnazione in corso…" : "Assegna"}
                    </Button>
                    {helper && (
                      <span className={`text-xs ${lastProposalRejected || isBlocked ? "text-destructive" : "text-muted-foreground"}`}>
                        {helper}
                      </span>
                    )}
                  </div>
                );
              })()}
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
              <Button size="sm" variant="outline" className="gap-2" disabled={transitioning !== null} onClick={() => transition("rejected")}>
                <X className="h-4 w-4" />
                {transitioning === "rejected" ? "Rifiuto in corso…" : "Rifiuta"}
              </Button>
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
                ? maskPartnerNameForWorker(other?.name, role, app?.status)
                : (profile?.business_name || profile?.full_name || null);
              const hasAcknowledged = msgs.some(
                mm => mm.action_type === "instructions_acknowledged" && mm.application_id === id,
              );
              return (
                <ConfirmationCard
                  key={m.id}
                  ann={ann}
                  venueName={venueName}
                  applicationId={id}
                  announcementId={app?.announcement_id ?? null}
                  isWorker={role === "worker"}
                  acknowledged={hasAcknowledged}
                  onAcknowledge={async () => {
                    if (!user || !app) return;
                    const receiverId = otherId ?? (app.restaurant_id === user.id ? app.worker_id : app.restaurant_id);
                    if (!receiverId) return;
                    const body = "Ho letto e confermo la presa visione di tutte le istruzioni del turno.";
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
                    toast.success("Presa visione confermata");
                  }}
                />
              );
            }
            if (m.template_id === PROPOSAL_TEMPLATE_ID) {
              const ownStatus = proposalStatuses[m.id];
              const hasAnyResponse = Object.keys(proposalStatuses).length > 0;
              // Per-proposal status is authoritative. Legacy proposals (no recorded
              // response anywhere) fall back to the application status once.
              const effectiveStatus = ownStatus ?? (hasAnyResponse ? "pending" : (app?.status ?? "pending"));
              return (
                <ProposalCard
                  key={m.id}
                  message={m}
                  ann={ann}
                  venueName={role === "worker" ? maskPartnerNameForWorker(other?.name, role, app?.status) : (other?.name ?? null)}
                  displayAddress={displayAddress}
                  canSeePreciseInfo={canSeeAddress}
                  isWorker={role === "worker"}
                  status={effectiveStatus}
                  onAccept={async () => {
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
                        const workerName = role === "worker" ? (profile?.full_name ?? "Il lavoratore") : (other?.name ?? "Il lavoratore");
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
                    try {
                      // Keep the application transition for the FIRST accepted proposal so
                      // shift creation / notifications triggers still fire. Later proposals
                      // in the same conversation only update the per-proposal record.
                      if ((app?.status ?? "pending") !== "accepted") {
                        await transition("accepted");
                      }
                    } finally {
                      // Always emit a system message so both sides see the outcome,
                      // even if the status update partially fails.
                      try {
                        await insertSystemMessage("Proposta accettata", "accept_application");
                      } catch (err) {
                        console.error("[proposal] system message insert failed", err);
                      }
                    }
                  }}
                  onReject={async () => {
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
                        const workerName = role === "worker" ? (profile?.full_name ?? "Il lavoratore") : (other?.name ?? "Il lavoratore");
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
                        await insertSystemMessage("Proposta rifiutata", "reject_application");
                      } catch (err) {
                        console.error("[proposal] system message insert failed", err);
                      }
                    }
                  }}
                />
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
          }
          const openClosure = () => {
            setTplCategory("post_shift");
            setReviewOpen(true);
            setTimeout(() => {
              document.getElementById("review-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 60);
          };
          return (
            <button
              type="button"
              onClick={openClosure}
              className="mt-4 w-full text-left rounded-2xl border-2 border-primary bg-primary/15 hover:bg-primary/25 transition p-4 flex items-start gap-3 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.55)] focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="shrink-0 rounded-xl bg-primary text-primary-foreground p-2.5 flex items-center justify-center">
                <Star className="h-5 w-5" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base sm:text-lg leading-tight">{title}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
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
        <div id="chat-composer">
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
          onSend={sendTemplate}
          sending={sending}
          ann={ann}
          otherName={other?.name ?? null}
          addressOverride={displayAddress}
          disabled={isConversationClosed}
        />
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
            onSubmit={submitReview}
          />
        )}

        <InsufficientCreditsDialog
          open={insufficientOpen}
          onOpenChange={setInsufficientOpen}
          currentCredits={creditsAvailable}
          returnTo={`/messages/${id}`}
        />
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
  onSubmit: (payload: {
    general: number;
    reliability: number;
    punctuality: number;
    professionalism: number;
    serviceQuality: number;
    comment: string;
    positiveLabels: string[];
    negativeLabels: string[];
    wouldRehire: "yes" | "maybe" | "no" | null;
  }) => Promise<void>;
}) {
  const { open, onOpenChange, workerName, workerRole, shiftDate, startTime, endTime, venue, shiftStatus, onSubmit } = props;
  const [general, setGeneral] = useState(0);
  const [reliability, setReliability] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [serviceQuality, setServiceQuality] = useState(0);
  const [comment, setComment] = useState("");
  const [positiveLabels, setPositiveLabels] = useState<string[]>([]);
  const [negativeLabels, setNegativeLabels] = useState<string[]>([]);
  const [wouldRehire, setWouldRehire] = useState<"yes" | "maybe" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setGeneral(0); setReliability(0); setPunctuality(0);
      setProfessionalism(0); setServiceQuality(0); setComment(""); setError(null);
      setPositiveLabels([]); setNegativeLabels([]); setWouldRehire(null);
    }
  }, [open]);

  const allRated = general > 0 && reliability > 0 && punctuality > 0 && professionalism > 0 && serviceQuality > 0;

  const handleSubmit = async () => {
    if (!allRated) {
      setError("Completa tutte le valutazioni prima di inviare la recensione.");
      return;
    }
    if (!wouldRehire) {
      setError("Indica se richiameresti questo lavoratore.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ general, reliability, punctuality, professionalism, serviceQuality, comment, positiveLabels, negativeLabels, wouldRehire });
    } finally { setSubmitting(false); }
  };

  const dateStr = shiftDate ? new Date(shiftDate).toLocaleDateString("it-IT") : "—";
  const timeStr = [startTime?.slice(0,5), endTime?.slice(0,5)].filter(Boolean).join(" – ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chiudi turno e recensisci</DialogTitle>
          <DialogDescription>Valuta il lavoratore per il servizio appena concluso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-secondary/30 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Lavoratore:</span> <span className="font-medium">{workerName ?? "—"}</span></div>
            {workerRole && <div><span className="text-muted-foreground">Ruolo:</span> {workerRole}</div>}
            <div><span className="text-muted-foreground">Data:</span> {dateStr}</div>
            <div><span className="text-muted-foreground">Orario:</span> {timeStr}</div>
            {venue && <div><span className="text-muted-foreground">Locale:</span> {venue}</div>}
            <div><span className="text-muted-foreground">Stato:</span> {shiftStatus ?? "in chiusura"}</div>
          </div>

          <CriterionRow label="Valutazione generale *" value={general} onChange={setGeneral} />
          <CriterionRow label="Affidabilità *" value={reliability} onChange={setReliability} />
          <CriterionRow label="Puntualità *" value={punctuality} onChange={setPunctuality} />
          <CriterionRow label="Professionalità *" value={professionalism} onChange={setProfessionalism} />
          <CriterionRow label="Qualità del servizio *" value={serviceQuality} onChange={setServiceQuality} />

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
            Invia recensione e chiudi turno
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

function ProposalCard(props: {
  message: Msg;
  ann: Ann | null;
  venueName: string | null;
  displayAddress: string | null;
  canSeePreciseInfo: boolean;
  isWorker: boolean;
  status: string;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const { ann, venueName, displayAddress, canSeePreciseInfo, isWorker, status, onAccept, onReject } = props;
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  // The proposal expires at the end of the shift (or, lacking end_time,
  // at service_time + duration). After that it cannot be accepted/refused.
  const deadline = useMemo<Date | null>(() => {
    if (!ann?.service_date) return null;
    const datePart = ann.service_date;
    const endTime = (ann.end_time ?? "").slice(0, 5);
    if (endTime) {
      const d = new Date(`${datePart}T${endTime}:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const startTime = (ann.service_time ?? "").slice(0, 5);
    if (!startTime) return null;
    const start = new Date(`${datePart}T${startTime}:00`);
    if (isNaN(start.getTime())) return null;
    const hours = Number(ann.duration_hours ?? 4) || 4;
    return new Date(start.getTime() + hours * 60 * 60 * 1000);
  }, [ann?.service_date, ann?.service_time, ann?.end_time, ann?.duration_hours]);
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
  const decided = accepted || rejected || expired;

  const handle = async (kind: "accept" | "reject") => {
    if (busy || decided) return;
    setBusy(kind);
    try {
      if (kind === "accept") await onAccept();
      else await onReject();
    } finally {
      setBusy(null);
    }
  };

  return (
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
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>La posizione esatta e il referente saranno visibili solo dopo l'assegnazione definitiva.</span>
          </div>
        ) : (
          <p className="px-4 pb-3 text-xs text-muted-foreground">Fammi sapere se puoi esserci.</p>
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
                : `Valida fino al ${deadline.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} alle ${deadline.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        )}

        {decided ? (
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
          <div className="px-4 py-3 border-t bg-secondary/30 flex gap-2">
            <Button
              type="button"
              onClick={() => handle("accept")}
              disabled={!!busy}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            >
              <Check className="h-4 w-4" />
              {busy === "accept" ? "Invio…" : "Accetta"}
            </Button>
            <Button
              type="button"
              onClick={() => handle("reject")}
              disabled={!!busy}
              variant="outline"
              className="flex-1 h-11 border-destructive text-destructive hover:bg-destructive/10 font-semibold gap-2"
            >
              <X className="h-4 w-4" />
              {busy === "reject" ? "Invio…" : "Rifiuta"}
            </Button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t bg-secondary/20 text-xs text-muted-foreground text-center">
            In attesa di risposta dal lavoratore.
          </div>
        )}
      </div>
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
  onAcknowledge?: () => Promise<void> | void;
}) {
  const { ann, venueName, applicationId, isWorker, acknowledged = false, onAcknowledge } = props;
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
            <h4 className="font-bold text-sm">Candidatura accettata</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isWorker
              ? "Il ristoratore ha confermato la tua presenza per questo turno."
              : "Hai confermato il lavoratore. Riceverà tutti i dettagli del turno."}
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
            Presa visione confermata
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
                  Presa visione confermata
                </>
              ) : ackBusy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Registrazione…
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Confermo di aver letto le istruzioni
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