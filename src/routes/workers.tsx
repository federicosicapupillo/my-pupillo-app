import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Search, List, Map as MapIcon, RotateCcw, X, MapPin, CheckCircle2, Clock, History, ThumbsUp, ThumbsDown, Gift, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkersMap, type WorkerMapPoint } from "@/components/WorkersMap";
import { useAvatarUrls } from "@/hooks/use-avatar-urls";
import { CREDIT_COSTS } from "@/lib/pricing";
import { Coins, AlertCircle, MessageSquare, User } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SpokenLanguagesView, normalizeSpokenLanguages, LANGUAGE_OPTIONS, type SpokenLanguage } from "@/components/SpokenLanguages";
import { useRequiredReviews } from "@/lib/required-reviews";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { formatDisplayLabel, formatDisplayLabels } from "@/lib/format-label";
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { WorkerReputationBadge } from "@/components/WorkerReputationBadge";
import { WorkerRatingSummary } from "@/components/WorkerRatingSummary";
import { sendShiftProposal } from "@/lib/shift-proposal";
import { useProfileGate } from "@/components/ProfileGate";
import { getLastAnnouncementId, setLastAnnouncementId } from "@/lib/last-announcement";
import { getShiftStartDate } from "@/lib/announcement-time";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateIT, formatTariff, formatAnnouncementLabel } from "@/lib/format";
import { getRoleCompatibility, getRoleCompatibilityBadge } from "@/lib/role-compatibility";
import { firstNameOf } from "@/lib/public-location";
import { displayWorkerName, verifiedRoleLabel } from "@/lib/worker-display";
import { summarizeWeeklyAvailability, formatAvailabilitySlotsForDay } from "@/lib/availability-summary";
import {
  summarizeWorkerAvailability,
  formatWorkerAvailabilityByDay,
  availabilitySearchText,
} from "@/lib/worker-availability-summary";
import type { AvailabilityRow, AvailabilityExceptionRow, CompatibilityLevel } from "@/lib/availability";
import { computeCompatibility, SLOT_LABELS } from "@/lib/availability";
import { AlreadyInContactDialog } from "@/components/AlreadyInContactDialog";
import { checkExistingContact, isDuplicateContactError } from "@/lib/already-in-contact";
import { canRestaurantInviteWorker } from "@/lib/application-reapply";
import {
  collectWorkerCompetenceValues,
  collectWorkerRoleValues,
  normalizeRole,
  roleMatches,
  workerMatchesAnyRoleField,
} from "@/lib/worker-role-normalization";
import { loadRestaurantWorkerSearchResults, type WorkerSearchDebug } from "@/lib/worker-search.functions";
import { WorkerProfileModalProvider, useOpenWorkerProfile } from "@/components/WorkerProfileModalProvider";

