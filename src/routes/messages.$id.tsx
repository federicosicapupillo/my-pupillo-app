import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Euro, ThumbsUp, ThumbsDown, Send, Handshake, Ban, Sparkles, Star } from "lucide-react";
import { publicLocationLabel, canSeePreciseAddress } from "@/lib/public-location";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";
import { CREDITS_PER_HIRE } from "@/lib/pricing";
import { PROPOSAL_TEMPLATE_ID } from "@/lib/shift-proposal";
import { formatDateIT, formatTariff } from "@/lib/format";
import { Calendar, Clock, MapPin, Briefcase, Building2, StickyNote, AlarmClock } from "lucide-react";
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
type Ann = { id: string; service_date: string; service_time: string; end_time?: string | null; duration_hours?: number | null; location_address: string; tariff_amount: number; tariff_type: string; job_city?: string | null; restaurant_id?: string; notes?: string | null; professional_profile?: string | null };

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
  | "report_issue";

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

const TERMINAL = ["accepted", "rejected", "expired"];

type TimelineEvent = { at: string; label: string; note?: string; tone: "neutral" | "success" | "error" };

const ACTION_LABELS: Record<string, { label: string; tone: TimelineEvent["tone"] }> = {
  created: { label: "Richiesta inviata", tone: "neutral" },
  interested: { label: "Lavoratore interessato", tone: "success" },
  not_interested: { label: "Lavoratore non interessato", tone: "error" },
  counter_offer: { label: "Controfferta inviata", tone: "neutral" },
  accepted: { label: "Lavoratore assegnato", tone: "success" },
  rejected: { label: "Candidatura rifiutata", tone: "error" },
  expired: { label: "Offerta scaduta", tone: "error" },
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

  const mark = (cond: boolean, isCurrent: boolean): StepState =>
    cond ? "done" : isCurrent ? "current" : "todo";

  return [
    { key: "sent", label: "Inviata", icon: Send, state: "done" },
    { key: "interest", label: "Interesse", icon: ThumbsUp,
      state: isReject ? "error" : mark(isInterested || isCounter || isAccepted, s === "pending") },
    { key: "counter", label: "Controfferta", icon: Handshake,
      state: isCounter ? "current" : (isAccepted ? "done" : "todo") },
    { key: "outcome", label: isReject ? "Rifiutata" : isExpired ? "Scaduta" : "Assegnata",
      icon: isReject || isExpired ? Ban : Check,
      state: isAccepted ? "done" : (isReject || isExpired) ? "error" : "todo" },
  ];
}

function Thread() {
  const { id } = Route.useParams();
  const { user, role, profile } = useAuth();
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [creditsAvailable, setCreditsAvailable] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [app, setApp] = useState<App | null>(null);
  const [ann, setAnn] = useState<Ann | null>(null);
  const [other, setOther] = useState<{ name: string; city: string | null; neighborhood: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const [counterConfirmOpen, setCounterConfirmOpen] = useState(false);
  const [sendingCounter, setSendingCounter] = useState(false);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [tplCategory, setTplCategory] = useState<TemplateCategory>("application");
  const [selectedTpl, setSelectedTpl] = useState<MsgTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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
          supabase.from("profiles").select("full_name, business_name, city, neighborhood").eq("id", otherId).maybeSingle(),
          supabase.from("announcements").select("id, service_date, service_time, end_time, duration_hours, location_address, tariff_amount, tariff_type, job_city, restaurant_id, assigned_worker_id, notes, professional_profile").eq("id", a.announcement_id).maybeSingle(),
        ]);
        setOther({
          name: p?.business_name || p?.full_name || "Utente",
          city: (p as any)?.city ?? null,
          neighborhood: (p as any)?.neighborhood ?? null,
        });
        setAnn(an as Ann | null);
      }
      const { data: m } = await supabase.from("messages").select("*").eq("application_id", id).order("created_at");
      setMsgs((m as Msg[]) ?? []);
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
        (p) => setMsgs(prev => prev.some(m => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` },
        (p) => setApp(p.new as App))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `entity_id=eq.${id}` },
        (p) => setEvents(prev => [...prev, p.new as LogEvent]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

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
    // Charge credits to the restaurant only on shift assignment confirmation.
    if (next === "accepted" && role === "restaurant" && app.status !== "accepted") {
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
    await logEvent(next, { by_role: role ?? undefined });
    const labels: Record<string, string> = {
      interested: "Interesse confermato",
      not_interested: "Offerta rifiutata",
      accepted: "Lavoratore assegnato!",
      rejected: "Candidatura chiusa",
    };
    toast.success(labels[next]);
    setApp({ ...app, ...patch } as App);
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

  const submitReview = async (rating: number, text: string, tags: string[]) => {
    if (!user || !app) return;
    if (role !== "restaurant") {
      toast.error("Solo il ristoratore può lasciare una recensione.");
      return;
    }
    if (!rating) { toast.error("Seleziona una valutazione."); return; }
    const trimmed = text.trim();
    if (!trimmed) { toast.error("Scrivi una recensione prima di confermare il turno."); return; }
    if (trimmed.length < 20) { toast.error("La recensione deve contenere almeno 20 caratteri."); return; }
    if (trimmed.length > 500) { toast.error("La recensione può contenere al massimo 500 caratteri."); return; }

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
    }

    const { data, error } = await supabase.from("reviews").insert({
      author_id: user.id,
      target_id: app.worker_id,
      shift_id: shiftId,
      rating,
      comment: trimmed,
      tags,
      application_id: app.id,
      announcement_id: app.announcement_id,
      is_visible_to_restaurants: true,
      is_visible_to_worker: true,
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
      await insertSystemMessage(`il turno è stato completato e il lavoratore ha ricevuto una recensione. Valutazione: ${rating} ${rating === 1 ? "stella" : "stelle"}.`, "complete_shift");
    } catch (e) { /* non bloccante */ }
    // Marca l'annuncio come completato
    if (app.announcement_id) {
      await supabase.from("announcements").update({ status: "completed" } as never).eq("id", app.announcement_id);
    }
    setReviewOpen(false);
    toast.success("Turno completato e recensione inviata al lavoratore.");
  };

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
          {app && <span className="text-xs rounded-full bg-secondary px-2 py-1 capitalize">{app.status}</span>}
        </div>
        <div className="rounded-2xl border bg-card p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <UserAvatar userId={otherId} name={other?.name} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
            {otherId ? (
              <Link
                to="/messages"
                search={{ with: otherId }}
                className="font-semibold text-primary hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                title="Vedi tutte le conversazioni con questa persona"
              >
                {other?.name ?? "—"}
              </Link>
            ) : (
              <div className="font-semibold">{other?.name ?? "—"}</div>
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
                <Button size="sm" className="gap-2" onClick={() => transition("interested")}><ThumbsUp className="h-4 w-4" />Sono interessato</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => transition("not_interested")}><ThumbsDown className="h-4 w-4" />Non interessato</Button>
              </>)}
              {role === "restaurant" && (
                <Button size="sm" className="gap-2" onClick={() => transition("accepted")}><Check className="h-4 w-4" />Assegna</Button>
              )}
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
              <Button size="sm" variant="outline" className="gap-2" onClick={() => transition("rejected")}><X className="h-4 w-4" />Rifiuta</Button>
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

        <div className="rounded-2xl border bg-card p-4 h-[min(52vh,520px)] min-h-[360px] overflow-y-auto space-y-2">
          {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Inizia la conversazione.</p>}
          {msgs.map(m => {
            const isSystem = m.message_type === "system" || m.body.startsWith("⚙️ Sistema:");
            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="rounded-full px-3 py-1 text-xs bg-muted text-muted-foreground border">
                    {m.body.replace(/^⚙️ /, "")}
                  </div>
                </div>
              );
            }
            if (m.template_id === PROPOSAL_TEMPLATE_ID) {
              return (
                <ProposalCard
                  key={m.id}
                  message={m}
                  ann={ann}
                  venueName={other?.name ?? null}
                  displayAddress={displayAddress}
                  isWorker={role === "worker"}
                  status={app?.status ?? "pending"}
                  onAccept={async () => {
                    await transition("accepted");
                    await insertSystemMessage("Il lavoratore ha accettato la proposta di lavoro.", "accept_application");
                  }}
                  onReject={async () => {
                    await transition("rejected");
                    await insertSystemMessage("Il lavoratore ha rifiutato la proposta di lavoro.", "reject_application");
                  }}
                />
              );
            }
            return (
              <div key={m.id} className={`flex items-end gap-2 ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                {m.sender_id === app?.worker_id && m.sender_id !== user?.id && (
                  <UserAvatar userId={app?.worker_id} name={other?.name} className="h-8 w-8 shrink-0" />
                )}
                <div className={`rounded-2xl px-4 py-2 max-w-[75%] text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.body}</div>
                {m.sender_id === app?.worker_id && m.sender_id === user?.id && (
                  <UserAvatar userId={app?.worker_id} name={undefined} className="h-8 w-8 shrink-0" />
                )}
              </div>
            );
          })}
          <div ref={endRef} />
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

        {role === "restaurant" && tplCategory === "post_shift" && app && (
          <ReviewBlock
            id="review-block"
            existing={existingReview}
            workerName={other?.name ?? null}
            shift={shift}
            forceOpen={reviewOpen}
            onSubmit={submitReview}
          />
        )}

        <InsufficientCreditsDialog
          open={insufficientOpen}
          onOpenChange={setInsufficientOpen}
          currentCredits={creditsAvailable}
          returnTo={`/messages/${id}`}
        />
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
  workerName: string | null;
  shift: Shift | null;
  forceOpen: boolean;
  onSubmit: (rating: number, text: string, tags: string[]) => Promise<void>;
}) {
  const { id, existing, workerName, shift, forceOpen, onSubmit } = props;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (existing) {
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

  const charCount = text.trim().length;
  const canSubmit = rating > 0 && charCount >= 20 && charCount <= 500 && !submitting;

  // Mandatory review state derived from shift.completed_at (3-day deadline)
  const completedAtIso = (shift as any)?.completed_at as string | null | undefined;
  const dueMs = completedAtIso ? new Date(completedAtIso).getTime() + 3 * 24 * 60 * 60 * 1000 : null;
  const overdue = dueMs != null && Date.now() > dueMs;
  const showMandatoryNotice = !!shift && (shift.status === "completed");

  const toggleTag = (t: string) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await onSubmit(rating, text, tags); }
    finally { setSubmitting(false); }
  };

  return (
    <div id={id} className={`mt-4 rounded-2xl border bg-card p-4 space-y-4 ${forceOpen ? "ring-2 ring-primary/40" : ""}`}>
      {showMandatoryNotice && (
        <div className={`rounded-lg border p-3 text-sm ${
          overdue
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        }`}>
          <div className="font-semibold">{overdue ? "Recensione scaduta" : "Recensione obbligatoria"}</div>
          <div className="text-xs mt-0.5">
            {overdue
              ? "Questa recensione è scaduta. Completarla riattiverà il contatto con nuovi lavoratori."
              : `Per chiudere correttamente il turno devi lasciare una valutazione al lavoratore${
                  dueMs ? ` entro il ${new Date(dueMs).toLocaleDateString("it-IT")}` : " entro 3 giorni"
                }.`}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <h3 className="font-semibold text-base">Com'è andato il turno{workerName ? ` con ${workerName}` : ""}?</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Conferma la fine del turno e lascia una recensione al lavoratore.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium mb-2">Valutazione *</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium">Recensione *</label>
          <span className={`text-[11px] ${charCount > 500 ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount}/500
          </span>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi una recensione chiara e utile. Esempio: puntuale, professionale, ha rispettato il dress code e ha lavorato bene con il team."
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
              {POSITIVE_TAGS.map(t => {
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
              {CRITICAL_TAGS.map(t => {
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
      {shift?.status === "cancelled" && (
        <p className="text-[11px] text-destructive text-center">
          Il turno risulta annullato: usa il flusso di segnalazione invece della recensione standard.
        </p>
      )}
    </div>
  );
}

function ProposalCard(props: {
  message: Msg;
  ann: Ann | null;
  venueName: string | null;
  displayAddress: string | null;
  isWorker: boolean;
  status: string;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const { ann, venueName, displayAddress, isWorker, status, onAccept, onReject } = props;
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
          <ProposalRow icon={Briefcase} label="Ruolo" value={ann?.professional_profile || "—"} />
          <ProposalRow icon={Calendar} label="Data" value={ann?.service_date ? formatDateIT(ann.service_date) : "—"} />
          <ProposalRow
            icon={Clock}
            label="Orario"
            value={
              ann?.service_time
                ? `${ann.service_time.slice(0, 5)}${ann.end_time ? " - " + ann.end_time.slice(0, 5) : ""}`
                : "—"
            }
          />
          <ProposalRow icon={Building2} label="Locale" value={venueName || "—"} />
          <ProposalRow icon={MapPin} label="Luogo" value={displayAddress || ann?.job_city || "—"} />
          {ann?.tariff_amount != null && (
            <ProposalRow icon={Euro} label="Compenso" value={formatTariff(ann.tariff_amount, ann.tariff_type ?? null)} />
          )}
          {ann?.notes && ann.notes.trim() && (
            <ProposalRow icon={StickyNote} label="Note" value={ann.notes.trim()} />
          )}
        </dl>
        <p className="px-4 pb-3 text-xs text-muted-foreground">Fammi sapere se puoi esserci.</p>

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
            {accepted ? (isWorker ? "Hai accettato questa proposta." : "Proposta accettata") :
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