export const Route = createFileRoute("/workers")({
  head: () => ({ meta: [{ title: "Cerca lavoratori — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <WorkerProfileModalProvider source="cerca_lavoratori">
        <WorkersPage />
      </WorkerProfileModalProvider>
    </RequireAuth>
  ),
});

type W = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  languages: string[] | null;
  spoken_languages: any;
  professional_profile: string | null;
  default_required_skills: string[] | null;
  short_bio: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  city: string | null;
  neighborhood: string | null;
  province: string | null;
  service_area_city: string | null;
  service_area_district: string | null;
  residence_city: string | null;
  residence_province?: string | null;
  available_now_until: string | null;
  badge: string | null;
  rating_avg: number | null;
  reliability_pct: number | null;
  no_shows: number | null;
  weekly_availability: string[] | null;
  last_active_at: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  latitude?: number | null;
  longitude?: number | null;
  service_area_radius_m: number | null;
  reputation_score?: number | null;
  reputation_level?: string | null;
  completed_shifts?: number | null;
  punctuality_pct?: number | null;
  rehire_restaurants_count?: number | null;
  reviews_count?: number | null;
  search_penalty_active?: boolean | null;
  search_penalty_reason?: string | null;
  search_penalty_until?: string | null;
  delay_count?: number | null;
  account_status?: string | null;
  profile_completed?: boolean | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  is_demo?: boolean | null;
  seed_batch_id?: string | null;
  user_roles?: string[];
  role_is_worker?: boolean;
  role_is_admin?: boolean;
  role_is_restaurant?: boolean;
  is_active?: boolean;
  is_visible?: boolean;
  selected_zones?: string[] | null;
  all_zones?: boolean | null;
  work_area_mode?: string | null;
  location_city?: string | null;
  location_zone?: string | null;
  location_province?: string | null;
  radius_km?: number | null;
  available_days?: string[];
  availability_schedule?: string[];
  location_source?: "profiles.service_area" | "worker_availability" | "profiles.residence" | "profiles.city" | "missing";
  availability_source?: "worker_availability" | "profiles.weekly_availability" | "profiles.available_now_until" | "missing";
  coordinate_source?: "profile_service_area" | "profile_location" | "worker_availability" | "approximate_city_zone" | "missing";
  map_lat?: number | null;
  map_lng?: number | null;
  has_valid_coordinates?: boolean;
  has_approximate_location?: boolean;
  shown_on_map?: boolean;
};

type Category =
  | "all"
  | "name_profile"
  | "role"
  | "skill"
  | "language"
  | "location"
  | "badge"
  | "availability"
  | "custom";

const CATEGORY_LABEL: Record<Category, string> = {
  all: "Tutto",
  name_profile: "Nome / Profilo",
  role: "Ruolo",
  skill: "Competenze",
  language: "Lingue",
  location: "Località",
  badge: "Badge / Affidabilità",
  availability: "Disponibilità",
  custom: "Personalizzato",
};

const SUBCATEGORIES: Record<Category, string[]> = {
  all: ["Tutti i campi", "Più rilevanti", "Ultimi attivi", "Miglior rating", "Più affidabili"],
  name_profile: ["Nome", "Cognome", "Nome completo", "Titolo profilo", "Descrizione profilo"],
  role: [
    "Cameriere", "Bartender", "Barista", "Chef", "Aiuto cucina", "Lavapiatti",
    "Runner", "Responsabile di sala", "Hostess", "Receptionist", "Pizzaiolo",
    "Addetto catering", "Commis di sala", "Commis di cucina", "Sommelier",
    "Barman", "Banconista", "Altro ruolo",
  ],
  skill: [
    "Servizio al tavolo", "Saper portare tre piatti", "Uso palmare/comande",
    "Preparazione cocktail", "Caffetteria", "Gestione cassa", "Banqueting",
    "Fine dining", "Gestione sala", "Pulizia postazione", "Preparazione linea", "Altro",
  ],
  language: ["Italiano","Inglese","Francese","Spagnolo","Tedesco","Portoghese","Arabo","Cinese","Russo","Rumeno","Albanese","Ucraino","Polacco","Altro"],
  location: ["Città","Zona / Quartiere","Provincia","Vicino a me","Entro 1 km","Entro 3 km","Entro 5 km","Entro 10 km","Entro 20 km"],
  badge: ["Basic","Pro","Elite","Rating minimo 3+","Rating minimo 4+","Rating minimo 4.5+","Affidabilità 80%+","Affidabilità 90%+","Nessun no-show"],
  availability: ["Disponibile oggi","Disponibile domani","Disponibile weekend","Disponibile sera","Disponibile pranzo","Disponibile full-time","Disponibile extra","Disponibile urgente"],
  custom: ["Ricerca libera","Parola chiave","Profilo completo","Qualsiasi campo"],
};

const PLACEHOLDER_BY_CATEGORY: Record<Category, string> = {
  all: "Cerca nome, profilo o parola chiave",
  name_profile: "Scrivi nome o cognome",
  role: "Aggiungi nome o zona",
  skill: "Aggiungi nome, città o profilo",
  language: "Aggiungi città o profilo",
  location: "Scrivi città, zona o provincia",
  badge: "Aggiungi nome o ruolo",
  availability: "Aggiungi nome o ruolo",
  custom: "Scrivi qualsiasi parola chiave",
};
type Ann = {
  id: string;
  service_date: string;
  service_time: string | null;
  end_time: string | null;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  professional_profile: string | null;
  tariff_amount: number | string | null;
  tariff_type: string | null;
  duration_hours: number | string | null;
  shift_duration_hours: number | string | null;
  job_city: string | null;
  job_province: string | null;
  job_postal_code: string | null;
  dress_code_items: string[] | null;
  dress_code_notes: string | null;
  required_skills: string[] | null;
  language_requirements: string[] | null;
  license_requirement: string | null;
  notes: string | null;
  job_location_notes: string | null;
  job_additional_directions: string | null;
  job_contact_person_name: string | null;
};

type WorkerRel = {
  workedWith: boolean;
  reviewed: boolean;
  contacted: boolean;
  hasPending: boolean;
  hasAccepted: boolean;
  hasRejected: boolean;
  hasOpenChat: boolean;
  lastContactAt: number;
  lastReviewAt: number;
  lastReviewRating: number | null;
  latestResponseAt: number;
  latestResponseStatus: "accepted" | "rejected" | null;
  lastAppId: string | null;
  lastAppCreatedAt: number;
  hasShiftScheduled: boolean;
  shiftAnnouncementIds: Set<string>;
  workerLastReview: { rating: number | null; comment: string | null; created_at: string } | null;
  /** Esiste almeno un'applicazione attiva (non rifiutata/annullata/scaduta) tra ristoratore e lavoratore. */
  hasActiveApp: boolean;
  /** Map annuncio_id -> applicationId per le candidature ancora attive. */
  activeAppByAnn: Map<string, string>;
  /** Almeno un turno collegato è stato annullato/scaduto (e non concluso). */
  hasCancelledShift: boolean;
};
const emptyRel = (): WorkerRel => ({
  workedWith: false,
  reviewed: false,
  contacted: false,
  hasPending: false,
  hasAccepted: false,
  hasRejected: false,
  hasOpenChat: false,
  lastContactAt: 0,
  lastReviewAt: 0,
  lastReviewRating: null,
  latestResponseAt: 0,
  latestResponseStatus: null,
  lastAppId: null,
  lastAppCreatedAt: 0,
  hasShiftScheduled: false,
  shiftAnnouncementIds: new Set<string>(),
  workerLastReview: null,
  hasActiveApp: false,
  activeAppByAnn: new Map<string, string>(),
  hasCancelledShift: false,
});

type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6;
function tierOf(r: WorkerRel | undefined, rating: number | null | undefined): Tier {
  if (!r) return (rating ?? 0) >= 4 ? 5 : 6;
  if (r.workedWith && r.reviewed) return 0;
  if (r.workedWith) return 1;
  if (r.contacted && r.hasPending) return 2;
  if (r.contacted && r.hasOpenChat) return 3;
  if (r.contacted) return 4;
  return (rating ?? 0) >= 4 ? 5 : 6;
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Aliases used both for the subcategory filter and for the implicit
// "filter by announcement role" behaviour when no advanced search is active.
// Regola stretta: ogni chiave include SOLO sinonimi diretti dello stesso
// ruolo (varianti singolare/plurale/genere, livelli, denominazioni
// equivalenti). NON includere ruoli affini: un "cameriere" non deve
// risultare automaticamente "runner", un "aiuto cucina" non deve
// diventare "lavapiatti" ecc. Le card mostrerebbero un ruolo per cui il
// lavoratore non è davvero qualificato.
const ROLE_ALIASES: Record<string, string[]> = {
  cameriere: ["cameriere", "camerieri", "cameriera", "commis di sala", "chef de rang", "responsabile di sala"],
  "chef de rang": ["chef de rang", "cameriere"],
  bartender: ["bartender", "barman", "barlady"],
  barista: ["barista", "caffetteria"],
  chef: ["chef", "cuoco", "cuoca"],
  cuoco: ["cuoco", "cuoca", "chef"],
  "aiuto cucina": ["aiuto cucina", "commis di cucina", "aiuto cuoco"],
  runner: ["runner"],
  lavapiatti: ["lavapiatti", "lavaggio piatti"],
  pizzaiolo: ["pizzaiolo", "pizzaiola", "pizzeria"],
  hostess: ["hostess", "steward", "accoglienza"],
  "hostess / steward": ["hostess", "steward", "accoglienza"],
  steward: ["steward", "hostess"],
  sommelier: ["sommelier"],
  "addetto sala": ["addetto sala", "sala"],
  "addetto cassa": ["addetto cassa", "cassa", "cassiere", "cassiera"],
  banconista: ["banconista", "bancone"],
  receptionist: ["receptionist", "reception", "accoglienza"],
  "addetto accoglienza": ["accoglienza", "hostess", "steward", "receptionist"],
};

// Solo ruolo principale + ruoli secondari: NON usiamo professional_profile
// (bio libera) per matchare il ruolo, perché introduce falsi positivi
// (es. una bio che cita "ho fatto il runner una volta" non rende il
// lavoratore un runner).
function workerRolesList(w: W): string[] {
  return [w.primary_role ?? "", ...(w.secondary_roles ?? [])]
    .map((r) => (r ?? "").toLowerCase().trim())
    .filter(Boolean);
}

function workerMatchesRole(w: W, role: string | null | undefined): boolean {
  if (!role) return true;
  const key = role.trim().toLowerCase();
  if (!key) return true;
  const aliases = ROLE_ALIASES[key] ?? [key];
  const roles = workerRolesList(w);
  return roles.some((r) => aliases.some((a) => r === a || r.includes(a)));
}

function plainRole(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isSafeSearchWorker(w: W): boolean {
  const roles = (w.user_roles ?? []).map(plainRole);
  const primary = plainRole(w.primary_role);
  const hasWorkerRole = roles.includes("worker") || w.role_is_worker === true;
  const hasBlockedRole =
    roles.includes("admin") ||
    roles.includes("restaurant") ||
    ["admin", "restaurant", "ristoratore"].includes(primary) ||
    w.role_is_admin === true ||
    w.role_is_restaurant === true;
  return hasWorkerRole && !hasBlockedRole && w.is_deleted !== true && !w.deleted_at && w.is_active !== false && w.is_visible !== false && w.is_demo !== true && !w.seed_batch_id;
}

function workerBlockReason(w: W): string {
  const roles = (w.user_roles ?? []).map(plainRole);
  const primary = plainRole(w.primary_role);
  if (roles.includes("admin") || primary === "admin" || w.role_is_admin) return "ruolo_admin";
  if (roles.includes("restaurant") || ["restaurant", "ristoratore"].includes(primary) || w.role_is_restaurant) return "ruolo_restaurant";
  if (!roles.includes("worker") && w.role_is_worker !== true) return "ruolo_non_worker";
  if (w.is_deleted || w.deleted_at) return "profilo_eliminato";
  if (w.is_demo || w.seed_batch_id) return "profilo_demo";
  if (w.is_active === false) return "account_non_attivo";
  if (w.is_visible === false) return "profilo_non_completato";
  return "non_idoneo";
}

function getWorkerCoordinates(w: W): { lat: number | null; lng: number | null; hasValidCoordinates: boolean; hasApproximateLocation: boolean; shownOnMap: boolean } {
  const latRaw = w.map_lat ?? w.service_area_lat ?? w.latitude ?? null;
  const lngRaw = w.map_lng ?? w.service_area_lng ?? w.longitude ?? null;
  const lat = typeof latRaw === "number" ? latRaw : latRaw == null ? null : Number(latRaw);
  const lng = typeof lngRaw === "number" ? lngRaw : lngRaw == null ? null : Number(lngRaw);
  const hasValidCoordinates =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  const hasApproximateLocation = w.has_approximate_location === true || (!!hasValidCoordinates && w.coordinate_source === "approximate_city_zone");
  return { lat: hasValidCoordinates ? lat : null, lng: hasValidCoordinates ? lng : null, hasValidCoordinates, hasApproximateLocation, shownOnMap: hasValidCoordinates };
}

function workerLocationLabel(w: W): string {
  const city = (w.location_city || w.service_area_city || w.residence_city || w.city || "").trim();
  const zoneRaw = (w.location_zone || w.service_area_district || w.neighborhood || "").trim();
  const zone = zoneRaw && zoneRaw !== "__georadar__" ? zoneRaw : "";
  const province = (w.location_province || w.province || w.residence_province || "").trim();
  if (city && zone) return `${city} · ${zone}`;
  if (city && province) return `${city} · ${province}`;
  if (city) return city;
  if (zone) return zone;
  if (province) return province;
  return "Posizione non indicata";
}

function workerAvailabilityFallback(w: W): string | null {
  if (w.available_days && w.available_days.length > 0) return `Disponibile ${w.available_days.map((d) => d.toLowerCase()).join(", ")}`;
  if (w.availability_schedule && w.availability_schedule.length > 0) return "Disponibilità impostata";
  // NOTE: il raggio di azione (radius_km) non viene più mostrato come
  // "disponibilità" nella card lavoratore: è un dato tecnico utile al
  // matching/ai filtri, ma non rappresenta una disponibilità reale del
  // lavoratore. La sorgente di verità per la card è `worker_availability`
  // (gestita da AvailabilityBlock + summarizeWorkerAvailability).
  return null;
}

/**
 * Lista pulita di ruoli/mansioni del lavoratore per la card lato ristoratore.
 * Usa solo dati reali del profilo (primary_role + secondary_roles), dedup
 * case-insensitive, mantenendo l'ordine. Non inventa nulla.
 */
function workerCardRoles(w: Pick<W, "primary_role" | "secondary_roles">): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const v = (raw ?? "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  push(w.primary_role);
  for (const s of w.secondary_roles ?? []) push(s);
  return out;
}

/** "Cameriere · Bartender · Barista · +13" (max 3 visibili). */
function formatWorkerCardRoles(roles: string[], max = 3): string {
  if (roles.length === 0) return "";
  if (roles.length <= max) return roles.join(" · ");
  return `${roles.slice(0, max).join(" · ")} · +${roles.length - max}`;
}

// Sceglie l'etichetta del ruolo da mostrare sotto il nome del lavoratore.
// - Se non c'è un ruolo "target" (annuncio o ricerca avanzata), mostriamo
//   il ruolo principale del lavoratore.
// - Se il target combacia col ruolo principale, mostriamo quello.
// - Se combacia con un ruolo secondario, mostriamo il ruolo target con
//   l'indicazione "· anche {ruolo principale}".
export function pickDisplayedRole(
  w: Pick<W, "primary_role" | "secondary_roles">,
  targetRole: string | null | undefined,
): { label: string; secondary: string | null } {
  const primary = (w.primary_role ?? "").trim();
  const target = (targetRole ?? "").trim();
  if (!target) return { label: primary, secondary: null };
  const key = target.toLowerCase();
  const aliases = ROLE_ALIASES[key] ?? [key];
  const match = (s: string) => {
    const v = s.toLowerCase().trim();
    if (!v) return false;
    return aliases.some((a) => v === a || v.includes(a));
  };
  if (primary && match(primary)) {
    return { label: primary, secondary: null };
  }
  const sec = (w.secondary_roles ?? []).map((s) => (s ?? "").trim()).find((s) => s && match(s));
  if (sec) {
    return { label: target, secondary: primary || null };
  }
  // Non dovrebbe accadere se il worker è passato dal filtro di ruolo,
  // ma per robustezza mostriamo comunque il target.
  return { label: target, secondary: primary || null };
}

// Numeric tier from a compatibility level — lower is better. Workers with
// no availability indicated remain visible but go below compatible ones.
function compatTier(level: CompatibilityLevel | null): number {
  if (level === "disponibile") return 0;
  if (level === "compatibile") return 1;
  if (level === "parziale") return 2;
  if (level === null) return 3; // disponibilità non indicata
  return 4; // non disponibile
}

// Quando il lavoratore ha impostato una "disponibilità speciale" per la data
// dell'annuncio, quella prevale sempre sulla disponibilità abituale: se nessuna
// delle eccezioni è compatibile con città/zona/orario dell'annuncio (o segna
// la data come "Non disponibile"), il contatto va bloccato.
function describeSpecial(e: AvailabilityExceptionRow): string {
  const where = [e.city, e.district].filter(Boolean).join(" · ");
  const when = e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : "";
  if (!e.is_available) return [where, "Non disponibile"].filter(Boolean).join(" · ");
  return [where, when].filter(Boolean).join(" · ");
}

function computeSpecialBlock(
  specials: AvailabilityExceptionRow[],
  level: CompatibilityLevel | null,
): { blocked: boolean; specials: AvailabilityExceptionRow[] } | null {
  if (!specials || specials.length === 0) return null;
  // Le specials esistono per quella data → prevalgono. Se computeCompatibility
  // dice "non_disponibile" il lavoratore non può ricevere proposta per il turno.
  if (level === "non_disponibile") return { blocked: true, specials };
  return { blocked: false, specials };
}

function WorkersPage() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const openWorkerProfile = useOpenWorkerProfile();
  const loadWorkerSearchData = useServerFn(loadRestaurantWorkerSearchResults);
  const { requireComplete, canPerformOperationalAction } = useProfileGate();
  const { isBlocked, blockedCount, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [workers, setWorkers] = useState<W[]>([]);
  // worker_availability rows grouped by worker id. Card / dialog read here
  // first; profiles.weekly_availability is only used as a legacy fallback.
  const [availByWorker, setAvailByWorker] = useState<Record<string, AvailabilityRow[]>>({});
  // Special availability (exceptions) grouped by worker id. These override the
  // weekly schedule for the specific date they cover.
  const [excByWorker, setExcByWorker] = useState<Record<string, AvailabilityExceptionRow[]>>({});
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string>("");
  // Filtri reattivi: ogni cambio aggiorna immediatamente la lista
  const [category, setCategory] = useState<Category>("all");
  const [subcategory, setSubcategory] = useState<string>("");
  const [qInput, setQInput] = useState("");
  const [lang, setLang] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  // Relazione ristoratore ↔ lavoratore (per ordinare e mostrare badge)
  const [rel, setRel] = useState<Record<string, WorkerRel>>({});
  // Dialog "Invia proposta di lavoro"
  const [proposalWorker, setProposalWorker] = useState<W | null>(null);
  const [detailsWorker, setDetailsWorker] = useState<W | null>(null);
  const [missingAnnOpen, setMissingAnnOpen] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [alreadyContactAppId, setAlreadyContactAppId] = useState<string | null>(null);
  const [restaurantDefaults, setRestaurantDefaults] = useState<{
    contact_name: string | null;
    arrival_minutes: number | null;
    arrival_reason: string | null;
  }>({ contact_name: null, arrival_minutes: null, arrival_reason: null });
  const [workerSearchDebug, setWorkerSearchDebug] = useState<WorkerSearchDebug | null>(null);

  // Carica TUTTI i lavoratori attivi una sola volta. I filtri lavorano poi lato client.
  const loadWorkers = async (reason = "page_enter") => {
    setLoading(true);
    try {
      const result = await loadWorkerSearchData({ data: { reason } });
      setWorkerSearchDebug(result.debug);
      const rawList = (((result.workers as W[]) ?? []).filter(isSafeSearchWorker));
      // Hard render-time guard: any profile that slipped past the server filter
      // (admin / restaurant / ruolo mancante) viene loggato ed escluso prima
      // ancora di entrare nel grafo di render.
      const blocked: Array<{ user_id: string; name: string | null; primary_role: string | null; user_roles: string[]; motivo: string }> = [];
      const allFromServer = ((result.workers as W[]) ?? []);
      for (const w of allFromServer) {
        if (isSafeSearchWorker(w)) continue;
        const roles = (w.user_roles ?? []).map((r) => (r ?? "").toLowerCase());
        const primary = (w.primary_role ?? "").toLowerCase();
        let motivo = "ruolo_non_worker";
        if (roles.includes("admin") || primary === "admin" || w.role_is_admin) motivo = "ruolo_admin";
        else if (roles.includes("restaurant") || ["restaurant", "ristoratore"].includes(primary) || w.role_is_restaurant) motivo = "ruolo_restaurant";
        else if (w.is_deleted || w.deleted_at) motivo = "profilo_eliminato";
        else if (w.is_demo || w.seed_batch_id) motivo = "profilo_demo";
        else if (w.is_active === false) motivo = "account_non_attivo";
        else if (w.is_visible === false) motivo = "profilo_non_completato";
        blocked.push({ user_id: w.id, name: w.full_name, primary_role: w.primary_role, user_roles: roles, motivo });
        console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", {
          user_id: w.id,
          nome: w.full_name,
          primary_role: w.primary_role,
          user_roles: roles,
          motivo_blocco: motivo,
        });
      }
      console.log("[PUPILLO_WORKER_SEARCH_ROLE_FILTER_DEBUG]", {
        totale_profili_ricevuti_da_supabase: allFromServer.length,
        totale_con_ruolo_worker: allFromServer.filter((w) => {
          const roles = (w.user_roles ?? []).map((r) => (r ?? "").toLowerCase());
          return roles.includes("worker") || w.role_is_worker === true;
        }).length,
        totale_esclusi_perche_admin: blocked.filter((b) => b.motivo === "ruolo_admin").length,
        totale_esclusi_perche_restaurant: blocked.filter((b) => b.motivo === "ruolo_restaurant").length,
        totale_esclusi_perche_ruolo_mancante: blocked.filter((b) => b.motivo === "ruolo_non_worker").length,
        totale_esclusi_altri_motivi: blocked.filter((b) => !["ruolo_admin", "ruolo_restaurant", "ruolo_non_worker"].includes(b.motivo)).length,
        totale_finale_mostrato: rawList.length,
      });
      // Deduplicazione difensiva per `id` (profile_id == user_id su `profiles`).
      // Anche se la SELECT su `profiles` non dovrebbe mai produrre duplicati,
      // proteggiamo il render da qualsiasi anomalia futura.
      const seen = new Map<string, W>();
      const dupLog: Array<{ id: string; name: string | null; count: number }> = [];
      const counter = new Map<string, number>();
      for (const w of rawList) {
        if (!w?.id) continue;
        counter.set(w.id, (counter.get(w.id) ?? 0) + 1);
        if (!seen.has(w.id)) seen.set(w.id, w);
      }
      for (const [id, count] of counter) {
        if (count > 1) {
          const w = seen.get(id);
          dupLog.push({ id, name: w?.full_name ?? null, count });
          console.warn("[PUPILLO_WORKER_DUPLICATE_DEBUG]", {
            worker_id: id,
            profile_id: id,
            user_id: id,
            name: w?.full_name ?? null,
            origine: "loadRestaurantWorkerSearchResults — query principale server-side",
            occorrenze_prima_della_deduplicazione: count,
          });
        }
      }
      const list = Array.from(seen.values());
      const locationAvailabilityDebug = list.map((w) => {
        const coords = getWorkerCoordinates(w);
        const hasApproximateLocation = coords.hasApproximateLocation || !!w.location_city || !!w.location_zone || !!w.service_area_city;
        const shownOnMap = coords.hasValidCoordinates;
        return {
          user_id: w.id,
          profile_id: w.id,
          nome: w.full_name ?? [w.first_name, w.last_name].filter(Boolean).join(" "),
          ruolo: w.primary_role,
          city: w.location_city ?? w.service_area_city ?? w.residence_city ?? w.city ?? null,
          province: w.location_province ?? w.province ?? w.residence_province ?? null,
          zone: w.location_zone ?? w.service_area_district ?? null,
          district: w.location_zone ?? w.service_area_district ?? w.neighborhood ?? null,
          radius_km: w.radius_km ?? (w.service_area_radius_m != null ? Math.round(Number(w.service_area_radius_m) / 1000) : null),
          latitude: coords.lat,
          longitude: coords.lng,
          available_days: w.available_days ?? [],
          availability_schedule: w.availability_schedule ?? [],
          tabella_sorgente_dati_posizione: w.location_source ?? "missing",
          tabella_sorgente_dati_disponibilita: w.availability_source ?? "missing",
          hasValidCoordinates: coords.hasValidCoordinates,
          hasApproximateLocation,
          shownOnMap,
          motivo_se_non_mostrato_su_mappa: shownOnMap ? null : "nessuna coordinata valida e città/zona non risolvibile",
        };
      });
      console.log("[PUPILLO_WORKER_LOCATION_AVAILABILITY_DEBUG]", locationAvailabilityDebug);
      for (const w of list) {
        const name = `${w.full_name ?? ""} ${w.first_name ?? ""} ${w.last_name ?? ""}`.toLowerCase();
        if (name.includes("nikla")) {
          const coords = getWorkerCoordinates(w);
          console.log("[PUPILLO_NIKLA_DEBUG]", {
            dati_profilo: w,
            dati_disponibilita_normalizzati: {
              available_days: w.available_days ?? [],
              availability_schedule: w.availability_schedule ?? [],
              availability_source: w.availability_source ?? "missing",
              radius_km: w.radius_km ?? null,
            },
            dati_posizione_normalizzati: {
              city: w.location_city ?? w.service_area_city ?? w.residence_city ?? w.city ?? null,
              zone: w.location_zone ?? w.service_area_district ?? null,
              province: w.location_province ?? w.province ?? w.residence_province ?? null,
              latitude: coords.lat,
              longitude: coords.lng,
              coordinate_source: w.coordinate_source ?? "missing",
              location_source: w.location_source ?? "missing",
            },
            risultato_normalizzato_card: {
              luogo: workerLocationLabel(w),
              disponibilita: workerAvailabilityFallback(w),
            },
            risultato_normalizzato_mappa: {
              hasValidCoordinates: coords.hasValidCoordinates,
              hasApproximateLocation: coords.hasApproximateLocation,
              shownOnMap: coords.shownOnMap,
              lat: coords.lat,
              lng: coords.lng,
            },
          });
        }
      }
      console.log("[PUPILLO_WORKER_DEDUPLICATION_DEBUG]", {
        workers_before_deduplication: rawList.length,
        workers_after_deduplication: list.length,
        duplicates_found: dupLog.length,
        duplicate_user_ids: dupLog.map((d) => d.id),
        probable_cause: dupLog.length ? "join o dati duplicati a monte" : "nessuna duplicazione rilevata",
      });
      console.log("[PUPILLO_WORKER_SEARCH_DEEP_DEBUG] loaded worker profiles", {
        restaurant_user_id: user?.id ?? null,
        source: "Supabase server function loadRestaurantWorkerSearchResults",
        worker_ids_from_query: result.workers.length,
        rows_received: rawList.length,
        workers_after_dedup: list.length,
        duplicates_removed: rawList.length - list.length,
        worker_profiles_after_filters: list.length,
        excluded_count: result.workers.length - list.length,
      });
      setWorkers(list);
      // Carica le disponibilità reali dalla tabella worker_availability per i
      // lavoratori visibili. Il campo `profiles.weekly_availability` è legacy
      // e nella maggior parte dei casi non viene popolato dall'onboarding.
      const ids = list.map((w) => w.id);
      if (ids.length > 0) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const [{ data: avRows, error: avErr }, { data: excRows, error: excErr }] = await Promise.all([
          supabase
            .from("worker_availability")
            .select("id, worker_id, day_of_week, time_slot, start_time, end_time, is_flexible, is_last_minute, notes, city, province, district, latitude, longitude, radius_km")
            .in("worker_id", ids),
          supabase
            .from("worker_availability_exceptions")
            .select("id, worker_id, date, is_available, time_slot, start_time, end_time, notes, city, province, district, latitude, longitude, radius_km")
            .in("worker_id", ids)
            .gte("date", todayIso),
        ]);
        if (avErr) {
          console.warn("[workers] availability load error", avErr);
        } else {
          const map: Record<string, AvailabilityRow[]> = {};
          for (const r of (avRows as AvailabilityRow[] | null) ?? []) {
            const arr = map[r.worker_id] ?? [];
            arr.push(r);
            map[r.worker_id] = arr;
          }
          setAvailByWorker(map);
        }
        if (excErr) {
          console.warn("[workers] exceptions load error", excErr);
        } else {
          const exMap: Record<string, AvailabilityExceptionRow[]> = {};
          for (const r of (excRows as AvailabilityExceptionRow[] | null) ?? []) {
            const arr = exMap[r.worker_id] ?? [];
            arr.push(r);
            exMap[r.worker_id] = arr;
          }
          setExcByWorker(exMap);
        }
      } else {
        setAvailByWorker({});
        setExcByWorker({});
      }
      setLoaded(true);
    } catch (error) {
      console.error("[workers] load error", error);
      toast.error(error instanceof Error ? error.message : "Errore durante il caricamento dei lavoratori");
      setWorkers([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (user) {
        const { data } = await supabase
          .from("announcements")
          .select("id, service_date, service_time, end_time, location_address, location_lat, location_lng, professional_profile, tariff_amount, tariff_type, duration_hours, shift_duration_hours, job_city, job_province, job_postal_code, dress_code_items, dress_code_notes, required_skills, language_requirements, license_requirement, notes, job_location_notes, job_additional_directions")
          .eq("restaurant_id", user.id)
          .eq("status", "active");
        const now = new Date();
        const list = ((data as Ann[]) ?? []).filter((a) => {
          const start = getShiftStartDate(a as any);
          return start ? start.getTime() > now.getTime() : true;
        });
        setAnns(list);
        if (list.length) {
          const saved = getLastAnnouncementId(user.id);
          const preferred = saved && list.some((a) => a.id === saved) ? saved : list[0].id;
          setSelected(preferred);
          setLastAnnouncementId(user.id, preferred);
        }
        // Carica i default del ristoratore per arricchire l'anteprima della proposta
        const { data: rd } = await supabase
          .from("profiles")
          .select("default_contact_person_name, contact_person_first_name, contact_person_last_name, default_arrival_advance_minutes, default_arrival_advance_reason")
          .eq("id", user.id)
          .maybeSingle();
        if (rd) {
          const contactName = (rd as any).default_contact_person_name
            || [((rd as any).contact_person_first_name ?? ""), ((rd as any).contact_person_last_name ?? "")]
                .map((s) => String(s).trim()).filter(Boolean).join(" ")
            || null;
          setRestaurantDefaults({
            contact_name: contactName,
            arrival_minutes: (rd as any).default_arrival_advance_minutes ?? null,
            arrival_reason: (rd as any).default_arrival_advance_reason ?? null,
          });
        }
      }
    })();
  }, [user]);

  // Carica tutti i lavoratori all'apertura della pagina
  useEffect(() => {
    if (role === "restaurant") {
      void loadWorkers("page_enter_or_user_change");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.id]);

  // Refetch availabilities when the tab regains focus, so a worker's update
  // shows up here without a full page reload. Also subscribe to realtime
  // changes on the `worker_availability` table for the current worker list.
  useEffect(() => {
    if (role !== "restaurant" || workers.length === 0) return;
    const ids = workers.map((w) => w.id);
    let cancelled = false;
    const refetch = async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [{ data, error }, { data: excData, error: excError }] = await Promise.all([
        supabase
          .from("worker_availability")
          .select("id, worker_id, day_of_week, time_slot, start_time, end_time, is_flexible, is_last_minute, notes, city, province, district, latitude, longitude, radius_km")
          .in("worker_id", ids),
        supabase
          .from("worker_availability_exceptions")
          .select("id, worker_id, date, is_available, time_slot, start_time, end_time, notes, city, province, district, latitude, longitude, radius_km")
          .in("worker_id", ids)
          .gte("date", todayIso),
      ]);
      if (cancelled) return;
      if (!error) {
        const map: Record<string, AvailabilityRow[]> = {};
        for (const r of (data as AvailabilityRow[] | null) ?? []) {
          const arr = map[r.worker_id] ?? [];
          arr.push(r);
          map[r.worker_id] = arr;
        }
        setAvailByWorker(map);
      }
      if (!excError) {
        const exMap: Record<string, AvailabilityExceptionRow[]> = {};
        for (const r of (excData as AvailabilityExceptionRow[] | null) ?? []) {
          const arr = exMap[r.worker_id] ?? [];
          arr.push(r);
          exMap[r.worker_id] = arr;
        }
        setExcByWorker(exMap);
      }
    };
    const onFocus = () => { void refetch(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase
      .channel(`workers-availability-${ids.length}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_availability" },
        (payload) => {
          const wid = (payload.new as any)?.worker_id ?? (payload.old as any)?.worker_id;
          if (wid && ids.includes(wid)) void refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_availability_exceptions" },
        (payload) => {
          const wid = (payload.new as any)?.worker_id ?? (payload.old as any)?.worker_id;
          if (wid && ids.includes(wid)) void refetch();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [role, workers]);

  // Carica le relazioni ristoratore ↔ lavoratori (turni, candidature, proposte, recensioni)
  useEffect(() => {
    if (role !== "restaurant" || !user) return;
    let cancelled = false;
    (async () => {
      const [appsRes, shiftsRes, reviewsRes] = await Promise.all([
        supabase
          .from("applications")
          .select("id, worker_id, announcement_id, status, last_message_at, created_at")
          .eq("restaurant_id", user.id),
        supabase
          .from("shifts")
          .select("worker_id, status, shift_date, announcement_id")
          .eq("restaurant_id", user.id),
        supabase
          .from("reviews")
          .select("target_id, created_at, rating")
          .eq("author_id", user.id),
      ]);
      const apps = (appsRes.data as Array<{ id: string; worker_id: string; announcement_id: string | null; status: string | null; last_message_at: string | null; created_at: string }>) ?? [];
      const shifts = (shiftsRes.data as Array<{ worker_id: string; status: string | null; shift_date: string | null; announcement_id: string | null }>) ?? [];
      const reviews = (reviewsRes.data as Array<{ target_id: string; created_at: string; rating: number | null }>) ?? [];

      // Ultima proposta + risposta per ogni candidatura
      const appIds = apps.map(a => a.id);
      let respByApp: Record<string, { status: "accepted" | "rejected"; created_at: string }> = {};
      if (appIds.length) {
        const { data: resp } = await supabase
          .from("proposal_responses")
          .select("application_id, status, created_at")
          .in("application_id", appIds)
          .order("created_at", { ascending: true });
        for (const r of (resp ?? []) as Array<{ application_id: string; status: "accepted" | "rejected"; created_at: string }>) {
          // tieni l'ultima (l'order è crescente, sovrascrivo)
          respByApp[r.application_id] = { status: r.status, created_at: r.created_at };
        }
      }

      const map: Record<string, WorkerRel> = {};
      // Candidature
      for (const a of apps) {
        const r = map[a.worker_id] ?? emptyRel();
        r.contacted = true;
        const ts = a.last_message_at ?? a.created_at;
        r.lastContactAt = Math.max(r.lastContactAt, ts ? new Date(ts).getTime() : 0);
        if (a.last_message_at) r.hasOpenChat = true;
        const createdTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        if (createdTs >= r.lastAppCreatedAt) {
          r.lastAppCreatedAt = createdTs;
          r.lastAppId = a.id;
        }
        const resp = respByApp[a.id];
        if (resp) {
          if (resp.status === "accepted") r.hasAccepted = true;
          if (resp.status === "rejected") r.hasRejected = true;
          r.latestResponseAt = Math.max(r.latestResponseAt, new Date(resp.created_at).getTime());
          r.latestResponseStatus = r.latestResponseAt === new Date(resp.created_at).getTime() ? resp.status : r.latestResponseStatus;
        } else if (a.status === "pending") {
          r.hasPending = true;
        }
        // Un'applicazione è "attiva" se non rifiutata/annullata/scaduta/chiusa.
        const statusLower = (a.status ?? "").toLowerCase();
        const isAppActive =
          !["rejected", "cancelled", "canceled", "expired", "withdrawn", "closed", "completed"].includes(statusLower) &&
          resp?.status !== "rejected";
        if (isAppActive && a.announcement_id) {
          r.hasActiveApp = true;
          r.activeAppByAnn.set(a.announcement_id, a.id);
        }
        map[a.worker_id] = r;
      }
      // Turni completati
      for (const s of shifts) {
        const r = map[s.worker_id] ?? emptyRel();
        if (s.status === "completed") r.workedWith = true;
        if (s.status === "scheduled") r.hasShiftScheduled = true;
        if (s.status === "cancelled" || s.status === "canceled" || s.status === "expired") {
          r.hasCancelledShift = true;
        }
        if (s.announcement_id) r.shiftAnnouncementIds.add(s.announcement_id);
        if (s.shift_date) r.lastContactAt = Math.max(r.lastContactAt, new Date(s.shift_date).getTime());
        r.contacted = true;
        map[s.worker_id] = r;
      }
      // Recensioni lasciate
      for (const rv of reviews) {
        const r = map[rv.target_id] ?? emptyRel();
        r.reviewed = true;
        const ts = new Date(rv.created_at).getTime();
        if (ts >= r.lastReviewAt) {
          r.lastReviewAt = ts;
          r.lastReviewRating = rv.rating ?? null;
        }
        map[rv.target_id] = r;
      }
      // Ultima recensione PUBBLICA ricevuta dal lavoratore (da qualsiasi autore),
      // limitata ai lavoratori già contattati da questo ristoratore.
      const contactedIds = Object.keys(map).filter((id) => map[id].contacted);
      if (contactedIds.length) {
        const { data: wReviews } = await supabase
          .from("reviews")
          .select("target_id, rating, comment, created_at")
          .in("target_id", contactedIds)
          .eq("is_visible_to_restaurants", true)
          .order("created_at", { ascending: false });
        const seen = new Set<string>();
        for (const rv of ((wReviews ?? []) as Array<{ target_id: string; rating: number | null; comment: string | null; created_at: string }>)) {
          if (seen.has(rv.target_id)) continue;
          seen.add(rv.target_id);
          const r = map[rv.target_id];
          if (!r) continue;
          r.workerLastReview = { rating: rv.rating, comment: rv.comment, created_at: rv.created_at };
        }
      }
      if (!cancelled) setRel(map);
    })();
    return () => { cancelled = true; };
  }, [role, user?.id]);

  if (role !== "restaurant") return <AppShell><p>Solo i ristoratori.</p></AppShell>;

  // Apre il dialog di conferma proposta (oppure il dialog "seleziona annuncio" se mancante).
  const openProposalDialog = (worker: W) => {
    if (!selected) { setMissingAnnOpen(true); return; }
    // Warn the restaurant if the worker hasn't selected the announcement's
    // role among their declared mansioni. Non blocking: they can proceed.
    const ann = anns.find((a) => a.id === selected) ?? selectedAnn;
    const requiredRole = ann?.professional_profile ?? null;
    const rc = getRoleCompatibility(worker, requiredRole);
    if (rc.status === "not_compatible") {
      const ok = typeof window !== "undefined"
        ? window.confirm(
            `Questo lavoratore non ha indicato "${rc.requiredRoleLabel}" tra le sue mansioni. Vuoi procedere comunque?`,
          )
        : true;
      if (!ok) return;
    }
    setProposalWorker(worker);
  };

  // Esegue l'invio della proposta dopo la conferma esplicita del ristoratore.
  const sendProposal = async (workerId: string) => {
    if (!selected || !user) { toast.error("Seleziona prima un annuncio"); return; }
    setSendingProposal(true);
    try {
      // BACKEND RECHECK: la disponibilità speciale prevale sempre. Se per la
      // data dell'annuncio esistono eccezioni e nessuna è compatibile con
      // città/zona/orario (o segna "Non disponibile"), blocchiamo qui prima
      // di creare la candidatura → nessuna chat, nessuna notifica, nessun
      // credito scalato.
      const ann = anns.find((a) => a.id === selected) ?? selectedAnn;
      if (ann) {
        const { data: excRows } = await supabase
          .from("worker_availability_exceptions")
          .select("*")
          .eq("worker_id", workerId)
          .eq("date", ann.service_date);
        const excs = (excRows ?? []) as AvailabilityExceptionRow[];
        if (excs.length > 0) {
          const { data: avRows } = await supabase
            .from("worker_availability")
            .select("*")
            .eq("worker_id", workerId);
          const level = computeCompatibility(
            (avRows ?? []) as AvailabilityRow[],
            excs,
            ann.service_date,
            ann.service_time ?? null,
            ann.end_time ?? null,
            ann.job_city ?? null,
          );
          if (level === "non_disponibile") {
            toast.error(
              "Non puoi inviare questa proposta perché il lavoratore non è disponibile per città, data o orario dell'annuncio.",
            );
            setProposalWorker(null);
            setSendingProposal(false);
            return;
          }
        }
      }
      // Anti-doppio contatto + supporto "Invita di nuovo":
      // - blocca se esiste già una candidatura/proposta ATTIVA per questo
      //   ristoratore e lavoratore sullo stesso annuncio;
      // - se invece esiste una vecchia richiesta CHIUSA (annullata dal
      //   lavoratore, rifiutata dal ristoratore, scaduta, ecc.), il
      //   ristoratore può ri-invitare: riusiamo la riga esistente
      //   portandola di nuovo a `pending` (la tabella ha UNIQUE su
      //   (announcement_id, worker_id), quindi non possiamo creare un
      //   secondo record; preserviamo così anche lo storico chat).
      const inviteDecision = await canRestaurantInviteWorker(workerId, selected);
      if (!inviteDecision.allowed) {
        setProposalWorker(null);
        setAlreadyContactAppId(inviteDecision.applicationId);
        setSendingProposal(false);
        return;
      }
      let applicationId: string;
      if (inviteDecision.mode === "reactivate") {
        const { data: updated, error: reErr } = await supabase
          .from("applications")
          .update({
            status: "pending",
            restaurant_id: user.id,
            proposed_tariff: null,
            worker_response_at: null,
          } as never)
          .eq("id", inviteDecision.applicationId)
          .select("id")
          .single();
        if (reErr || !updated) {
          toast.error(reErr?.message ?? "Impossibile riattivare la richiesta.");
          setSendingProposal(false);
          return;
        }
        applicationId = (updated as { id: string }).id;
      } else {
        const { data: created, error } = await supabase
          .from("applications")
          .insert({ announcement_id: selected, worker_id: workerId, restaurant_id: user.id, status: "pending" })
          .select("id")
          .single();
        if (error || !created) {
          if (error && isDuplicateContactError(error)) {
            const c = await checkExistingContact({ announcementId: selected, workerId });
            setProposalWorker(null);
            setAlreadyContactAppId(c.existing ? c.applicationId : null);
            setSendingProposal(false);
            return;
          }
          toast.error(error?.message ?? "Errore");
          setSendingProposal(false);
          return;
        }
        applicationId = created.id;
      }
      try {
        await sendShiftProposal({
          applicationId,
          announcementId: selected,
          restaurantId: user.id,
          workerId,
        });
      } catch (err: any) {
        if (err?.name === "WorkerBusyError") {
          toast.error(err.message);
          setSendingProposal(false);
          return;
        }
        throw err;
      }
      // La notifica al lavoratore viene creata automaticamente dal trigger
      // `notify_new_message` con titolo "Hai ricevuto una proposta di lavoro"
      // e link `/messages/<applicationId>` quando il messaggio è di tipo
      // `shift_proposal`.
      toast.success("Proposta inviata al lavoratore.");
      setProposalWorker(null);
      nav({ to: "/messages/$id", params: { id: applicationId } });
    } finally {
      setSendingProposal(false);
    }
  };

  const fieldsOf = (w: W) => {
    // Per la RICERCA (filtro) usiamo i campi reali del profilo (case-insensitive).
    // La PRIVACY è gestita a livello di VISUALIZZAZIONE da `displayWorkerName`:
    // il ristoratore può filtrare per nome ma vedrà comunque solo il nome
    // pubblico finché non c'è una relazione confermata.
    const first = (w.first_name ?? "").toLowerCase().trim();
    const last = (w.last_name ?? "").toLowerCase().trim();
    const fullName = (
      (w.full_name && w.full_name.trim()) ||
      [w.first_name, w.last_name].filter(Boolean).join(" ")
    ).toLowerCase().trim();
    const [fnFirst = "", ...fnRest] = fullName.split(/\s+/);
    return {
      fullName,
      first: first || fnFirst,
      last: last || fnRest.join(" "),
      title: (w.professional_profile ?? "").toLowerCase(),
      description: (w.short_bio ?? "").toLowerCase(),
      roles: [w.primary_role ?? "", ...(w.secondary_roles ?? [])].join(" ").toLowerCase(),
      langs: [
        ...normalizeSpokenLanguages(w.spoken_languages).map((s) => s.language),
        ...(w.languages ?? []),
      ].join(" ").toLowerCase(),
      city: [w.service_area_city, w.residence_city, w.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      zone: [w.neighborhood, w.service_area_district].filter(Boolean).join(" ").toLowerCase(),
      province: (w.province ?? "").toLowerCase(),
      badge: (w.badge ?? "").toLowerCase(),
      availability: [
        availabilitySearchText(availByWorker[w.id]),
        (w.weekly_availability ?? []).join(" ").toLowerCase(),
        w.available_now_until ? "oggi today disponibile ora" : "",
      ].filter(Boolean).join(" "),
    };
  };

  const matchesSubcategory = (w: W, cat: Category, sub: string): boolean => {
    if (!sub) return true;
    const f = fieldsOf(w);
    const s = sub.toLowerCase();
    const roleAliases: Record<string, string[]> = {
      cameriere: ["cameriere", "camerieri", "cameriera", "cameriere di sala", "commis di sala", "responsabile di sala"],
      bartender: ["bartender", "barman", "barlady", "cocktail"],
      barista: ["barista", "caffetteria", "banconista"],
      chef: ["chef", "cuoco", "cucina"],
      "aiuto cucina": ["aiuto cucina", "commis di cucina", "cucina", "preparazione linea"],
      runner: ["runner", "sala"],
      lavapiatti: ["lavapiatti", "lavaggio"],
    };
    const skillAliases: Record<string, string[]> = {
      "preparazione cocktail": ["cocktail", "bartender", "barman"],
      caffetteria: ["caffetteria", "barista", "banconista"],
      "servizio al tavolo": ["servizio al tavolo", "cameriere", "sala"],
      "preparazione linea": ["preparazione linea", "aiuto cucina", "commis di cucina"],
    };
    switch (cat) {
      case "all": return true; // sub controls sort, not filter
      case "name_profile": return true; // sub determines which field free-text targets
      // PUPILLO: per la categoria "Ruolo" non escludiamo: la card mostrerà
      // un badge "Compatibile" o "Fuori mansione". Mantenuto solo come
      // info, l'ordinamento porta i compatibili in cima.
      case "role": return true;
      case "skill": return s === "altro" || (skillAliases[s] ?? [s]).some((alias) => (f.title + " " + f.description + " " + f.roles).includes(alias));
      case "language": return s === "altro" ? true : f.langs.includes(s);
      case "location":
        if (s === "vicino a me" || s.startsWith("entro")) return true; // handled by inRange
        return true; // sub determines which location field free-text targets
      case "badge":
        if (["basic","pro","elite"].includes(s)) return f.badge === s;
        if (s === "rating minimo 3+") return (w.rating_avg ?? 0) >= 3;
        if (s === "rating minimo 4+") return (w.rating_avg ?? 0) >= 4;
        if (s === "rating minimo 4.5+") return (w.rating_avg ?? 0) >= 4.5;
        if (s === "affidabilità 80%+") return (w.completed_shifts ?? 0) >= 3 && (w.reliability_pct ?? 0) >= 80;
        if (s === "affidabilità 90%+") return (w.completed_shifts ?? 0) >= 3 && (w.reliability_pct ?? 0) >= 90;
        if (s === "nessun no-show") return (w.no_shows ?? 0) === 0;
        return true;
      case "availability": {
        const map: Record<string, string[]> = {
          "disponibile oggi": ["oggi","today"],
          "disponibile domani": ["domani","tomorrow"],
          "disponibile weekend": ["weekend","sabato","domenica","saturday","sunday"],
          "disponibile sera": ["sera","evening","night"],
          "disponibile pranzo": ["pranzo","lunch"],
          "disponibile full-time": ["full","fulltime","full-time"],
          "disponibile extra": ["extra"],
          "disponibile urgente": ["urgente","urgent"],
        };
        const keys = map[s] ?? [s];
        return keys.some(k => f.availability.includes(k));
      }
      case "custom": return true;
      default: return true;
    }
  };

  const matchesText = (w: W, term: string, cat: Category, sub: string): boolean => {
    if (!term) return true;
    const t = term.toLowerCase().trim().replace(/\s+/g, " ");
    const rawF = fieldsOf(w);
    // Privacy: il cognome (e quindi il fullName che lo contiene) può essere
    // usato come criterio di ricerca SOLO se il ristoratore ha già
    // collaborato (turno completato) con questo lavoratore. Altrimenti la
    // ricerca per cognome non deve mai restituire risultati, neanche se il
    // nome combacia: "Mario Rossi" su un lavoratore mai collaborato non
    // deve essere identificabile via "Rossi".
    const workedWith = !!rel[w.id]?.workedWith;
    const f = workedWith
      ? rawF
      : { ...rawF, last: "", fullName: rawF.first };
    const allText = [f.fullName, f.title, f.description, f.roles, f.langs, f.city, f.zone, f.province, f.badge, f.availability].join(" ");
    // Helper: ricerca nome multi-token. "Mar Ros" deve trovare "Mario Rossi".
    // Ogni token deve matchare almeno un campo nome (first / last / fullName).
    const matchesNameTokens = (): boolean => {
      const tokens = t.split(" ").filter(Boolean);
      if (tokens.length === 0) return true;
      return tokens.every((tok) =>
        f.first.includes(tok) || f.last.includes(tok) || f.fullName.includes(tok)
      );
    };
    if (cat === "name_profile") {
      switch (sub) {
        case "Nome": return f.first.includes(t);
        case "Cognome": return f.last.includes(t);
        case "Nome completo": return matchesNameTokens();
        case "Titolo profilo": return f.title.includes(t);
        case "Descrizione profilo": return f.description.includes(t);
        default: return matchesNameTokens() || f.title.includes(t) || f.description.includes(t);
      }
    }
    if (cat === "role") return (f.roles).includes(t) || matchesNameTokens();
    if (cat === "skill") return (f.title + " " + f.description + " " + f.city).includes(t) || matchesNameTokens();
    if (cat === "language") return (f.langs + " " + f.city + " " + f.title).includes(t);
    if (cat === "location") {
      switch (sub) {
        case "Città": return f.city.includes(t);
        case "Zona / Quartiere": return f.zone.includes(t);
        case "Provincia": return f.province.includes(t);
        default: return (f.city + " " + f.zone + " " + f.province).includes(t);
      }
    }
    if (cat === "badge") return (f.badge + " " + f.roles).includes(t) || matchesNameTokens();
    if (cat === "availability") return (f.availability + " " + f.roles).includes(t) || matchesNameTokens();
    // all + custom: include il fullName per default
    return allText.includes(t) || matchesNameTokens();
  };

  const q = qInput.trim();
  const hasActiveFilters = category !== "all" || !!subcategory || !!q || !!lang;
  const selectedAnn = anns.find((a) => a.id === selected);
  // L'annuncio selezionato NON deve mai escludere lavoratori dalla lista
  // (regola Pupillo "Cerca lavoratori"): il ruolo dell'annuncio serve
  // solo per ordinare e per mostrare il badge di compatibilità. I
  // lavoratori non compatibili restano visibili, vengono soltanto messi
  // dopo. La ricerca avanzata invece può filtrare in modo esplicito.
  const announcementRole = selectedAnn?.professional_profile ?? null;
  // Ruolo "attivo" usato per (a) filtrare i risultati standard e (b) decidere
  // quale etichetta di ruolo mostrare sotto il nome di ogni lavoratore.
  // Priorità: ricerca avanzata per ruolo > ruolo dell'annuncio selezionato.
  const advancedRole =
    category === "role" && subcategory && subcategory.toLowerCase() !== "altro ruolo"
      ? subcategory
      : null;
  const activeRoleContext: string | null = advancedRole ?? announcementRole ?? null;
  const filtered = workers.filter((worker) => {
    // PUPILLO: anche se l'utente ha scelto un ruolo specifico nella
    // ricerca avanzata, NON nascondiamo i lavoratori che non lo hanno tra
    // le mansioni dichiarate. Restano visibili in coda con un badge
    // "Fuori mansione" così il ristoratore può comunque contattarli.
    if (!matchesSubcategory(worker, category, subcategory)) return false;
    if (!matchesText(worker, q, category, subcategory)) return false;
    if (lang) {
      const spoken = normalizeSpokenLanguages(worker.spoken_languages).map((item) => item.language.toLowerCase());
      const legacy = (worker.languages ?? []).map((item) => item.toLowerCase());
      if (![...spoken, ...legacy].some((item) => item.includes(lang.toLowerCase()))) return false;
    }
    return true;
  });
  const resetFilters = () => {
    setCategory("all");
    setSubcategory("");
    setQInput("");
    setLang("");
    void loadWorkers("filters_reset");
  };
  const onChangeCategory = (c: Category) => { setCategory(c); setSubcategory(""); };
  const removeCategoryChip = () => { setCategory("all"); setSubcategory(""); };
  const removeSubChip = () => setSubcategory("");
  const removeQChip = () => setQInput("");
  const removeLangChip = () => setLang("");

  const inRange = (w: W) => {
    if (!selectedAnn?.location_lat || !selectedAnn?.location_lng) return false;
    if (w.service_area_lat == null || w.service_area_lng == null) return false;
    const d = distanceM(selectedAnn.location_lat, selectedAnn.location_lng, w.service_area_lat, w.service_area_lng);
    return d <= (w.service_area_radius_m ?? 500);
  };
  // location distance sub-filter
  const distLimit: number | null = (() => {
    if (category !== "location") return null;
    const m: Record<string, number> = { "Entro 1 km": 1000, "Entro 3 km": 3000, "Entro 5 km": 5000, "Entro 10 km": 10000, "Entro 20 km": 20000 };
    return m[subcategory] ?? null;
  })();
  const distFiltered = filtered.filter((w) => {
    if (category === "location" && subcategory === "Vicino a me") return inRange(w);
    if (distLimit != null) {
      if (!selectedAnn?.location_lat || !selectedAnn?.location_lng) return false;
      if (w.service_area_lat == null || w.service_area_lng == null) return false;
      return distanceM(selectedAnn.location_lat, selectedAnn.location_lng, w.service_area_lat, w.service_area_lng) <= distLimit;
    }
    return true;
  });

  // Per-worker compatibility with the selected announcement. `null` means
  // the worker has no availability rows at all → keep visible but rank
  // below those with declared availability.
  const compatByWorker: Record<string, CompatibilityLevel | null> = {};
  // Per-worker hard block: una "disponibilità speciale" esiste per la data
  // dell'annuncio ma NON è compatibile (città/zona/orario o "Non disponibile").
  // Quando true, il pulsante "Invia proposta" va disabilitato.
  const specialBlockByWorker: Record<
    string,
    { blocked: boolean; specials: AvailabilityExceptionRow[] } | null
  > = {};
  if (selectedAnn) {
    for (const w of distFiltered) {
      const rows = availByWorker[w.id];
      const excs = (excByWorker[w.id] ?? []).filter(
        (e) => e.date === selectedAnn.service_date,
      );
      if ((!rows || rows.length === 0) && excs.length === 0) {
        compatByWorker[w.id] = null;
        specialBlockByWorker[w.id] = null;
        continue;
      }
      const level = computeCompatibility(
        rows ?? [],
        excs,
        selectedAnn.service_date,
        selectedAnn.service_time ?? null,
        selectedAnn.end_time ?? null,
        selectedAnn.job_city ?? null,
      );
      compatByWorker[w.id] = level;
      specialBlockByWorker[w.id] = computeSpecialBlock(excs, level);
    }
  }

  const sorted = [...distFiltered].sort((a, b) => {
    // Ordinamento personale per ristoratore: priorità a chi è già stato
    // contattato / ha già lavorato con questo ristoratore. I filtri di
    // ordinamento espliciti (subcategoria di "Tutto") vincono.
    if (category === "all") {
      if (subcategory === "Ultimi attivi") return (new Date(b.last_active_at ?? 0).getTime()) - (new Date(a.last_active_at ?? 0).getTime());
      if (subcategory === "Miglior rating") return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
      if (subcategory === "Più affidabili") {
        // Profiles with fewer than 3 completed shifts don't yet have a
        // credible reliability score; treat them as neutral (-1) so they
        // sort after profiles that DO have a real score.
        const score = (w: typeof a) =>
          (w.completed_shifts ?? 0) >= 3 ? (w.reliability_pct ?? 0) : -1;
        return score(b) - score(a);
      }
    }
    // Quando c'è un ruolo "attivo" (ricerca avanzata oppure annuncio
    // selezionato), i lavoratori COMPATIBILI con quella mansione vanno
    // SEMPRE prima dei NON compatibili. I non compatibili restano visibili
    // e mostrano un badge "Fuori mansione".
    if (activeRoleContext) {
      const ra = workerMatchesRole(a, activeRoleContext) ? 0 : 1;
      const rb = workerMatchesRole(b, activeRoleContext) ? 0 : 1;
      if (ra !== rb) return ra - rb;
    }
    // Penalizzazione affidabilità (3+ ritardi confermati): i lavoratori
    // penalizzati restano ricercabili ma scendono SEMPRE in fondo, dopo
    // aver verificato compatibilità minima (filtri già applicati sopra).
    const pa = a.search_penalty_active ? 1 : 0;
    const pb = b.search_penalty_active ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const ra = rel[a.id]; const rb = rel[b.id];
    const ta = tierOf(ra, a.rating_avg); const tb = tierOf(rb, b.rating_avg);
    if (ta !== tb) return ta - tb;
    // Inside the same group: prioritise availability for the selected
    // announcement (when one is selected), then last contact, rating, zone.
    if (selectedAnn) {
      const ca = compatTier(compatByWorker[a.id] ?? null);
      const cb = compatTier(compatByWorker[b.id] ?? null);
      if (ca !== cb) return ca - cb;
    }
    const la = ra?.lastContactAt ?? 0; const lb = rb?.lastContactAt ?? 0;
    if (la !== lb) return lb - la;
    const ar = a.rating_avg ?? 0; const br = b.rating_avg ?? 0;
    if (ar !== br) return br - ar;
    return Number(inRange(b)) - Number(inRange(a));
  });

  const credits = profile?.credits ?? 0;
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";
  const cost = CREDIT_COSTS.assignWorker;
  const canAfford = isPaid || credits >= cost;

  if (loaded) {
    const validCoords = sorted.filter(
      (w) => w.service_area_lat != null && w.service_area_lng != null,
    ).length;
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_WORKER_MAP_SOURCE_DEBUG]", {
      restaurant_user_id: user?.id ?? null,
      selected_view: view,
      source: "Supabase (state `workers` → derive `sorted`)",
      workers_from_supabase: workers.length,
      workers_after_dedup: workers.length,
      workers_after_filters: sorted.length,
      workers_with_valid_coords: validCoords,
      workers_rendered_in_list: view === "list" ? sorted.length : 0,
      workers_rendered_on_map: view === "map" ? validCoords : 0,
    });
    console.log("[PUPILLO_WORKER_RENDER_SOURCE_FINAL_DEBUG]", {
      componente: "src/routes/workers.tsx",
      source_dati_usata: "Supabase server function loadRestaurantWorkerSearchResults",
      numero_profili_ricevuti_prima_del_filtro_ruolo: workerSearchDebug?.profiles_received_before_final_filter ?? workers.length,
      numero_profili_con_ruolo_worker: workerSearchDebug?.worker_role_user_ids ?? workers.length,
      numero_profili_esclusi_perche_admin: workerSearchDebug?.excluded_admin ?? 0,
      numero_profili_esclusi_perche_restaurant: workerSearchDebug?.excluded_restaurant ?? 0,
      numero_profili_esclusi_perche_senza_ruolo: workerSearchDebug?.excluded_without_worker_role ?? 0,
      array_finale_renderizzato: sorted.map((w) => ({ user_id: w.id, nome: w.full_name, ruolo: w.primary_role, user_roles: w.user_roles ?? [] })),
    });
  }
  if (import.meta.env.DEV && loaded) {
    const compatCount = selectedAnn
      ? distFiltered.filter((w) => {
          const c = compatByWorker[w.id];
          return c === "disponibile" || c === "compatibile";
        }).length
      : 0;
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_WORKER_SEARCH_DEBUG]", {
      restaurant_id: user?.id ?? null,
      active_announcements: anns.length,
      selected_announcement: selected || null,
      workers_total: workers.length,
      workers_after_filters: sorted.length,
      compatible_with_selected: compatCount,
      not_compatible_with_selected: selectedAnn ? distFiltered.length - compatCount : 0,
      filters: { category, subcategory, q, lang },
    });
  }
  if (loaded) {
    const compatCount = selectedAnn
      ? sorted.filter((w) => {
          const c = compatByWorker[w.id];
          return c === "disponibile" || c === "compatibile";
        }).length
      : 0;
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_VISIBILITY_NOT_HARD_FILTER_DEBUG]", {
      page: "cerca_lavoratori",
      current_user_id: user?.id ?? null,
      selected_filters: { category, subcategory, q, lang, selected_announcement_id: selected || null },
      worker_availability_city: null,
      worker_extra_availability_city: null,
      selected_announcement_city: selectedAnn?.job_city ?? null,
      hard_filters_applied: false,
      soft_matching_used: true,
      total_items_before_filters: workers.length,
      total_items_after_filters: filtered.length,
      total_items_final_rendered: sorted.length,
    });
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_RESTAURANT_WORKER_SEARCH_SOFT_MATCH_DEBUG]", {
      restaurant_user_id: user?.id ?? null,
      selected_announcement_id: selected || null,
      total_workers_real: workers.length,
      workers_compatible: compatCount,
      workers_not_compatible: selectedAnn ? sorted.length - compatCount : 0,
      workers_final_rendered: sorted.length,
      worker_excluded_reason: null, // mai esclusi per disponibilità: solo ordinamento
    });
  }

  return (
    <AppShell>
      <PageHeader title="Cerca lavoratori" subtitle="Trova personale extra disponibile" />
      <RequiredReviewsBanner />
      <BlockedContactDialog open={blockOpen} onClose={() => setBlockOpen(false)} shifts={actionShifts} />
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${canAfford ? "bg-card" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          {isPaid ? (
            <span>Piano <strong className="capitalize">{profile?.plan}</strong> attivo · inviti illimitati</span>
          ) : (
            <span>
              Contattare è gratis. La conferma di un lavoratore costa <strong>{cost} crediti</strong>. Paghi solo quando trovi davvero una persona disponibile. Saldo: <strong>{credits}</strong>
            </span>
          )}
        </div>
        {!isPaid && !canAfford && (
          <Link to="/billing"><Button size="sm" variant="outline" className="gap-1"><AlertCircle className="h-3.5 w-3.5" />Acquista crediti</Button></Link>
        )}
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Annuncio per cui contattare</label>
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); setLastAnnouncementId(user?.id, e.target.value); }}
            className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">
              {anns.length > 0 ? "Tutti i lavoratori (nessun filtro annuncio)" : "Nessun annuncio attivo"}
            </option>
            {anns.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAnnouncementLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Lingua (filtro rapido)</label>
          <Select value={lang || "__all"} onValueChange={(v) => setLang(v === "__all" ? "" : v)}>
            <SelectTrigger className="mt-1 h-9 w-full"><SelectValue placeholder="Tutte le lingue" /></SelectTrigger>
            <SelectContent className="z-[60] max-h-[60vh]">
              <SelectItem value="__all">Tutte le lingue</SelectItem>
              {LANGUAGE_OPTIONS.filter((l) => l !== "Altro").map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Unified search box */}
      <div className="mb-4 rounded-2xl border bg-card p-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_15%,transparent)]">
        <label className="mb-2 block text-sm font-medium">Ricerca avanzata lavoratori</label>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <Select value={category} onValueChange={(v) => onChangeCategory(v as Category)}>
            <SelectTrigger aria-label="Categoria di ricerca" className="h-9 lg:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="z-[60] max-h-[60vh]">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
                <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subcategory || "__none"} onValueChange={(v) => setSubcategory(v === "__none" ? "" : v)}>
            <SelectTrigger aria-label="Sottocategoria" className="h-9 lg:w-[220px]">
              <SelectValue placeholder="— Sottocategoria —" />
            </SelectTrigger>
            <SelectContent className="z-[60] max-h-[60vh]">
              <SelectItem value="__none">— Sottocategoria —</SelectItem>
              {SUBCATEGORIES[category].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={PLACEHOLDER_BY_CATEGORY[category]}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetFilters} disabled={!hasActiveFilters} className="gap-1"><RotateCcw className="h-4 w-4" />Rimuovi filtri</Button>
          </div>
        </div>
        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {category !== "all" && (
              <button onClick={removeCategoryChip} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20">
                {CATEGORY_LABEL[category]} <X className="h-3 w-3" />
              </button>
            )}
            {subcategory && (
              <button onClick={removeSubChip} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20">
                {subcategory} <X className="h-3 w-3" />
              </button>
            )}
            {q && (
              <button onClick={removeQChip} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20">
                "{q}" <X className="h-3 w-3" />
              </button>
            )}
            {lang && (
              <button onClick={removeLangChip} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20">
                Lingua: {lang} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? "Caricamento lavoratori…"
            : (() => {
                const n = loaded ? sorted.length : 0;
                return `${n} ${n === 1 ? "lavoratore trovato" : "lavoratori trovati"}`;
              })()}
        </p>
        {hasActiveFilters ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Ricerca avanzata attiva
            <button onClick={resetFilters} className="ml-1 inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
              <RotateCcw className="h-3 w-3" />Cancella filtri
            </button>
          </span>
        ) : announcementRole ? (
          <span className="text-xs text-muted-foreground">
            Ordinati per compatibilità con: <strong className="text-foreground capitalize">{announcementRole}</strong>
          </span>
        ) : null}
        <div className="inline-flex rounded-lg border p-0.5">
          <Button size="sm" variant={view==="list"?"secondary":"ghost"} onClick={()=>setView("list")} className="gap-1"><List className="h-4 w-4" />Lista</Button>
          <Button size="sm" variant={view==="map"?"secondary":"ghost"} onClick={()=>setView("map")} className="gap-1"><MapIcon className="h-4 w-4" />Mappa</Button>
        </div>
      </div>
      {anns.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">Clicca un annuncio per selezionarlo</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {anns.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelected(a.id); setLastAnnouncementId(user?.id, a.id); }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition ${selected===a.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent"}`}
              >
                <div className="font-medium">{new Date(a.service_date).toLocaleDateString("it-IT")}</div>
                {a.location_address && (
                  <div className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{a.location_address}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {view === "map" ? (
        <WorkersMapSection
          workers={sorted}
          rel={rel}
          fallbackCenter={
            selectedAnn?.location_lat != null && selectedAnn?.location_lng != null
              ? [selectedAnn.location_lat as number, selectedAnn.location_lng as number]
              : [41.9028, 12.4964]
          }
          onInvite={requireComplete((workerId: string) => { const w = workers.find((x) => x.id === workerId); if (w) openProposalDialog(w); })}
          inviteDisabled={!selected}
          inviteLabel={selected ? "Invia proposta" : "Seleziona annuncio"}
        />
      ) : (
      <div className="space-y-6">
        {(() => {
          const sectionOf = (w: W): "worked" | "contacted" | "other" => {
            const t = tierOf(rel[w.id], w.rating_avg);
            if (t <= 1) return "worked";
            if (t <= 4) return "contacted";
            return "other";
          };
          const groups: { key: "worked" | "contacted" | "other"; title: string; items: W[] }[] = [
            { key: "worked", title: "Già lavorato con te", items: [] },
            { key: "contacted", title: "Già contattati", items: [] },
            { key: "other", title: "Altri lavoratori disponibili", items: [] },
          ];
          for (const w of sorted) groups.find(g => g.key === sectionOf(w))!.items.push(w);
          return groups.filter(g => g.items.length > 0).map(g => (
            <section key={g.key}>
              <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                {g.key === "worked" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {g.key === "contacted" && <History className="h-4 w-4 text-primary" />}
                {g.title}
                <span className="text-xs font-normal text-muted-foreground">({g.items.length})</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.items.map((w) => {
                  if (!isSafeSearchWorker(w)) {
                    console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", {
                      componente: "src/routes/workers.tsx lista card",
                      profile: w,
                      motivo_blocco: workerBlockReason(w),
                    });
                    return null;
                  }
                  const near = inRange(w);
                  const r = rel[w.id];
                  const compat = selectedAnn ? (compatByWorker[w.id] ?? null) : null;
                  // Coerenza badge: se il lavoratore ha una disponibilità
                  // "legacy" (available_now_until ancora valido oppure
                  // weekly_availability popolato) NON deve comparire
                  // "Disponibilità non indicata" mentre più sotto la card
                  // mostra "Disponibile oggi 19:00 - 23:00".
                  const hasLegacyAvailability =
                    (!!w.available_now_until && new Date(w.available_now_until).getTime() > Date.now())
                    || (Array.isArray(w.weekly_availability) && w.weekly_availability.length > 0);
                  const compatBadge =
                    compat === "disponibile" ? { text: "Disponibile per questo turno", cls: "bg-emerald-500/20 text-emerald-700" }
                    : compat === "compatibile" ? { text: "Compatibile con il turno", cls: "bg-emerald-500/15 text-emerald-700" }
                    : compat === "parziale" ? { text: "Disponibilità parziale", cls: "bg-amber-500/15 text-amber-700" }
                    : selectedAnn
                      ? { text: "Disponibilità non confermata per questo annuncio", cls: "bg-muted text-foreground/70" }
                    : null;
                  if (g.key === "contacted") {
                    return (
                      <ContactedWorkerCard
                        key={w.id}
                        worker={w}
                        rel={r}
                        selectedAnnouncementId={selected || null}
                        activeRoleContext={activeRoleContext}
                        onOpenChat={(appId) => nav({ to: "/messages/$id", params: { id: appId } })}
                        onSendProposal={requireComplete(() => openProposalDialog(w))}
                        canSendProposal={!!selected && !isBlocked}
                        blockedReason={
                          isBlocked
                            ? `Hai ${blockedCount} turn${blockedCount > 1 ? "i" : "o"} da recensire prima di poter inviare nuove proposte.`
                            : (!selected ? "Seleziona un annuncio per inviare una proposta" : null)
                        }
                        availRows={availByWorker[w.id] ?? null}
                        specialForDate={
                          selectedAnn
                            ? (excByWorker[w.id] ?? []).filter((e) => e.date === selectedAnn.service_date)
                            : []
                        }
                        specialDate={selectedAnn?.service_date ?? null}
                        upcomingSpecials={excByWorker[w.id] ?? []}
                        compatBadge={compatBadge}
                        specialBlock={selectedAnn ? specialBlockByWorker[w.id] ?? null : null}
                        onDetails={() => setDetailsWorker(w)}
                      />
                    );
                  }
                  const roleInfo = pickDisplayedRole(w, activeRoleContext);
                  if (typeof console !== "undefined") {
                    const _allRoles = workerCardRoles(w);
                    const _avRows = availByWorker[w.id] ?? null;
                    console.debug("[PUPILLO_WORKER_CARD_DISPLAY_DEBUG]", {
                      pagina: "cerca_lavoratori",
                      componente: "WorkersListCard",
                      user_id: w.id,
                      nome: w.full_name,
                      foto_profilo_presente: undefined,
                      ruoli_grezzi: { primary_role: w.primary_role, secondary_roles: w.secondary_roles ?? [] },
                      ruoli_mostrati: formatWorkerCardRoles(_allRoles),
                      disponibilita_grezza: _avRows,
                      disponibilita_formattata: workerAvailabilityFallback(w),
                      raggio_km: w.radius_km ?? null,
                      raggio_nascosto_dalla_card: true,
                      citta: workerLocationLabel(w),
                    });
                    console.debug("[PUPILLO_WORKER_REVIEWS_CARD_DEBUG]", {
                      pagina: "cerca_lavoratori",
                      worker_user_id: w.id,
                      profile_id: w.id,
                      nome: w.full_name,
                      averageRating: w.rating_avg ?? null,
                      reviewsCount: w.reviews_count ?? 0,
                      rating_mostrato:
                        w.rating_avg != null && Number(w.rating_avg) > 0 && (w.reviews_count ?? 0) > 0
                          ? `${Number(w.rating_avg).toFixed(1).replace(".", ",")} · ${w.reviews_count} ${w.reviews_count === 1 ? "recensione" : "recensioni"}`
                          : "Nessuna recensione ancora",
                      motivo_no_rating:
                        w.rating_avg == null || Number(w.rating_avg) === 0
                          ? "rating_avg assente o 0"
                          : (w.reviews_count ?? 0) === 0
                            ? "reviews_count = 0"
                            : null,
                    });
                  }
                  return (
          <div key={w.id} className={`rounded-2xl border p-5 ${near ? "border-emerald-500/50 bg-emerald-500/5" : "bg-card"}`}>
            <div className="flex items-center gap-3">
              <UserAvatar userId={w.id} name={displayWorkerName(w, !!r?.workedWith)} className="h-12 w-12" />
              <div>
                <div className="font-semibold">{displayWorkerName(w, !!r?.workedWith)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {(() => {
                    const allRoles = workerCardRoles(w);
                    const hasContext = !!(activeRoleContext && activeRoleContext.trim());
                    if (hasContext && roleInfo.label) {
                      return (
                        <span className="capitalize">
                          {roleInfo.label}
                          {roleInfo.secondary && (
                            <span className="text-muted-foreground/80"> · anche {roleInfo.secondary}</span>
                          )}
                        </span>
                      );
                    }
                    const label = formatWorkerCardRoles(allRoles);
                    return label ? <span className="capitalize">{label}</span> : null;
                  })()}
                  <WorkerRatingSummary
                    ratingAvg={w.rating_avg}
                    reviewsCount={w.reviews_count ?? null}
                  />
                  {w.age && <span>· {w.age} anni</span>}
                </div>
                <div className="mt-1"><WorkerReputationBadge profile={w} /></div>
              </div>
              {near && <span className="ml-auto text-[10px] rounded-full bg-emerald-500/20 text-emerald-700 px-2 py-0.5 font-medium">In zona</span>}
            </div>
            {compatBadge && (
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${compatBadge.cls}`}>
                  {compatBadge.text}
                </span>
              </div>
            )}
            {(() => {
              const rc = getRoleCompatibility(w, activeRoleContext);
              const b = getRoleCompatibilityBadge(rc);
              if (!b) return null;
              return (
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${b.cls}`}
                    title={rc.status === "not_compatible"
                      ? `Questo lavoratore non ha indicato "${rc.requiredRoleLabel}" tra le mansioni disponibili.`
                      : undefined}
                  >
                    {b.text}
                  </span>
                </div>
              );
            })()}
            {w.search_penalty_active && (
              <div className="mt-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium"
                  title="Ritardi ripetuti recenti — il profilo ha priorità ridotta nei risultati."
                >
                  Affidabilità da verificare
                </span>
              </div>
            )}
            {r && (r.workedWith || r.contacted) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.workedWith && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3" />Già lavorato con te
                  </span>
                )}
                {r.workedWith && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-medium">
                    <Gift className="h-3 w-3" />Ricontatto gratuito
                  </span>
                )}
                {!r.workedWith && r.contacted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground/80 px-2 py-0.5 text-[10px] font-medium">
                    <History className="h-3 w-3" />Già contattato
                  </span>
                )}
                {r.hasPending && !r.hasAccepted && !r.hasRejected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                    <Clock className="h-3 w-3" />Richiesta in attesa
                  </span>
                )}
                {r.latestResponseStatus === "rejected" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-medium">
                    <ThumbsDown className="h-3 w-3" />Ultima richiesta rifiutata
                  </span>
                )}
                {r.hasAccepted && !r.workedWith && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                    <ThumbsUp className="h-3 w-3" />Ha accettato una proposta
                  </span>
                )}
              </div>
            )}
            {r?.workedWith && r.reviewed && r.lastReviewAt > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Tua ultima recensione:</span>
                {r.lastReviewRating != null && (
                  <span className="inline-flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i <= Math.round(r.lastReviewRating!) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                    <span className="ml-1 tabular-nums font-medium text-foreground">{r.lastReviewRating.toFixed(1)}</span>
                  </span>
                )}
                <span>·</span>
                <span>{new Date(r.lastReviewAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{w.professional_profile || "Profilo non specificato"}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Città attuale:</span>{" "}
                {(() => {
                  return workerLocationLabel(w);
                })()}
              </span>
            </div>
            {(() => {
              const langs: SpokenLanguage[] = normalizeSpokenLanguages(w.spoken_languages);
              const legacy = (langs.length === 0 ? (w.languages ?? []).map(l => ({ language: l })) : langs);
              return legacy.length > 0 ? (
                <div className="mt-2"><SpokenLanguagesView value={legacy} /></div>
              ) : null;
            })()}
            <AvailabilityBlock
              rows={availByWorker[w.id] ?? null}
              specialForDate={
                selectedAnn
                  ? (excByWorker[w.id] ?? []).filter((e) => e.date === selectedAnn.service_date)
                  : []
              }
              specialDate={selectedAnn?.service_date ?? null}
              upcomingSpecials={excByWorker[w.id] ?? []}
              weekly={w.weekly_availability}
              availableNowUntil={w.available_now_until}
              fallbackSummary={workerAvailabilityFallback(w)}
              onDetails={() => setDetailsWorker(w)}
            />
            {(() => {
              const sb = selectedAnn ? specialBlockByWorker[w.id] : null;
              const hardBlocked = !!sb?.blocked;
              return (
                <>
                  <Button
                    size="sm"
                    className="mt-4 w-full gap-1"
                    disabled={hardBlocked}
                    onClick={hardBlocked ? undefined : requireComplete(() => openProposalDialog(w))}
                    title={
                      hardBlocked
                        ? "Il lavoratore ha indicato una disponibilità speciale non compatibile con questo turno"
                        : !selected
                        ? "Scegli un annuncio prima di proporre un turno"
                        : undefined
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {hardBlocked ? "Non disponibile per questo turno" : "Invia proposta"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full gap-1"
                    onClick={() => openWorkerProfile({ workerId: w.id, workerName: w.full_name, trigger: "card_button" })}
                  >
                    <User className="h-3.5 w-3.5" />
                    Vedi profilo
                  </Button>
                  {hardBlocked && (
                    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                      <p className="font-medium">Disponibilità speciale in un'altra città / orario</p>
                      <p className="mt-0.5">
                        Il lavoratore ha indicato una disponibilità speciale non compatibile con questo turno.
                      </p>
                      {sb!.specials.slice(0, 3).map((e) => (
                        <p key={e.id} className="mt-0.5">· {describeSpecial(e)}</p>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {isBlocked && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                Hai {blockedCount} turn{blockedCount > 1 ? "i" : "o"} da recensire prima di poter assegnare nuovi turni.
              </p>
            )}
          </div>
                  );
                })}
              </div>
            </section>
          ));
        })()}
        {loaded && !loading && sorted.length === 0 && (
          <div className="col-span-full flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Nessun lavoratore trovato con questi filtri."
                : "Nessun lavoratore disponibile al momento."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1">
                <RotateCcw className="h-4 w-4" />Rimuovi filtri
              </Button>
            )}
          </div>
        )}
      </div>
      )}
      <ProposalConfirmDialog
        worker={proposalWorker}
        announcement={selectedAnn ?? null}
        defaults={restaurantDefaults}
        rel={proposalWorker ? rel[proposalWorker.id] : undefined}
        sending={sendingProposal}
        onCancel={() => setProposalWorker(null)}
        onConfirm={() => proposalWorker && sendProposal(proposalWorker.id)}
      />
      <AvailabilityDetailsDialog
        worker={detailsWorker}
        onClose={() => setDetailsWorker(null)}
        workedTogether={detailsWorker ? !!rel[detailsWorker.id]?.workedWith : false}
        rows={detailsWorker ? (availByWorker[detailsWorker.id] ?? null) : null}
      />
      <Dialog open={missingAnnOpen} onOpenChange={setMissingAnnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleziona un turno da proporre</DialogTitle>
            <DialogDescription>
              Per inviare una proposta a un lavoratore devi prima scegliere un annuncio attivo, oppure crearne uno nuovo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setMissingAnnOpen(false)}>Annulla</Button>
            <Button onClick={() => { setMissingAnnOpen(false); nav({ to: "/ristoratore/annunci/nuovo" }); }}>
              Crea nuova proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlreadyInContactDialog
        open={!!alreadyContactAppId}
        applicationId={alreadyContactAppId}
        onClose={() => setAlreadyContactAppId(null)}
      />
    </AppShell>
  );
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ContactedWorkerCard({
  worker: w,
  rel: r,
  selectedAnnouncementId,
  activeRoleContext,
  onOpenChat,
  onSendProposal,
  canSendProposal,
  blockedReason,
  availRows,
  specialForDate,
  specialDate,
  upcomingSpecials,
  compatBadge,
  specialBlock,
  onDetails,
}: {
  worker: W;
  rel: WorkerRel | undefined;
  selectedAnnouncementId: string | null;
  activeRoleContext: string | null;
  onOpenChat: (applicationId: string) => void;
  onSendProposal: () => void;
  canSendProposal: boolean;
  blockedReason: string | null;
  availRows: AvailabilityRow[] | null;
  specialForDate: AvailabilityExceptionRow[];
  specialDate: string | null;
  upcomingSpecials: AvailabilityExceptionRow[];
  compatBadge: { text: string; cls: string } | null;
  specialBlock: { blocked: boolean; specials: AvailabilityExceptionRow[] } | null;
  onDetails: () => void;
}) {
  const openWorkerProfile = useOpenWorkerProfile();
  if (!isSafeSearchWorker(w)) {
    console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", {
      componente: "ContactedWorkerCard src/routes/workers.tsx",
      profile: w,
      motivo_blocco: workerBlockReason(w),
    });
    return null;
  }
  const workedTogether = !!r?.workedWith;
  const displayName = displayWorkerName(w, workedTogether);
  // Stato del rapporto
  const assignedToSelected =
    !!selectedAnnouncementId && !!r?.shiftAnnouncementIds.has(selectedAnnouncementId);
  let statusLabel: string | null = null;
  let statusTone: "emerald" | "primary" | "muted" = "muted";
  if (assignedToSelected) {
    statusLabel = "Assegnato a questo turno";
    statusTone = "primary";
  } else if (r?.workedWith) {
    statusLabel = "Collaboratore confermato";
    statusTone = "emerald";
  } else if (r?.hasShiftScheduled) {
    statusLabel = "Turno assegnato";
    statusTone = "emerald";
  } else if (r?.hasAccepted && r?.hasActiveApp) {
    statusLabel = "Candidatura accettata";
    statusTone = "primary";
  } else if (r?.hasCancelledShift) {
    statusLabel = "Turno annullato";
    statusTone = "muted";
  } else if (r?.hasPending) {
    statusLabel = "Candidatura in attesa";
    statusTone = "muted";
  } else if (r?.contacted) {
    statusLabel = "Già contattato";
    statusTone = "muted";
  }
  const statusClass =
    statusTone === "emerald"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : statusTone === "primary"
      ? "bg-primary/15 text-primary"
      : "bg-muted text-foreground/80";
  // Turni completati: valore reale dal profilo (aggiornato dai trigger sui turni).
  const completedShifts = w.completed_shifts ?? 0;
  // Ultima recensione ricevuta dal lavoratore.
  const review = r?.workerLastReview ?? null;
  const reviewComment = (review?.comment ?? "").trim();
  const reviewCommentShort =
    reviewComment.length > 120 ? reviewComment.slice(0, 120).trimEnd() + "…" : reviewComment;
  const reviewRating = review?.rating ?? null;
  const reviewDate = review?.created_at ? new Date(review.created_at) : null;
  // Apri chat: usa l'applicazione più recente con questo lavoratore.
  const appId = r?.lastAppId ?? null;
  const roleInfo = pickDisplayedRole(w, activeRoleContext);
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <UserAvatar userId={w.id} name={displayName} className="h-12 w-12" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{displayName}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {(() => {
              const allRoles = workerCardRoles(w);
              const hasContext = !!(activeRoleContext && activeRoleContext.trim());
              if (hasContext && roleInfo.label) {
                return (
                  <span className="capitalize">
                    {roleInfo.label}
                    {roleInfo.secondary && (
                      <span className="text-muted-foreground/80"> · anche {roleInfo.secondary}</span>
                    )}
                  </span>
                );
              }
              const label = formatWorkerCardRoles(allRoles);
              return label ? <span className="capitalize">{label}</span> : null;
            })()}
            <WorkerRatingSummary
              ratingAvg={w.rating_avg}
              reviewsCount={w.reviews_count ?? null}
            />
          </div>
        </div>
      </div>
      {statusLabel && (
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass}`}>
            <CheckCircle2 className="h-3 w-3" />
            {statusLabel}
          </span>
        </div>
      )}
      {compatBadge && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${compatBadge.cls}`}>
            {compatBadge.text}
          </span>
        </div>
      )}
      {(() => {
        const rc = getRoleCompatibility(w, activeRoleContext);
        const b = getRoleCompatibilityBadge(rc);
        if (!b) return null;
        return (
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${b.cls}`}
              title={rc.status === "not_compatible"
                ? `Questo lavoratore non ha indicato "${rc.requiredRoleLabel}" tra le mansioni disponibili.`
                : undefined}
            >
              {b.text}
            </span>
          </div>
        );
      })()}
      {w.search_penalty_active && (
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium"
            title="Ritardi ripetuti recenti — il profilo ha priorità ridotta nei risultati."
          >
            Affidabilità da verificare
          </span>
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Città attuale:</span>{" "}
          {(() => {
            return workerLocationLabel(w);
          })()}
        </span>
      </div>
      {(() => {
        const langs: SpokenLanguage[] = normalizeSpokenLanguages(w.spoken_languages);
        const legacy = langs.length === 0 ? (w.languages ?? []).map((l) => ({ language: l })) : langs;
        return legacy.length > 0 ? (
          <div className="mt-2"><SpokenLanguagesView value={legacy} /></div>
        ) : null;
      })()}
      <AvailabilityBlock
        rows={availRows}
        specialForDate={specialForDate}
        specialDate={specialDate}
        upcomingSpecials={upcomingSpecials}
        weekly={w.weekly_availability}
        availableNowUntil={w.available_now_until}
        fallbackSummary={workerAvailabilityFallback(w)}
        onDetails={onDetails}
      />
      {workedTogether && (
        <>
          <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="text-xs font-medium text-muted-foreground">Turni svolti</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {completedShifts} {completedShifts === 1 ? "turno completato" : "turni completati"}
            </div>
          </div>
          <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="text-xs font-medium text-muted-foreground">Ultima recensione</div>
            {review ? (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        reviewRating != null && i <= Math.round(reviewRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                  {reviewRating != null && (
                    <span className="ml-1 text-xs tabular-nums font-medium">
                      {reviewRating.toFixed(1)}
                    </span>
                  )}
                </div>
                {reviewCommentShort && (
                  <p className="text-sm text-foreground/90 italic">"{reviewCommentShort}"</p>
                )}
                {reviewDate && (
                  <p className="text-[11px] text-muted-foreground">
                    Recensione del{" "}
                    {reviewDate.toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nessuna recensione disponibile</p>
            )}
          </div>
        </>
      )}
      {(() => {
        // CTA principale: invio nuova proposta per l'annuncio selezionato.
        // - Se esiste già una candidatura attiva per lo stesso annuncio → disabilitato "Proposta già inviata".
        // - Se il lavoratore ha almeno un turno realmente concluso → "Ricontatta gratis".
        // - Altrimenti → "Invia proposta".
        // La vecchia chat (se esiste) resta accessibile come storico tramite link secondario.
        const activeAppForSelected =
          selectedAnnouncementId && r?.activeAppByAnn?.get(selectedAnnouncementId) || null;
        const hardBlocked = !!specialBlock?.blocked;
        const ctaLabel = hardBlocked
          ? "Non disponibile per questo turno"
          : activeAppForSelected
          ? "Proposta già inviata"
          : r?.workedWith
          ? "Ricontatta gratis"
          : "Invia proposta";
        const ctaDisabled = hardBlocked || !!activeAppForSelected || !canSendProposal;
        const ctaTitle = hardBlocked
          ? "Il lavoratore ha indicato una disponibilità speciale non compatibile con questo turno"
          : activeAppForSelected
          ? "Esiste già una proposta attiva per questo annuncio"
          : (blockedReason ?? undefined);
        return (
          <>
            <Button
              size="sm"
              variant="default"
              className="mt-4 w-full gap-1"
              disabled={ctaDisabled}
              onClick={() => {
                if (hardBlocked) return;
                if (activeAppForSelected) {
                  onOpenChat(activeAppForSelected);
                  return;
                }
                onSendProposal();
              }}
              title={ctaTitle}
            >
              {!hardBlocked && r?.workedWith && !activeAppForSelected ? (
                <Gift className="h-3.5 w-3.5" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
              {ctaLabel}
            </Button>
            {hardBlocked && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                <p className="font-medium">Disponibilità speciale in un'altra città / orario</p>
                <p className="mt-0.5">
                  Il lavoratore ha indicato una disponibilità speciale non compatibile con questo turno.
                </p>
                {specialBlock!.specials.slice(0, 3).map((e) => (
                  <p key={e.id} className="mt-0.5">· {describeSpecial(e)}</p>
                ))}
              </div>
            )}
            {appId && !activeAppForSelected && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full gap-1 text-muted-foreground"
                onClick={() => onOpenChat(appId)}
                title="Apre la chat precedente in sola lettura come storico"
              >
                <History className="h-3.5 w-3.5" />
                Apri storico chat
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 w-full gap-1"
              onClick={() => openWorkerProfile({ workerId: w.id, workerName: w.full_name, trigger: "card_button" })}
            >
              <User className="h-3.5 w-3.5" />
              Vedi profilo
            </Button>
            {blockedReason && !activeAppForSelected && !hardBlocked && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                {blockedReason}
              </p>
            )}
          </>
        );
      })()}
    </div>
  );
}

function ProposalConfirmDialog({
  worker,
  announcement,
  defaults,
  rel,
  sending,
  onCancel,
  onConfirm,
}: {
  worker: W | null;
  announcement: Ann | null;
  defaults: { contact_name: string | null; arrival_minutes: number | null; arrival_reason: string | null };
  rel: WorkerRel | undefined;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = !!worker;
  if (!worker) {
    return (
      <Dialog open={false} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <DialogContent />
      </Dialog>
    );
  }
  // Privacy: prima dell'assegnazione mostra solo il nome (no cognome), salvo
  // aver già lavorato insieme.
  const workedTogether = !!rel?.workedWith;
  const displayName = displayWorkerName(worker, workedTogether);
  const ann = announcement;
  const role = ann?.professional_profile?.trim() || "Da definire";
  const start = ann?.service_time ? ann.service_time.slice(0, 5) : null;
  const end = ann?.end_time ? ann.end_time.slice(0, 5) : null;
  const durationRaw = ann?.shift_duration_hours ?? ann?.duration_hours ?? null;
  const duration = durationRaw != null ? Number(durationRaw) : null;
  const tariff = ann?.tariff_amount != null ? Number(ann.tariff_amount) : null;
  const isHourly = ann?.tariff_type === "hourly";
  const totalEstimate = isHourly && tariff != null && Number.isFinite(tariff) && duration != null && Number.isFinite(duration)
    ? tariff * duration
    : null;
  const city = ann?.job_city?.trim() || null;
  const zone = null; // zona dedotta da district del ristoratore — non disponibile in ann
  const dress = (ann?.dress_code_items ?? []).filter(Boolean);
  const dressNotes = ann?.dress_code_notes?.trim() || "";
  const skills = (ann?.required_skills ?? []).filter(Boolean);
  const langs = (ann?.language_requirements ?? []).filter(Boolean);
  const license = ann?.license_requirement?.trim() || "";
  const opNotesParts = [ann?.notes, ann?.job_location_notes, ann?.job_additional_directions]
    .map((s) => (s ?? "").trim()).filter(Boolean);
  const arrivalMin = defaults.arrival_minutes ?? 15;
  const contactName = ann?.job_contact_person_name?.trim() || defaults.contact_name || "";
  // Anteprima del messaggio inviato in chat (privacy: locale = "Ristorante partner")
  const lines: string[] = [];
  lines.push(`Ciao ${displayName}, ti proponiamo un turno come ${role}.`);
  lines.push("");
  lines.push("Dettagli turno:");
  if (ann?.service_date) lines.push(`Data: ${formatDateIT(ann.service_date)}`);
  if (start) lines.push(`Orario: ${start}${end ? " - " + end : ""}`);
  if (duration != null) lines.push(`Durata: ${duration}h`);
  if (city) lines.push(`Zona: ${city}`);
  if (tariff != null) lines.push(`Compenso: ${formatTariff(tariff, ann?.tariff_type ?? null)}`);
  if (totalEstimate != null) lines.push(`Totale stimato: € ${totalEstimate.toFixed(2)}`);
  if (dress.length || dressNotes) {
    lines.push("");
    lines.push(`Dress code: ${[formatDisplayLabels(dress).join(", "), dressNotes].filter(Boolean).join(" — ")}`);
  }
  lines.push("");
  lines.push(`Presentarsi: ${arrivalMin} minuti prima dell'ingresso.`);
  lines.push("");
  lines.push("Vuoi accettare questa proposta?");
  const previewMessage = lines.join("\n");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) onCancel(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invia proposta di lavoro</DialogTitle>
          <DialogDescription>
            Controlla il riepilogo prima di inviare la proposta al lavoratore.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div><span className="text-muted-foreground">Lavoratore:</span> <span className="font-medium">{displayName}</span></div>
            <div><span className="text-muted-foreground">Ruolo:</span> <span className="font-medium">{role}</span></div>
            {ann?.service_date && <div><span className="text-muted-foreground">Data:</span> {formatDateIT(ann.service_date)}</div>}
            {start && <div><span className="text-muted-foreground">Orario:</span> {start}{end ? ` - ${end}` : ""}</div>}
            {duration != null && <div><span className="text-muted-foreground">Durata:</span> {duration}h</div>}
            {city && <div><span className="text-muted-foreground">Città:</span> {city}{ann?.job_province ? ` (${ann.job_province})` : ""}</div>}
            {tariff != null && <div><span className="text-muted-foreground">Compenso:</span> {formatTariff(tariff, ann?.tariff_type ?? null)}</div>}
            {totalEstimate != null && <div><span className="text-muted-foreground">Totale stimato:</span> € {totalEstimate.toFixed(2)}</div>}
            <div><span className="text-muted-foreground">Anticipo all'ingresso:</span> {arrivalMin} minuti{defaults.arrival_reason ? ` (${defaults.arrival_reason})` : ""}</div>
            {contactName && <div><span className="text-muted-foreground">Referente:</span> {contactName}</div>}
          </div>

          {(dress.length > 0 || dressNotes) && (
            <div>
              <div className="font-medium mb-1">Dress code</div>
              {dress.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dress.map((d) => (
                    <span key={d} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">{formatDisplayLabel(d)}</span>
                  ))}
                </div>
              )}
              {dressNotes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{dressNotes}</p>}
            </div>
          )}

          {role && (
            <div>
              <div className="font-medium mb-1">Mansioni</div>
              <p className="text-xs text-muted-foreground">{ann?.professional_profile?.trim() || "Mansioni standard del ruolo."}</p>
            </div>
          )}

          {(skills.length > 0 || langs.length > 0 || license) && (
            <div>
              <div className="font-medium mb-1">Requisiti</div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {skills.map((s) => (
                    <span key={s} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">{formatDisplayLabel(s)}</span>
                  ))}
                </div>
              )}
              {langs.length > 0 && <p className="text-xs text-muted-foreground">Lingue: {formatDisplayLabels(langs).join(", ")}</p>}
              {license && <p className="text-xs text-muted-foreground">Patente: {formatDisplayLabel(license)}</p>}
            </div>
          )}

          {opNotesParts.length > 0 && (
            <div>
              <div className="font-medium mb-1">Note operative</div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{opNotesParts.join("\n\n")}</p>
            </div>
          )}

          <div>
            <div className="font-medium mb-1">Messaggio inviato al lavoratore</div>
            <pre className="rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap font-sans">{previewMessage}</pre>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Per tutelare la privacy, il lavoratore vedrà "Ristorante partner" finché non accetta la proposta.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={sending}>Annulla</Button>
          <Button onClick={onConfirm} disabled={sending}>{sending ? "Invio…" : "Invia proposta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkersMapSection({
  workers,
  fallbackCenter,
  onInvite,
  inviteDisabled,
  inviteLabel,
  rel,
}: {
  workers: W[];
  fallbackCenter: [number, number];
  onInvite: (workerId: string) => void;
  inviteDisabled: boolean;
  inviteLabel: string;
  rel: Record<string, WorkerRel>;
}) {
  const openProfileFromMap = useOpenWorkerProfile();
  // Deduplicazione difensiva per `id` prima di renderizzare i marker.
  // La server function passa coordinate reali quando presenti oppure coordinate
  // approssimative derivate da città/zona salvate dal worker in onboarding.
  const seen = new Set<string>();
  const deduped: W[] = [];
  for (const w of workers) {
    if (!w?.id || seen.has(w.id)) continue;
    seen.add(w.id);
    deduped.push(w);
  }
  // Coordinate priority:
  //  1. service_area_lat/lng (precise, set by worker)
  //  2. lookup approssimato su city/neighborhood (privacy-safe, jitter)
  // Se nessuna delle due è disponibile il worker resta in lista ma NON
  // viene mostrato sulla mappa.
  const coordDebug: Array<Record<string, unknown>> = [];
  const located = deduped
    .map((w) => {
      const coords = getWorkerCoordinates(w);
      const pos: [number, number] | null = coords.hasValidCoordinates && coords.lat != null && coords.lng != null ? [coords.lat, coords.lng] : null;
      coordDebug.push({
        user_id: w.id,
        profile_id: w.id,
        nome: w.full_name,
        ruolo: w.primary_role,
        city: w.location_city ?? w.service_area_city ?? w.city ?? w.residence_city ?? null,
        province: w.location_province ?? w.province ?? w.residence_province ?? null,
        zone: w.location_zone ?? w.service_area_district ?? w.neighborhood ?? null,
        district: w.location_zone ?? w.service_area_district ?? w.neighborhood ?? null,
        radius_km: w.radius_km ?? (w.service_area_radius_m != null ? Math.round(Number(w.service_area_radius_m) / 1000) : null),
        latitude: coords.lat,
        longitude: coords.lng,
        available_days: w.available_days ?? [],
        availability_schedule: w.availability_schedule ?? [],
        tabella_sorgente_dati_posizione: w.location_source ?? "missing",
        tabella_sorgente_dati_disponibilita: w.availability_source ?? "missing",
        hasValidCoordinates: coords.hasValidCoordinates,
        hasApproximateLocation: coords.hasApproximateLocation,
        shownOnMap: pos != null,
        motivo_se_non_mostrato_su_mappa: pos == null ? "nessuna coordinata valida e città/zona non risolvibile" : null,
      });
      return pos ? { w, pos } : null;
    })
    .filter((x): x is { w: W; pos: [number, number] } => x != null);
  console.log("[PUPILLO_WORKER_LOCATION_AVAILABILITY_DEBUG]", coordDebug);
  console.log("[PUPILLO_WORKER_MAP_COORDINATES_FINAL_DEBUG]", coordDebug);
  console.log("[PUPILLO_WORKER_MAP_SOURCE_DEBUG]", {
    selected_view: "mappa",
    source: "Supabase (state `workers`)",
    workers_received: workers.length,
    workers_after_dedup: deduped.length,
    workers_with_valid_coords: located.length,
    workers_rendered_on_map: located.length,
  });
  console.log("[PUPILLO_WORKER_SEARCH_FINAL_RENDER_DEBUG]", {
    worker_renderizzati_in_lista: deduped.length,
    worker_renderizzati_in_mappa: located.length,
    nomi_worker_in_lista: deduped.map((w) => w.full_name),
    nomi_worker_in_mappa: located.map(({ w }) => w.full_name),
  });
  const ids = located.map(({ w }) => w.id);
  const avatars = useAvatarUrls(ids);
  const points: WorkerMapPoint[] = located.map(({ w, pos }) => ({
    id: w.id,
    lat: pos[0],
    lng: pos[1],
    name: displayWorkerName(w, !!rel[w.id]?.workedWith),
    role: w.primary_role,
    city: workerLocationLabel(w),
    rating: w.rating_avg != null && Number(w.rating_avg) > 0 ? Number(w.rating_avg) : null,
    badge: w.badge,
    avatarUrl: avatars[w.id] ?? null,
    initials: initialsOf(displayWorkerName(w, !!rel[w.id]?.workedWith)),
    link: `/workers/${w.id}`,
  }));
  // Center on the average position of located workers so the map frames them.
  const center: [number, number] =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p.lat, 0) / points.length,
          points.reduce((s, p) => s + p.lng, 0) / points.length,
        ]
      : fallbackCenter;
  return (
    <div className="rounded-2xl border bg-card p-2">
      {points.length === 0 ? (
        <div className="flex flex-col items-start gap-1 rounded-xl border border-dashed bg-muted/30 p-6">
          <p className="text-sm font-medium">Nessun lavoratore visualizzabile sulla mappa.</p>
          <p className="text-xs text-muted-foreground">
            Alcuni lavoratori potrebbero non avere ancora indicato la città attuale.
          </p>
        </div>
      ) : (
      <>
      <WorkersMap
        points={points}
        center={center}
        height={480}
        onInvite={onInvite}
        inviteDisabled={inviteDisabled}
        inviteLabel={inviteLabel}
        onViewProfile={(id) => openProfileFromMap({ workerId: id, trigger: "marker_button" })}
      />
      <div className="p-3 text-xs text-muted-foreground">
        {`${points.length} lavorator${points.length === 1 ? "e" : "i"} sulla mappa. La posizione è approssimativa per tutelare la privacy: non vengono mostrati indirizzi privati.`}
      </div>
      </>
      )}
    </div>
  );
}

function AvailabilityBlock({
  rows,
  specialForDate,
  specialDate,
  upcomingSpecials,
  weekly,
  availableNowUntil,
  fallbackSummary,
  onDetails,
}: {
  rows: AvailabilityRow[] | null;
  specialForDate?: AvailabilityExceptionRow[];
  specialDate?: string | null;
  upcomingSpecials?: AvailabilityExceptionRow[];
  weekly: string[] | null;
  availableNowUntil: string | null;
  fallbackSummary?: string | null;
  onDetails: () => void;
}) {
  // Real data lives in `worker_availability`. The legacy
  // `profiles.weekly_availability` array is only a fallback when present.
  const hasReal = !!rows && rows.length > 0;
  const realSummary = summarizeWorkerAvailability(rows, new Date());
  const legacySummary = summarizeWeeklyAvailability(weekly, availableNowUntil, new Date());
  const specials = specialForDate ?? [];
  const hasSpecial = specials.length > 0;
  const specialDateLabel = specialDate
    ? new Date(specialDate + "T00:00:00").toLocaleDateString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      })
    : "";
  // Quando non c'è un annuncio selezionato, mostriamo le prossime
  // disponibilità speciali (fino a 3) per non perdere informazione utile.
  const upcoming = !specialDate
    ? (upcomingSpecials ?? [])
        .slice()
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(0, 3)
    : [];
  const hasUpcoming = upcoming.length > 0;
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
      {hasSpecial && (
        <div className="mb-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Disponibilità speciale · {specialDateLabel}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-foreground">
            {specials.map((e) => {
              if (!e.is_available) {
                return (
                  <div key={e.id} className="text-foreground">
                    Non disponibile in questa data
                  </div>
                );
              }
              const slot = e.time_slot ? SLOT_LABELS[e.time_slot] : null;
              const hours = e.start_time && e.end_time
                ? `${e.start_time.slice(0, 5)} - ${e.end_time.slice(0, 5)}`
                : null;
              const place = [e.city, e.district].filter(Boolean).join(" · ");
              return (
                <div key={e.id}>
                  {[slot, place, hours].filter(Boolean).join(" · ")}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!hasSpecial && hasUpcoming && (
        <div className="mb-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Prossime disponibilità speciali
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-foreground">
            {upcoming.map((e) => {
              const dLabel = new Date(e.date + "T00:00:00").toLocaleDateString("it-IT", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              });
              if (!e.is_available) {
                return (
                  <div key={e.id}>{dLabel} · Non disponibile</div>
                );
              }
              const slot = e.time_slot ? SLOT_LABELS[e.time_slot] : null;
              const hours = e.start_time && e.end_time
                ? `${e.start_time.slice(0, 5)} - ${e.end_time.slice(0, 5)}`
                : null;
              const place = [e.city, e.district].filter(Boolean).join(" · ");
              return (
                <div key={e.id}>
                  {[dLabel, slot, place, hours].filter(Boolean).join(" · ")}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {hasSpecial || hasUpcoming ? "Disponibilità abituale" : "Disponibilità"}
        </div>
        {hasReal && realSummary.kind === "lines" && realSummary.truncated && (
          <button
            type="button"
            onClick={onDetails}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Vedi dettagli
          </button>
        )}
      </div>
      <div className="mt-1 text-xs text-foreground">
        {hasReal && realSummary.kind === "lines" ? (
          <div className="space-y-1">
            {realSummary.lines.map((l, i) => (
              <div key={`${l.days}-${l.hours}-${i}`} className="flex flex-wrap items-center gap-1.5">
                <span className={l.includesToday ? "font-semibold text-foreground" : "font-medium text-foreground"}>
                  {l.days}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground">{l.hours}</span>
                {l.includesToday && (
                  <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Oggi
                  </span>
                )}
              </div>
            ))}
            {realSummary.truncated && (
              <button
                type="button"
                onClick={onDetails}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                + altre {realSummary.extraCount} disponibilità
              </button>
            )}
          </div>
        ) : legacySummary.kind === "none" ? (
          <span className={fallbackSummary ? "text-foreground" : "text-muted-foreground"}>{fallbackSummary ?? "Disponibilità non indicata"}</span>
        ) : null}
        {!hasReal && legacySummary.kind === "today" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-medium">
              Disponibile oggi
            </span>
            {legacySummary.hours && <span className="text-muted-foreground">{legacySummary.hours}</span>}
          </div>
        )}
        {!hasReal && legacySummary.kind === "all_week" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">Tutta la settimana</span>
            {legacySummary.hours && <span className="text-muted-foreground">· {legacySummary.hours}</span>}
          </div>
        )}
        {!hasReal && legacySummary.kind === "wide" && (
          <span className="font-medium">
            {legacySummary.totalDays} giorni disponibili · Disponibilità ampia
          </span>
        )}
        {!hasReal && legacySummary.kind === "lines" && (
          <div className="space-y-0.5">
            {legacySummary.lines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AvailabilityDetailsDialog({
  worker,
  workedTogether,
  onClose,
  rows,
}: {
  worker: W | null;
  workedTogether: boolean;
  onClose: () => void;
  rows: AvailabilityRow[] | null;
}) {
  const open = !!worker;
  // Prefer real availability rows; fall back to the legacy weekly_availability
  // array on the profile if no rows exist for this worker.
  const realDays = rows ? formatWorkerAvailabilityByDay(rows) : [];
  const days = realDays.length > 0
    ? realDays
    : (worker ? formatAvailabilitySlotsForDay(worker.weekly_availability) : []);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disponibilità completa</DialogTitle>
          <DialogDescription>
            {worker ? displayWorkerName(worker, workedTogether) : ""}
          </DialogDescription>
        </DialogHeader>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Disponibilità non indicata.</p>
        ) : (
          <div className="space-y-2">
            {days.map((d) => (
              <div key={d.day} className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="w-12 font-medium">{d.day}</div>
                <div className="flex flex-wrap gap-1.5">
                  {d.slots.map((s) => (
                    <span key={s.label} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {s.label} · {s.hours}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}