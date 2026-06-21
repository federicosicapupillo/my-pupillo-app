import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Locate, MapPin, Coins, Briefcase, Star, AlertTriangle, Info, MapPinOff, Settings2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { geocodeAddressWithRetry } from "@/lib/geocode";
import type { MapPoint } from "@/components/MapViewInner";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { priceRangeLabel } from "@/lib/price-range";
import { ITALIAN_LOCATIONS, citiesForProvince, zonesForCity } from "@/lib/italian-locations";
import { lookupCityCoords, jitterCoords } from "@/lib/italian-city-coords";
import { useAvatarUrls } from "@/hooks/use-avatar-urls";
import { WorkersMap, type WorkerMapPoint } from "@/components/WorkersMap";
// Unified worker profile: opens via the shared modal — no route change, no 404.
import { WorkerProfilePreviewDialog } from "@/components/WorkerProfilePreviewDialog";
import { WorkerRatingSummary } from "@/components/WorkerRatingSummary";
import { displayWorkerName } from "@/lib/worker-display";
import { loadRestaurantWorkerSearchResults } from "@/lib/worker-search.functions";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { workerMatchesAnyRoleField, normalizeRole, collectWorkerRoleValues, collectWorkerCompetenceValues } from "@/lib/worker-role-normalization";
import { summarizeWeeklyAvailability } from "@/lib/availability-summary";
import { formatWorkerAvailabilityCardLine } from "@/lib/worker-availability-summary";
import type { AvailabilityRow } from "@/lib/availability";
import {
  readKnownRestaurantsCache,
  writeKnownRestaurantsCache,
} from "@/lib/known-restaurants-cache";

const MapViewInner = lazy(() => import("@/components/MapViewInner"));

// --- Worker map helpers --------------------------------------------------
// Used to ensure that, on the worker-side map, only announcements/restaurants
// belonging to a city the worker actually targets are shown, AND that markers
// are placed approximately on that city (never on a different city because of
// a stale/wrong precise coordinate in the restaurant profile).
function normalizeCity(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`]/g, " ")
    .trim();
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const Route = createFileRoute("/mappa")({
  head: () => ({ meta: [{ title: "Mappa — Pupillo" }] }),
  component: () => <RequireAuth><MapPage /></RequireAuth>,
});

type Restaurant = {
  id: string;
  business_name: string | null;
  full_name: string | null;
  venue_type: string | null;
  venue_type_other?: string | null;
  price_range: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  latitude: number | null;
  longitude: number | null;
  contact_person_first_name: string | null;
  contact_person_last_name: string | null;
  contact_person_role: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  account_status: string | null;
  plan: string | null;
  credits: number | null;
  rating_avg: number | null;
};

type Worker = {
  id: string;
  full_name: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  user_roles?: string[];
  role_is_worker?: boolean;
  role_is_admin?: boolean;
  role_is_restaurant?: boolean;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  is_demo?: boolean | null;
  seed_batch_id?: string | null;
  is_active?: boolean;
  is_visible?: boolean;
  coordinate_source?: "profile_service_area" | "profile_location" | "worker_availability" | "approximate_city_zone" | "missing";
  location_city?: string | null;
  location_zone?: string | null;
  location_province?: string | null;
  radius_km?: number | null;
  available_days?: string[];
  availability_schedule?: string[];
  location_source?: "profiles.service_area" | "worker_availability" | "profiles.residence" | "profiles.city" | "missing";
  availability_source?: "worker_availability" | "profiles.weekly_availability" | "profiles.available_now_until" | "missing";
  map_lat?: number | null;
  map_lng?: number | null;
  has_valid_coordinates?: boolean;
  has_approximate_location?: boolean;
  shown_on_map?: boolean;
  city: string | null;
  neighborhood: string | null;
  province?: string | null;
  service_area_city?: string | null;
  service_area_district?: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  latitude?: number | null;
  longitude?: number | null;
  badge: string | null;
  rating_avg: number | null;
  reviews_count?: number | null;
  reliability_pct: number | null;
  completed_shifts: number | null;
  hourly_rate: number | null;
  experience_level: string | null;
  weekly_availability: string[] | null;
  account_status: string | null;
  punctuality_pct?: number | null;
  avg_professionalism?: number | null;
  hourly_availability?: string | null;
  available_now_until?: string | null;
  work_area_mode?: string | null;
  all_zones?: boolean | null;
  selected_zones?: string[] | null;
};

function normalizeWorkerRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isRealWorker(profile: Worker): boolean {
  const roles = (profile.user_roles ?? []).map(normalizeWorkerRole);
  const primary = normalizeWorkerRole(profile.primary_role);
  const finalRole = roles.includes("worker") || profile.role_is_worker === true ? "worker" : primary;
  const blocked = roles.includes("admin") || roles.includes("restaurant") || ["admin", "restaurant", "ristoratore"].includes(primary) || profile.role_is_admin === true || profile.role_is_restaurant === true;
  return finalRole === "worker" && !blocked && profile.is_deleted !== true && !profile.deleted_at && profile.is_demo !== true && !profile.seed_batch_id && profile.is_active !== false && profile.is_visible !== false;
}

function nonWorkerReason(profile: Worker): string {
  const roles = (profile.user_roles ?? []).map(normalizeWorkerRole);
  const primary = normalizeWorkerRole(profile.primary_role);
  if (roles.includes("admin") || primary === "admin" || profile.role_is_admin) return "ruolo_admin";
  if (roles.includes("restaurant") || ["restaurant", "ristoratore"].includes(primary) || profile.role_is_restaurant) return "ruolo_restaurant";
  if (!roles.includes("worker") && profile.role_is_worker !== true) return "senza_ruolo_worker";
  return "non_idoneo";
}

function getWorkerCoordinates(profile: Worker) {
  const lat = profile.map_lat ?? profile.service_area_lat ?? profile.latitude ?? null;
  const lng = profile.map_lng ?? profile.service_area_lng ?? profile.longitude ?? null;
  const hasValidCoordinates = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const hasApproximateLocation = profile.has_approximate_location === true || (!!hasValidCoordinates && profile.coordinate_source === "approximate_city_zone");
  return { lat: hasValidCoordinates ? Number(lat) : null, lng: hasValidCoordinates ? Number(lng) : null, hasValidCoordinates, hasApproximateLocation, shownOnMap: hasValidCoordinates };
}

function workerLocationLabel(profile: Worker): string {
  const city = (profile.location_city || profile.service_area_city || profile.city || "").trim();
  const zone = (profile.location_zone || profile.service_area_district || profile.neighborhood || "").trim();
  const province = (profile.location_province || profile.province || "").trim();
  if (city && zone) return `${city} · ${zone}`;
  if (city && province) return `${city} · ${province}`;
  if (city) return city;
  if (zone) return zone;
  if (province) return province;
  return "Posizione non indicata";
}

function normalizeLocation(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function workerCityCandidates(w: Worker): string[] {
  return [
    w.location_city,
    w.service_area_city,
    w.city,
    (w as any).residence_city,
    w.location_province,
    w.province,
  ]
    .map(normalizeLocation)
    .filter(Boolean);
}

function workerZoneCandidates(w: Worker): string[] {
  const zones: string[] = [
    w.location_zone,
    w.service_area_district,
    w.neighborhood,
    ...(((w as any).selected_zones as string[] | undefined) ?? []),
  ].map(normalizeLocation).filter(Boolean);
  if ((w as any).all_zones) zones.push("tutte le zone");
  return zones;
}

type Ann = {
  id: string;
  professional_profile: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  job_latitude: number | null;
  job_longitude: number | null;
  job_address: string | null;
  job_contact_person_name: string | null;
  job_contact_person_phone: string | null;
  job_contact_person_email: string | null;
  status: string | null;
  restaurant_id: string;
  service_date?: string | null;
  service_time?: string | null;
  duration_hours?: number | null;
  tariff_amount?: number | null;
  tariff_type?: string | null;
  notes?: string | null;
  required_skills?: string[] | null;
  dress_code_items?: string[] | null;
  language_requirements?: string[] | null;
};

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const MASKED_LABELS = [
  "Ristorante partner",
  "Locale verificato",
  "Ristorante in zona",
  "Nome visibile dopo conferma",
];

function pickMaskedRestaurantLabel(seed: string, hasActive: boolean): string {
  if (!hasActive) return "Locale verificato";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MASKED_LABELS[h % MASKED_LABELS.length];
}

function maskedZoneLabel(r: { neighborhood?: string | null; city?: string | null }): string {
  const zone = [r.neighborhood, r.city].filter(Boolean).join(" · ");
  if (zone) return zone;
  if (r.city) return r.city;
  return "Zona non specificata";
}

// Map normalized role key -> canonical display label from WORKER_ROLES.
const ROLE_DISPLAY_BY_NORMALIZED: Record<string, string> = WORKER_ROLES.reduce(
  (acc, label) => {
    const key = normalizeRole(label);
    if (key) acc[key] = label;
    return acc;
  },
  {} as Record<string, string>,
);

function toDisplayRole(value: string): string {
  const key = normalizeRole(value);
  if (!key) return value.trim();
  if (ROLE_DISPLAY_BY_NORMALIZED[key]) return ROLE_DISPLAY_BY_NORMALIZED[key];
  // Title-case fallback for unknown roles
  return key
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Collect professional roles for a worker, primary first then secondaries/competences,
 * deduplicated by normalized role. Account roles (worker/restaurant/admin) are filtered.
 */
function workerProfessionalRoles(w: Worker): string[] {
  const ACCOUNT_ROLES = new Set(["worker", "restaurant", "ristoratore", "admin"]);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushRaw = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const part of String(raw).split(/[,;|\n•·]+/g)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const key = normalizeRole(trimmed);
      if (!key || ACCOUNT_ROLES.has(key) || seen.has(key)) continue;
      seen.add(key);
      ordered.push(toDisplayRole(trimmed));
    }
  };
  pushRaw(w.primary_role);
  for (const s of w.secondary_roles ?? []) pushRaw(s);
  for (const s of ((w as any).default_required_skills as string[] | undefined) ?? []) pushRaw(s);
  return ordered;
}

function formatRolesForCard(roles: string[], max = 3): string {
  if (roles.length === 0) return "—";
  if (roles.length <= max) return roles.join(" · ");
  return `${roles.slice(0, max).join(" · ")} · +${roles.length - max}`;
}

const DAY_FULL_LABEL: Record<string, string> = {
  lun: "lunedì", mar: "martedì", mer: "mercoledì", gio: "giovedì",
  ven: "venerdì", sab: "sabato", dom: "domenica",
};

function formatWorkerAvailabilityLine(w: Worker, rows?: AvailabilityRow[] | null): string {
  // 1) Sorgente di verità: tabella worker_availability (stessa usata dal
  // profilo dettaglio). Se ci sono righe, riusiamo lo stesso summarizer.
  if (rows && rows.length > 0) {
    const cardLine = formatWorkerAvailabilityCardLine(rows, new Date());
    if (cardLine) return cardLine;
  }
  // 2) Fallback legacy: profiles.weekly_availability + available_now_until.
  const weekly = w.weekly_availability ?? [];
  const summary = summarizeWeeklyAvailability(weekly, (w as any).available_now_until ?? null);

  const hasAreaAvailability =
    !!w.work_area_mode ||
    w.all_zones === true ||
    (Array.isArray(w.selected_zones) && w.selected_zones.length > 0) ||
    !!w.service_area_city ||
    !!w.service_area_district ||
    (w.available_days && w.available_days.length > 0) ||
    (w.availability_schedule && w.availability_schedule.length > 0) ||
    !!w.hourly_availability ||
    !!w.available_now_until ||
    (w.availability_source && w.availability_source !== "missing");

  switch (summary.kind) {
    case "none": {
      if (hasAreaAvailability) {
        const city = w.service_area_city ?? w.location_city ?? w.city;
        const zone = w.all_zones
          ? "Tutte le zone"
          : (w.service_area_district ?? w.location_zone ?? w.neighborhood);
        if (city || zone) {
          return `Disponibile su ${[city, zone].filter(Boolean).join(" · ")}`;
        }
        return "Disponibilità impostata";
      }
      return "Nessuna disponibilità indicata";
    }
    case "today":
      return summary.hours ? `Disponibile oggi · ${summary.hours}` : "Disponibile oggi";
    case "all_week":
      return summary.hours ? `Tutta la settimana · ${summary.hours}` : "Tutta la settimana";
    case "wide":
      return `Disponibilità impostata (${summary.totalDays} giorni/settimana)`;
    case "lines": {
      // Try to extract the unique days from weekly tokens for a friendly label.
      const days = new Set<string>();
      for (const t of weekly) {
        const d = String(t).toLowerCase().split("_")[0];
        if (d && DAY_FULL_LABEL[d]) days.add(d);
      }
      if (days.size > 0 && days.size <= 4) {
        const order = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
        const labels = order.filter((d) => days.has(d)).map((d) => DAY_FULL_LABEL[d]);
        return `Disponibile: ${labels.join(", ")}`;
      }
      return summary.lines[0] ? `Disponibile: ${summary.lines[0]}` : "Disponibilità impostata";
    }
  }
}

function MapPage() {
  const { user, role } = useAuth();
  const loadWorkerSearchData = useServerFn(loadRestaurantWorkerSearchResults);
  const isRestaurant = role === "restaurant";
  const isWorker = role === "worker";
  const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;
  const debugEnabled = role === "admin" || isDev;
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [availByWorker, setAvailByWorker] = useState<Record<string, AvailabilityRow[]>>({});
  const [anns, setAnns] = useState<Ann[]>([]);
  const [annCounts, setAnnCounts] = useState<Record<string, number>>({});
  // applicationStatus per announcement_id, solo per il lavoratore loggato
  const [appStatusByAnn, setAppStatusByAnn] = useState<Record<string, string>>({});
  // Ristoranti con cui il lavoratore loggato ha già lavorato (almeno un turno
  // o una candidatura accettata). Per questi il nome del locale è visibile
  // anche prima di una nuova conferma.
  const [knownRestaurantIds, setKnownRestaurantIds] = useState<Set<string>>(new Set());
  // Worker_ids con cui il ristoratore loggato ha una candidatura accettata o
  // un turno confermato: per questi mostriamo nome e cognome completi.
  const [knownWorkerIds, setKnownWorkerIds] = useState<Set<string>>(new Set());
  // Ultima recensione pubblicata dal ristoratore loggato per ciascun worker
  // già collaborato. Usata nel popup della mappa.
  const [lastReviewByWorker, setLastReviewByWorker] = useState<
    Record<string, { comment: string | null; rating: number | null }>
  >({});
  const [loading, setLoading] = useState(true);
  // Città consentite per la mappa lato lavoratore. Se non viene impostato un
  // filtro città manuale, si calcolano da: città del profilo lavoratore,
  // service_area_city, e disponibilità speciali future (data >= oggi). La
  // disponibilità speciale prevale sulla disponibilità abituale anche qui.
  const [workerBaseAllowedCities, setWorkerBaseAllowedCities] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // search & filters
  const [city, setCity] = useState("any");
  const [province, setProvince] = useState("any");
  const [district, setDistrict] = useState("");
  const [withRequests, setWithRequests] = useState(false);
  const [showR, setShowR] = useState(true);
  const [showW, setShowW] = useState(true);
  const [showA, setShowA] = useState(true);

  // worker filters
  const [wRole, setWRole] = useState("any");
  const [wBadge, setWBadge] = useState("any");
  const [wMinRating, setWMinRating] = useState("any");
  const [wMinReliab, setWMinReliab] = useState("any");
  const [wExp, setWExp] = useState("any");
  const [view, setView] = useState<"restaurants" | "workers">("restaurants");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isMobile = useIsMobile();
  const [mapActive, setMapActive] = useState(false);
  useEffect(() => { if (!isMobile) setMapActive(true); else setMapActive(false); }, [isMobile]);

  // For restaurant accounts: never display other restaurants on the map
  useEffect(() => {
    if (isRestaurant) {
      setShowR(false);
      setView("workers");
    }
  }, [isRestaurant]);

  // For worker accounts: never display other workers on the map and never
  // show other workers. I marker dei ristoranti restano visibili (con
  // privacy applicata sul nome) così il lavoratore può vedere tutti i
  // locali in piattaforma, oltre alle richieste attive.
  useEffect(() => {
    if (isWorker) {
      setShowW(false);
      setShowR(true);
      setShowA(true);
      setView("restaurants");
    }
  }, [isWorker]);

  // location
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>("any");
  const [locating, setLocating] = useState(false);
  const [focusZoom, setFocusZoom] = useState<number | undefined>(undefined);
  const mapBoxRef = useRef<HTMLDivElement | null>(null);
  const [focusWorkerId, setFocusWorkerId] = useState<string | null>(null);
  const [focusWorkerNonce, setFocusWorkerNonce] = useState(0);
  const [profileModalWorkerId, setProfileModalWorkerId] = useState<string | null>(null);
  const openWorkerProfile = (
    workerId: string,
    source: "lista_mappa" | "marker_mappa" | "foto_candidato",
    workerName?: string | null,
  ) => {
    if (typeof console !== "undefined") {
      console.log("[PUPILLO_WORKER_PROFILE_MODAL_OPEN_DEBUG]", {
        pagina_origine: "mappa",
        trigger: source === "lista_mappa" ? "card_button" : source === "foto_candidato" ? "avatar_button" : "marker_button",
        worker_user_id: workerId,
        profile_id: workerId,
        nome_lavoratore: workerName ?? null,
        popup_aperto: true,
      });
    }
    setProfileModalWorkerId(workerId);
  };

  const focusWorkerOnMap = (workerId: string) => {
    const located = locatedWorkers.find((x) => x.w.id === workerId);
    if (!located) {
      toast.error("Posizione non disponibile per questo lavoratore.");
      return;
    }
    setFocusWorkerId(workerId);
    setFocusWorkerNonce((n) => n + 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() =>
        mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const focusOnMap = (lat: number, lng: number, label?: string) => {
    setSearchCenter({ lat, lng, label });
    setFocusZoom(15);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const workerSource = isRestaurant ? "Supabase server function loadRestaurantWorkerSearchResults" : "Supabase direct profiles query";
      const workerPromise = isRestaurant
        ? loadWorkerSearchData({ data: { reason: "mappa_restaurant_workers" } }).then((res) => ({ data: res.workers, error: null }))
        : supabase
            .from("profiles")
            .select("id, full_name, primary_role, secondary_roles, city, neighborhood, service_area_city, service_area_district, service_area_lat, service_area_lng, badge, rating_avg, reviews_count, reliability_pct, completed_shifts, hourly_rate, experience_level, weekly_availability, hourly_availability, available_now_until, work_area_mode, all_zones, selected_zones, account_status, business_name, punctuality_pct, avg_professionalism")
            .is("business_name", null)
            .not("primary_role", "is", null)
            .limit(2000);
      const [{ data: r }, workerResult, { data: a }] = await Promise.all([
        supabase.from("profiles")
          .select("id, business_name, full_name, venue_type, venue_type_other, price_range, address, city, province, neighborhood, service_area_lat, service_area_lng, latitude, longitude, contact_person_first_name, contact_person_last_name, contact_person_role, contact_person_phone, contact_person_email, account_status, plan, credits, rating_avg")
          .or("primary_role.eq.restaurant,business_name.not.is.null")
          .limit(1000),
        workerPromise,
        // PII-safe view: contact name/phone/email and precise job_latitude/
        // job_longitude/job_address are intentionally not selected here.
        // Workers with an accepted application read those via the base table
        // (allowed by RLS) elsewhere in the app.
        (supabase as any).from("announcements_public")
          .select("id, professional_profile, location_address, location_lat, location_lng, status, restaurant_id, service_date, service_time, duration_hours, tariff_amount, tariff_type, notes, required_skills, dress_code_items, language_requirements")
          .eq("status", "active")
          .limit(1000),
      ]);
      setRestaurants((r as Restaurant[]) || []);
      const workerError = "error" in workerResult ? workerResult.error : null;
      if (workerError) console.warn("[mappa] worker load error", workerError);
      const workersReceived = (((workerResult as any).data as any[]) || []) as Worker[];
      const blockedWorkers: Array<{ user_id: string; nome: string | null; primary_role: string | null; user_roles: string[]; motivo: string }> = [];
      const dedupedWorkers = new Map<string, Worker>();
      for (const candidate of workersReceived) {
        if (isRestaurant && !isRealWorker(candidate)) {
          const blocked = {
            user_id: candidate.id,
            nome: candidate.full_name,
            primary_role: candidate.primary_role,
            user_roles: candidate.user_roles ?? [],
            motivo: nonWorkerReason(candidate),
          };
          blockedWorkers.push(blocked);
          console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", { componente: "src/routes/mappa.tsx", ...blocked });
          continue;
        }
        if (!dedupedWorkers.has(candidate.id)) dedupedWorkers.set(candidate.id, candidate);
      }
      const wsRaw = Array.from(dedupedWorkers.values());
      console.log("[PUPILLO_WORKER_RENDER_SOURCE_FINAL_DEBUG]", {
        componente: "src/routes/mappa.tsx",
        source_dati_usata: workerSource,
        numero_profili_ricevuti_prima_del_filtro_ruolo: workersReceived.length,
        numero_profili_con_ruolo_worker: workersReceived.filter((w) => (w.user_roles ?? []).map(normalizeWorkerRole).includes("worker") || w.role_is_worker === true).length,
        numero_profili_esclusi_perche_admin: blockedWorkers.filter((w) => w.motivo === "ruolo_admin").length,
        numero_profili_esclusi_perche_restaurant: blockedWorkers.filter((w) => w.motivo === "ruolo_restaurant").length,
        numero_profili_esclusi_perche_senza_ruolo: blockedWorkers.filter((w) => w.motivo === "senza_ruolo_worker").length,
        array_finale_renderizzato: wsRaw.map((w) => ({ user_id: w.id, nome: w.full_name, ruolo: w.primary_role, user_roles: w.user_roles ?? [] })),
      });
      setWorkers(wsRaw);
      // Carica le disponibilità reali dalla tabella worker_availability
      // (stessa fonte usata dalla pagina /workers e dal profilo dettaglio).
      // Il campo profiles.weekly_availability è legacy e spesso vuoto.
      const workerIds = wsRaw.map((w) => w.id);
      if (workerIds.length > 0) {
        const { data: avRows, error: avErr } = await supabase
          .from("worker_availability")
          .select("id, worker_id, day_of_week, time_slot, start_time, end_time, is_flexible, is_last_minute, notes, city, province, district, latitude, longitude, radius_km")
          .in("worker_id", workerIds);
        if (avErr) {
          console.warn("[mappa] worker_availability load error", avErr);
        } else {
          const map: Record<string, AvailabilityRow[]> = {};
          for (const row of (avRows as AvailabilityRow[] | null) ?? []) {
            const arr = map[row.worker_id] ?? [];
            arr.push(row);
            map[row.worker_id] = arr;
          }
          setAvailByWorker(map);
        }
      } else {
        setAvailByWorker({});
      }
      setAnns((a as Ann[]) || []);
      const counts: Record<string, number> = {};
      (a || []).forEach((x: any) => { counts[x.restaurant_id] = (counts[x.restaurant_id] || 0) + 1; });
      setAnnCounts(counts);
      // Carica lo stato delle candidature del lavoratore loggato per la privacy del popup
      if (user && isWorker) {
        const { data: apps } = await supabase
          .from("applications")
          .select("announcement_id, status")
          .eq("worker_id", user.id);
        const m: Record<string, string> = {};
        (apps || []).forEach((x: any) => { m[x.announcement_id] = x.status; });
        setAppStatusByAnn(m);

        // Calcola l'insieme delle città consentite per la mappa lato
        // lavoratore: città del profilo + service_area_city + città delle
        // disponibilità speciali future. La disponibilità speciale prevale
        // sulla disponibilità abituale (rule 17/18).
        const [{ data: meProfile }, { data: exc }] = await Promise.all([
          supabase
            .from("profiles")
            .select("city, service_area_city, neighborhood, service_area_district")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("worker_availability_exceptions")
            .select("city, date, is_available")
            .eq("worker_id", user.id)
            .gte("date", todayIso()),
        ]);
        const allowed = new Set<string>();
        const profCity = normalizeCity((meProfile as any)?.city);
        const profServiceCity = normalizeCity((meProfile as any)?.service_area_city);
        if (profCity) allowed.add(profCity);
        if (profServiceCity) allowed.add(profServiceCity);
        for (const e of (exc || []) as any[]) {
          if (e?.is_available && e?.city) {
            const c = normalizeCity(e.city);
            if (c) allowed.add(c);
          }
        }
        setWorkerBaseAllowedCities(allowed);
        if (typeof window !== "undefined") {
          console.debug("[mappa] worker allowed cities (base):", Array.from(allowed));
        }

        // Ristoranti "conosciuti": turni effettuati o candidature accettate.
        // Per ridurre il carico sul DB usiamo una cache locale con TTL: se
        // presente la usiamo subito, altrimenti la popoliamo in background.
        // Le candidature accettate trovate sopra sono già fonte di verità.
        const fromApps = new Set<string>();
        (apps || []).forEach((x: any) => {
          if (x.status === "accepted") {
            // application.restaurant_id non è in questa proiezione; cadiamo
            // nella query completa qui sotto.
          }
        });
        const cached = readKnownRestaurantsCache(user.id);
        if (cached) {
          // Unione con eventuali nuovi accepted di questa sessione (vuoto qui).
          setKnownRestaurantIds(new Set([...cached, ...fromApps]));
        } else {
          const [{ data: myShifts }, { data: acceptedApps }] = await Promise.all([
            supabase.from("shifts").select("restaurant_id").eq("worker_id", user.id),
            supabase.from("applications").select("restaurant_id").eq("worker_id", user.id).eq("status", "accepted"),
          ]);
          const known = new Set<string>();
          (myShifts || []).forEach((x: any) => x.restaurant_id && known.add(x.restaurant_id));
          (acceptedApps || []).forEach((x: any) => x.restaurant_id && known.add(x.restaurant_id));
          setKnownRestaurantIds(known);
          writeKnownRestaurantsCache(user.id, known);
        }
      } else {
        setAppStatusByAnn({});
        setKnownRestaurantIds(new Set());
        setWorkerBaseAllowedCities(new Set());
      }
      // Per il ristoratore loggato: insieme di worker_ids "confermati"
      // (candidatura accettata o turno assegnato) per cui possiamo mostrare
      // nome e cognome completi sulla mappa.
      if (user && isRestaurant) {
        // Privacy: il ristoratore può vedere Nome e Cognome del lavoratore
        // SOLO se ha già completato almeno un turno con lui. Candidature
        // accettate o turni semplicemente programmati non bastano.
        const { data: myShifts } = await supabase
          .from("shifts")
          .select("worker_id")
          .eq("restaurant_id", user.id)
          .eq("status", "completed");
        const known = new Set<string>();
        (myShifts || []).forEach((x: any) => x.worker_id && known.add(x.worker_id));
        setKnownWorkerIds(known);
        // Ultima recensione (visibile ai ristoratori) per ciascun lavoratore
        // con cui c'è stato un turno completato.
        if (known.size > 0) {
          const { data: revs } = await supabase
            .from("reviews")
            .select("target_id, comment, rating, created_at")
            .in("target_id", Array.from(known))
            .eq("is_visible_to_restaurants", true)
            .order("created_at", { ascending: false })
            .limit(500);
          const map: Record<string, { comment: string | null; rating: number | null }> = {};
          for (const r of (revs || []) as any[]) {
            if (!map[r.target_id]) {
              map[r.target_id] = { comment: r.comment ?? null, rating: r.rating ?? null };
            }
          }
          setLastReviewByWorker(map);
        } else {
          setLastReviewByWorker({});
        }
      } else {
        setKnownWorkerIds(new Set());
        setLastReviewByWorker({});
      }
      setLoading(false);
    })();
  }, [user?.id, isWorker, isRestaurant]);

  const cities = useMemo(() => Array.from(new Set(restaurants.map(r => r.city).filter(Boolean))) as string[], [restaurants]);
  // Centralised list of HoReCa roles for the role filter dropdown.
  // MUST NOT be derived from currently loaded workers (otherwise the dropdown
  // shrinks to whichever roles happen to exist, e.g. only "Cameriere").
  const workerRoles = useMemo(() => [...WORKER_ROLES] as string[], []);

  // [PUPILLO_MAP_ROLE_DROPDOWN_SOURCE_DEBUG]
  useEffect(() => {
    console.log("[PUPILLO_MAP_ROLE_DROPDOWN_SOURCE_DEBUG]", {
      file_sorgente_ruoli: "src/lib/worker-roles.ts (WORKER_ROLES)",
      lista_ruoli_dropdown: ["Tutti i ruoli", ...workerRoles],
      numero_ruoli_mostrati: workerRoles.length + 1,
      fonte: "costante centrale (NON derivata dai worker caricati)",
    });
  }, [workerRoles]);

  // Insieme effettivo delle città consentite per la mappa lato lavoratore.
  // Comportamento richiesto: per default il lavoratore vede TUTTI gli annunci
  // attivi in Italia (rule 1, 20). Solo quando seleziona esplicitamente una
  // città dal filtro, la mappa viene ristretta a quella città (rule 22-24).
  // Null = nessun vincolo.
  const workerAllowedCities = useMemo<Set<string> | null>(() => {
    if (!isWorker) return null;
    if (city !== "any") return new Set([normalizeCity(city)]);
    // Default lato lavoratore: nessun vincolo, mostra tutta Italia.
    return null;
  }, [isWorker, city]);

  const isWorkerCityAllowed = (c: string | null | undefined) => {
    if (!workerAllowedCities) return true;
    if (workerAllowedCities.size === 0) return true; // nessuna preferenza: non bloccare tutto
    return workerAllowedCities.has(normalizeCity(c));
  };

  const filteredWorkers = useMemo(() => {
    const max = radiusKm !== "any" ? Number(radiusKm) : null;
    const ref = searchCenter || me;
    return workers.filter(w => {
      if (isRestaurant && !isRealWorker(w)) {
        console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", { componente: "src/routes/mappa.tsx filteredWorkers", worker: w, motivo: nonWorkerReason(w) });
        return false;
      }
      if (city !== "any") {
        const target = normalizeLocation(city);
        const cands = workerCityCandidates(w);
        if (!cands.some((c) => c === target || c.includes(target) || target.includes(c))) return false;
      }
      if (district) {
        const target = normalizeLocation(district);
        const zCands = workerZoneCandidates(w);
        // "tutte le zone" worker matches any specific zone in his city
        if (!(zCands.includes("tutte le zone") || zCands.some((z) => z.includes(target) || target.includes(z)))) return false;
      }
      if (wRole !== "any" && !workerMatchesAnyRoleField(w as any, wRole)) return false;
      if (wBadge !== "any" && w.badge !== wBadge) return false;
      if (wExp !== "any" && w.experience_level !== wExp) return false;
      if (wMinRating !== "any" && Number(w.rating_avg || 0) < Number(wMinRating)) return false;
      if (wMinReliab !== "any") {
        // New / under-evaluation profiles (< 3 completed shifts) are
        // excluded from "minimum reliability" filters because their
        // raw reliability_pct value isn't statistically meaningful yet.
        const completed = Number(w.completed_shifts ?? 0);
        if (completed < 3) return false;
        if (Number(w.reliability_pct || 0) < Number(wMinReliab)) return false;
      }
      const coords = getWorkerCoordinates(w);
      if (max != null && ref && coords.hasValidCoordinates && coords.lat != null && coords.lng != null) {
        if (distKm(ref.lat, ref.lng, coords.lat, coords.lng) > max) return false;
      }
      return true;
    });
  }, [workers, city, district, wRole, wBadge, wExp, wMinRating, wMinReliab, radiusKm, searchCenter, me]);

  useEffect(() => {
    if (!isRestaurant) return;
    console.log("[PUPILLO_WORKER_RENDER_SOURCE_FINAL_DEBUG]", {
      componente: "src/routes/mappa.tsx",
      source_dati_usata: "Supabase server function loadRestaurantWorkerSearchResults -> state workers -> filteredWorkers",
      numero_profili_ricevuti_prima_del_filtro_ruolo: workers.length,
      numero_profili_con_ruolo_worker: workers.filter((w) => (w.user_roles ?? []).map(normalizeWorkerRole).includes("worker") || w.role_is_worker === true).length,
      numero_profili_esclusi_perche_admin: workers.filter((w) => nonWorkerReason(w) === "ruolo_admin").length,
      numero_profili_esclusi_perche_restaurant: workers.filter((w) => nonWorkerReason(w) === "ruolo_restaurant").length,
      numero_profili_esclusi_perche_senza_ruolo: workers.filter((w) => nonWorkerReason(w) === "senza_ruolo_worker").length,
      array_finale_renderizzato: filteredWorkers.map((w) => ({ user_id: w.id, nome: w.full_name, ruolo: w.primary_role, user_roles: w.user_roles ?? [] })),
    });
  }, [isRestaurant, workers, filteredWorkers]);

  useEffect(() => {
    if (!isRestaurant) return;
    const realWorkers = workers.filter(isRealWorker);
    const targetNorm = wRole === "any" ? null : normalizeRole(wRole);
    const perWorker = realWorkers.map((w) => {
      const rawRoles = collectWorkerRoleValues(w as any);
      const rawSkills = collectWorkerCompetenceValues(w as any);
      const normalizedRoles = [...rawRoles, ...rawSkills].map(normalizeRole);
      const matches = targetNorm == null ? true : normalizedRoles.includes(targetNorm);
      return { user_id: w.id, nome: w.full_name, primary_role: w.primary_role, secondary_roles: w.secondary_roles, raw_roles: rawRoles, normalized_roles: normalizedRoles, matches };
    });
    console.log("[PUPILLO_MAP_ROLE_FILTER_DEBUG]", {
      componente: "src/routes/mappa.tsx",
      selectedRole: wRole,
      selectedRoleNormalized: targetNorm,
      dropdown_ruoli_disponibili: workerRoles,
      totale_worker_prima_filtro_ruolo: realWorkers.length,
      totale_worker_dopo_filtro_ruolo: perWorker.filter((p) => p.matches).length,
      worker_esclusi_per_ruolo: perWorker.filter((p) => !p.matches),
    });
    console.log("[PUPILLO_WORKER_ROLE_SOURCE_DEBUG]", {
      componente: "src/routes/mappa.tsx",
      per_worker: perWorker,
    });
  }, [isRestaurant, workers, wRole, workerRoles]);

  useEffect(() => {
    if (!isRestaurant) return;
    const target = city === "any" ? "" : normalizeLocation(city);
    const zoneTarget = normalizeLocation(district);
    const afterRole = workers.filter((w) => isRealWorker(w));
    const afterCity = afterRole.filter((w) => {
      if (!target) return true;
      const cands = workerCityCandidates(w);
      return cands.some((c) => c === target || c.includes(target) || target.includes(c));
    });
    const afterZone = afterCity.filter((w) => {
      if (!zoneTarget) return true;
      const z = workerZoneCandidates(w);
      return z.includes("tutte le zone") || z.some((x) => x.includes(zoneTarget) || zoneTarget.includes(x));
    });
    const exclusions = afterRole
      .filter((w) => !filteredWorkers.find((f) => f.id === w.id))
      .map((w) => {
        const cands = workerCityCandidates(w);
        const z = workerZoneCandidates(w);
        const cityOk = !target || cands.some((c) => c === target || c.includes(target) || target.includes(c));
        const zoneOk = !zoneTarget || z.includes("tutte le zone") || z.some((x) => x.includes(zoneTarget) || zoneTarget.includes(x));
        return { id: w.id, nome: w.full_name, motivo: !cityOk ? "citta_non_corrisponde" : !zoneOk ? "zona_non_corrisponde" : "altro_filtro", cityCandidates: cands, zoneCandidates: z };
      });
    console.log("[PUPILLO_MAP_FILTER_RESULTS_DEBUG]", {
      selectedCity: city,
      selectedZone: district || "Tutte le zone",
      normalizedSelectedCity: target,
      normalizedSelectedZone: zoneTarget,
      totale_worker_prima_filtri: workers.length,
      totale_worker_dopo_filtro_ruolo: afterRole.length,
      totale_worker_dopo_filtro_citta: afterCity.length,
      totale_worker_dopo_filtro_zona: afterZone.length,
      totale_worker_finali_lista: filteredWorkers.length,
      totale_worker_finali_mappa: filteredWorkers.filter((w) => getWorkerCoordinates(w).hasValidCoordinates).length,
      esclusioni: exclusions,
    });

    const nikla = workers.find((w) => (w.full_name || "").toLowerCase().includes("nikla"));
    if (nikla) {
      const cityCands = workerCityCandidates(nikla);
      const zoneCands = workerZoneCandidates(nikla);
      const cityMatch = !target || cityCands.some((c) => c === target || c.includes(target) || target.includes(c));
      const zoneMatch = !zoneTarget || zoneCands.includes("tutte le zone") || zoneCands.some((x) => x.includes(zoneTarget) || zoneTarget.includes(x));
      const coords = getWorkerCoordinates(nikla);
      const shownInList = !!filteredWorkers.find((w) => w.id === nikla.id);
      console.log("[PUPILLO_MAP_CITY_FILTER_NIKLA_DEBUG]", {
        user_id: nikla.id,
        nome: nikla.full_name,
        ruolo: nikla.primary_role,
        citta_profiles: (nikla as any).city,
        citta_service_area: (nikla as any).service_area_city,
        citta_disponibilita: nikla.location_city,
        zona_profiles: (nikla as any).neighborhood,
        zona_service_area: (nikla as any).service_area_district,
        zona_disponibilita: nikla.location_zone,
        selectedCity: city,
        selectedZone: district || "Tutte le zone",
        normalizedWorkerCities: cityCands,
        normalizedSelectedCity: target,
        cityMatch,
        zoneMatch,
        motivo_esclusione: shownInList ? null : !cityMatch ? "citta_non_corrisponde" : !zoneMatch ? "zona_non_corrisponde" : "altro_filtro",
        hasCoordinates: coords.hasValidCoordinates,
        shownInList,
        shownOnMap: shownInList && coords.hasValidCoordinates,
      });
    }
  }, [isRestaurant, workers, filteredWorkers, city, district]);

  const filteredRestaurants = useMemo(() => {
    const max = radiusKm !== "any" ? Number(radiusKm) : null;
    const ref = searchCenter || me;
    return restaurants.filter(r => {
      if (province !== "any" && r.province !== province) return false;
      if (city !== "any" && r.city !== city) return false;
      if (district && !(r.neighborhood || "").toLowerCase().includes(district.toLowerCase())) return false;
      if (withRequests && !annCounts[r.id]) return false;
      // Lato lavoratore: mostra SOLO ristoratori della/e città del lavoratore
      // (rule 1, 4, 12). Inoltre il locale deve avere almeno un annuncio
      // attivo (rule 1, 25), altrimenti non è di interesse per il lavoratore.
      if (isWorker) {
        if (!annCounts[r.id]) return false;
        if (!isWorkerCityAllowed(r.city)) return false;
      }
      if (max != null && ref && r.service_area_lat != null && r.service_area_lng != null) {
        if (distKm(ref.lat, ref.lng, r.service_area_lat, r.service_area_lng) > max) return false;
      }
      return true;
    });
  }, [restaurants, city, province, district, withRequests, annCounts, radiusKm, searchCenter, me, isWorker, workerAllowedCities]);

  const restaurantIdSet = useMemo(() => new Set(filteredRestaurants.map(r => r.id)), [filteredRestaurants]);

  useEffect(() => {
    if (!isRestaurant) return;
    console.log("[PUPILLO_MAP_SEARCH_BAR_REMOVED_DEBUG]", {
      filtri_attivi_rimasti: ["province", "city", "district", "radiusKm", "withRequests", "wRole", "wBadge", "wExp", "wMinRating", "wMinReliab", "showW", "showA", "showR"],
      selectedCity: city,
      selectedZone: district,
      selectedDistance: radiusKm,
      selectedRole: wRole,
      showWorkers: showW,
      showRequests: showA,
      workersMostrati: filteredWorkers.length,
      richiesteMostrate: filteredRestaurants.length,
    });
  }, [city, district, radiusKm, wRole, wBadge, wExp, wMinRating, wMinReliab, showW, showA, showR, filteredWorkers.length, filteredRestaurants.length]);

  useEffect(() => {
    const availableZones = city !== "any" ? zonesForCity(city) : [];
    const workersBefore = workers.filter((w) => city === "any" || w.city === city);
    const restaurantsBefore = restaurants.filter((r) => city === "any" || r.city === city);
    const zoneFieldsChecked = ["neighborhood", "service_area_district", "location_zone"];
    console.log("[PUPILLO_MAP_ZONE_FILTER_DEBUG]", {
      selectedCity: city,
      selectedZone: district || "Tutte le zone",
      zoneFilterActive: !!district,
      availableZonesForCity: availableZones,
      totaleLavoratoriPrimaFiltroZona: workersBefore.length,
      totaleLavoratoriDopoFiltroZona: filteredWorkers.length,
      totaleRistoratoriPrimaFiltroZona: restaurantsBefore.length,
      totaleRistoratoriDopoFiltroZona: filteredRestaurants.length,
      campiZonaUsatiPerFiltrare: zoneFieldsChecked,
      lavoratoriEsclusiPerZona: district
        ? workersBefore
            .filter((w) => !(w.neighborhood || "").toLowerCase().includes(district.toLowerCase()))
            .map((w) => ({ id: w.id, neighborhood: w.neighborhood }))
        : [],
      ristoratoriEsclusiPerZona: district
        ? restaurantsBefore
            .filter((r) => !(r.neighborhood || "").toLowerCase().includes(district.toLowerCase()))
            .map((r) => ({ id: r.id, neighborhood: r.neighborhood }))
        : [],
    });
  }, [city, district, workers, restaurants, filteredWorkers, filteredRestaurants]);

  // Worker points for the avatar-based map (used for restaurant view).
  // One source only: filteredWorkers from loadRestaurantWorkerSearchResults; no city/mock fallback.
  const locatedWorkers = useMemo(() => {
    let withCoords = 0, skipped = 0;
    const coordDebug: Array<Record<string, unknown>> = [];
    const arr = filteredWorkers.map((w) => {
      if (isRestaurant && !isRealWorker(w)) {
        console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", { componente: "src/routes/mappa.tsx locatedWorkers", worker: w, motivo: nonWorkerReason(w) });
        return null;
      }
      const coords = getWorkerCoordinates(w);
      coordDebug.push({
        user_id: w.id,
        profile_id: w.id,
        nome: w.full_name,
        ruolo: w.primary_role,
        city: w.location_city ?? w.service_area_city ?? w.city ?? null,
        province: w.location_province ?? w.province ?? null,
        zone: w.location_zone ?? w.service_area_district ?? w.neighborhood ?? null,
        district: w.location_zone ?? w.service_area_district ?? w.neighborhood ?? null,
        radius_km: w.radius_km ?? null,
        latitude: coords.lat,
        longitude: coords.lng,
        available_days: w.available_days ?? [],
        availability_schedule: w.availability_schedule ?? [],
        tabella_sorgente_dati_posizione: w.location_source ?? "missing",
        tabella_sorgente_dati_disponibilita: w.availability_source ?? "missing",
        hasValidCoordinates: coords.hasValidCoordinates,
        hasApproximateLocation: coords.hasApproximateLocation,
        shownOnMap: coords.hasValidCoordinates,
        motivo_se_non_mostrato_su_mappa: coords.hasValidCoordinates ? null : "nessuna coordinata valida e città/zona non risolvibile",
      });
      if (coords.hasValidCoordinates && coords.lat != null && coords.lng != null) {
        withCoords++;
        return { w, pos: [coords.lat, coords.lng] as [number, number] };
      }
      skipped++;
      return null;
    }).filter((x): x is { w: Worker; pos: [number, number] } => x != null);
    if (typeof window !== "undefined") {
      console.log("[PUPILLO_WORKER_LOCATION_AVAILABILITY_DEBUG]", coordDebug);
      console.log("[PUPILLO_WORKER_MAP_COORDINATES_FINAL_DEBUG]", coordDebug);
      console.debug("[mappa] workers totali:", filteredWorkers.length, "con coordinate:", withCoords, "saltati:", skipped, "marker:", arr.length);
    }
    return arr;
  }, [filteredWorkers]);

  const workerAvatarIds = useMemo(() => locatedWorkers.map(({ w }) => w.id), [locatedWorkers]);
  const workerAvatars = useAvatarUrls(workerAvatarIds);

  const workerMapPoints: WorkerMapPoint[] = useMemo(
    () => locatedWorkers.map(({ w, pos }) => {
      const known = isRestaurant && knownWorkerIds.has(w.id);
      const lastRev = known ? lastReviewByWorker[w.id] : undefined;
      const profAvg = w.avg_professionalism != null ? Number(w.avg_professionalism) : null;
      return {
        id: w.id,
        lat: pos[0],
        lng: pos[1],
        // Privacy: prima dell'assegnazione il ristoratore vede solo il nome
        // (no cognome). Dopo una candidatura accettata o un turno assegnato
        // mostriamo invece nome e cognome completi.
        name: isRestaurant ? displayWorkerName(w, known) : w.full_name,
        role: w.primary_role,
        city: workerLocationLabel(w),
        rating: w.rating_avg != null && Number(w.rating_avg) > 0 ? Number(w.rating_avg) : null,
        badge: w.badge,
        avatarUrl: workerAvatars[w.id] ?? null,
        initials: mapInitials(w.full_name),
        link: `/workers/${w.id}`,
        known,
        completedShifts: known && w.completed_shifts != null ? Number(w.completed_shifts) : null,
        reliabilityPct: known && w.reliability_pct != null ? Number(w.reliability_pct) : null,
        punctualityPct: known && w.punctuality_pct != null ? Number(w.punctuality_pct) : null,
        professionalismAvg: known && profAvg != null && profAvg > 0 ? profAvg : null,
        lastReviewComment: lastRev?.comment ?? null,
        lastReviewRating: lastRev?.rating ?? null,
      };
    }),
    [locatedWorkers, workerAvatars, isRestaurant, knownWorkerIds, lastReviewByWorker],
  );

  const { points, coordSourceStats, coordSourceById } = useMemo(() => {
    const pts: MapPoint[] = [];
    const stats: Record<string, number> = { job: 0, location: 0, profile: 0, service_area: 0, missing: 0 };
    const byId: Record<string, "job" | "location" | "profile" | "service_area"> = {};
    if (showR) {
      filteredRestaurants.forEach(r => {
        let lat: number | null | undefined;
        let lng: number | null | undefined;
        if (isWorker) {
          // Posizione APPROSSIMATA derivata da zona/città del locale.
          // Non usiamo mai le coordinate precise del profilo (rule 5/10).
          // Se città/zona non risolvono, skip (rule 14): meglio nessun
          // marker che un marker nella città sbagliata.
          const base = lookupCityCoords(r.neighborhood) || lookupCityCoords(r.city);
          if (!base) {
            if (typeof window !== "undefined") {
              console.debug("[mappa] skip restaurant (no city coords)", { id: r.id, city: r.city, neighborhood: r.neighborhood });
            }
            return;
          }
          const j = jitterCoords(base, r.id, 1.2);
          lat = j[0];
          lng = j[1];
        } else {
          lat = r.service_area_lat ?? r.latitude;
          lng = r.service_area_lng ?? r.longitude;
          if (lat == null || lng == null) return;
        }
        const known = !isWorker || knownRestaurantIds.has(r.id);
        const hasActive = (annCounts[r.id] || 0) > 0;
        const maskedTitle = pickMaskedRestaurantLabel(r.id, hasActive);
        const zone = [r.neighborhood, r.city].filter(Boolean).join(", ") || r.city || "Zona non specificata";
        const maskedSubtitle = [
          r.venue_type,
          `Zona: ${zone}`,
          hasActive ? `${annCounts[r.id]} richiest${annCounts[r.id] === 1 ? "a attiva" : "e attive"}` : "Nessuna richiesta attiva",
        ].filter(Boolean).join(" · ");
        pts.push({
          id: r.id,
          lat: isWorker ? lat! : (known ? lat! : jitterCoords([lat!, lng!], r.id, 1.2)[0]),
          lng: isWorker ? lng! : (known ? lng! : jitterCoords([lat!, lng!], r.id, 1.2)[1]),
          category: "restaurant",
          title: known ? (r.business_name || r.full_name || "Locale") : maskedTitle,
          subtitle: known
            ? [r.venue_type, r.price_range ? `Fascia: ${priceRangeLabel(r.price_range)}` : null, zone, `${annCounts[r.id] || 0} annunci attivi`].filter(Boolean).join(" · ")
            : maskedSubtitle,
          city: zone,
          status: r.account_status,
        });
      });
    }
    if (showW) {
      filteredWorkers.forEach(w => {
        const coords = getWorkerCoordinates(w);
        if (!coords.hasValidCoordinates || coords.lat == null || coords.lng == null) return;
        pts.push({
          id: w.id,
          lat: coords.lat,
          lng: coords.lng,
          category: "worker",
          title: isRestaurant ? displayWorkerName(w, knownWorkerIds.has(w.id)) : (w.full_name || "Lavoratore"),
          subtitle: [w.primary_role, w.badge ? `· ${w.badge}` : null].filter(Boolean).join(" "),
          city: workerLocationLabel(w),
          status: w.account_status,
          link: `/workers?focus=${w.id}`,
          meta: {
            secondaryRoles: w.secondary_roles || [],
            rating: w.rating_avg,
            reliability: w.reliability_pct,
            completedShifts: w.completed_shifts,
            hourlyRate: w.hourly_rate,
            availability: w.weekly_availability || [],
            badge: w.badge,
          },
        });
      });
    }
    if (showA) {
      const restById = new Map(restaurants.map(r => [r.id, r]));
      anns.forEach(a => {
        const rest = restById.get(a.restaurant_id);
        // Esclude difensivamente stati non attivi anche se la query li
        // avesse fatti passare (rule 2, 24).
        const annStatus = (a.status || "").toLowerCase();
        if (["cancelled", "annullato", "closed", "completed", "expired", "deleted"].includes(annStatus)) {
          return;
        }
        // Lato lavoratore: filtra per città consentite (rule 1, 4, 12, 15-18).
        if (isWorker && !isWorkerCityAllowed(rest?.city)) {
          if (typeof window !== "undefined") {
            console.debug("[mappa] skip ann (city not allowed for worker)", { ann: a.id, restCity: rest?.city, allowed: workerAllowedCities ? Array.from(workerAllowedCities) : null });
          }
          return;
        }
        // Fallback ordinato: job_latitude/job_longitude (sempre prioritari se presenti)
        // → location_lat/lng dell'annuncio → coordinate del profilo ristoratore → service_area_*
        const candidates: Array<[number | null | undefined, number | null | undefined, string]> = [
          [a.job_latitude, a.job_longitude, "job"],
          [a.location_lat, a.location_lng, "location"],
          [rest?.latitude, rest?.longitude, "profile"],
          [rest?.service_area_lat, rest?.service_area_lng, "service_area"],
        ];
        const picked = candidates.find(([la, ln]) => la != null && ln != null);
        let rawLat: number | null = null;
        let rawLng: number | null = null;
        let source: "job" | "location" | "profile" | "service_area" | "city" = "city";
        if (isWorker) {
          // Posizione SEMPRE approssimata da zona/città del locale (rule 5/10/30).
          // Se città/zona non risolvono, skip per non finire in città sbagliata (rule 14).
          const base = lookupCityCoords(rest?.neighborhood) || lookupCityCoords(rest?.city);
          if (!base) {
            stats.missing++;
            if (typeof window !== "undefined") {
              console.debug("[mappa] skip ann (no city coords)", { ann: a.id, restCity: rest?.city, neighborhood: rest?.neighborhood });
            }
            return;
          }
          const j = jitterCoords(base, a.id, 0.9);
          rawLat = j[0];
          rawLng = j[1];
          source = "city";
          stats["service_area"] = (stats["service_area"] || 0); // keep keys
          byId[a.id] = "service_area";
        } else {
          if (!picked) { stats.missing++; return; }
          const p = picked as [number, number, "job" | "location" | "profile" | "service_area"];
          rawLat = p[0]; rawLng = p[1]; source = p[2];
          stats[source]++;
          byId[a.id] = source;
        }
        // se c'è una ricerca attiva, mostra solo annunci dei ristoratori filtrati
        if (city !== "any" || district || withRequests) {
          if (!restaurantIdSet.has(a.restaurant_id)) return;
        }
        const refPoint = searchCenter || me;
        const distance = refPoint && rawLat != null && rawLng != null ? distKm(refPoint.lat, refPoint.lng, rawLat, rawLng) : null;
        const contactName = a.job_contact_person_name
          || [rest?.contact_person_first_name, rest?.contact_person_last_name].filter(Boolean).join(" ").trim()
          || null;
        const contactPhone = a.job_contact_person_phone || rest?.contact_person_phone || null;
        const contactEmail = a.job_contact_person_email || rest?.contact_person_email || null;
        const contactRole = rest?.contact_person_role || null;

        // Privacy lavoratore: posizione approssimata e dati ridotti finché non c'è conferma reciproca
        const appStatus = appStatusByAnn[a.id];
        const confirmed = appStatus === "accepted";
        const cancelled = appStatus === "rejected" || a.status === "cancelled" || a.status === "expired";
        const isKnownRestaurant = knownRestaurantIds.has(a.restaurant_id);
        // Il nome del locale può apparire se: confermato per questo annuncio
        // oppure il lavoratore ha già lavorato in passato con il ristorante.
        const canSeeRestaurantName = !isWorker || confirmed || isKnownRestaurant;
        // L'indirizzo completo e i contatti restano nascosti finché il
        // servizio non viene accettato per QUESTO annuncio.
        const usePrivacy = isWorker && !confirmed;
        // Per il lavoratore le coordinate sono già "approssimate da città"
        // (vedi sopra). Per gli altri ruoli applichiamo il vecchio jitter
        // solo se l'utente è in privacy. Per ristoratore/admin usiamo le
        // coordinate precise originali.
        const [lat, lng] = isWorker
          ? [rawLat!, rawLng!]
          : (usePrivacy ? jitterCoords([rawLat!, rawLng!], a.id, 0.8) : [rawLat!, rawLng!]);

        const zoneLabel = [rest?.neighborhood, rest?.city].filter(Boolean).join(" · ")
          || rest?.city
          || a.location_address?.split(",").slice(-2).join(",").trim()
          || null;
        const venueLabel = rest?.venue_type || "Locale";
        const requirements = [
          ...(a.required_skills || []),
          ...(a.language_requirements?.map(l => `Lingua: ${l}`) || []),
          ...(a.dress_code_items?.length ? [`Dress code: ${a.dress_code_items.join(", ")}`] : []),
        ];

        pts.push({
          id: a.id,
          lat,
          lng,
          category: "announcement",
          title: canSeeRestaurantName
            ? (rest?.business_name || rest?.full_name || a.professional_profile || "Annuncio")
            : `${venueLabel}${zoneLabel ? ` — zona ${zoneLabel}` : ""}`,
          subtitle: usePrivacy
            ? (a.professional_profile ? `Cerca ${a.professional_profile}` : "Servizio disponibile")
            : (a.job_address || a.location_address || undefined),
          status: cancelled ? "cancelled" : a.status,
          link: `/announcements/${a.id}`,
          meta: {
            distanceKm: distance,
            contactName: usePrivacy ? null : contactName,
            contactPhone: usePrivacy ? null : contactPhone,
            contactEmail: usePrivacy ? null : contactEmail,
            contactRole: usePrivacy ? null : contactRole,
            coordSource: debugEnabled ? source : undefined,
            workerView: isWorker,
            confirmed,
            cancelled,
            venueType: rest?.venue_type ?? null,
            zoneLabel,
            role: a.professional_profile ?? null,
            serviceDate: a.service_date ?? null,
            serviceTime: a.service_time ?? null,
            durationHours: a.duration_hours ?? null,
            tariffAmount: a.tariff_amount ?? null,
            tariffType: a.tariff_type ?? null,
            generalDescription: a.notes ?? null,
            requirements,
            servicesAtVenue: annCounts[a.restaurant_id] || 0,
            announcementId: a.id,
            operationalNotes: usePrivacy ? null : (a.notes ?? null),
            fullAddress: usePrivacy ? null : (a.job_address || a.location_address || null),
            restaurantName: canSeeRestaurantName ? (rest?.business_name || rest?.full_name || null) : null,
            knownRestaurant: isKnownRestaurant,
          } as any,
        });
      });
    }
    return { points: pts, coordSourceStats: stats, coordSourceById: byId };
  }, [filteredRestaurants, filteredWorkers, anns, restaurants, showR, showW, showA, restaurantIdSet, city, district, withRequests, searchCenter, me, debugEnabled, isWorker, appStatusByAnn, knownRestaurantIds, annCounts, workerAllowedCities]);

  // Quality check: per ogni annuncio elenca quali sorgenti coordinate mancano.
  type QualityRow = { id: string; title: string; restaurant_id: string; missing: string[]; available: string[] };
  const annsQuality = useMemo<QualityRow[]>(() => {
    const restById = new Map(restaurants.map(r => [r.id, r]));
    return anns.map(a => {
      const rest = restById.get(a.restaurant_id);
      const checks: Array<{ key: string; ok: boolean }> = [
        { key: "job_lat/lng", ok: a.job_latitude != null && a.job_longitude != null },
        { key: "location_lat/lng", ok: a.location_lat != null && a.location_lng != null },
        { key: "profilo ristoratore", ok: rest?.latitude != null && rest?.longitude != null },
        { key: "service_area_*", ok: rest?.service_area_lat != null && rest?.service_area_lng != null },
      ];
      return {
        id: a.id,
        title: a.professional_profile || "Annuncio",
        restaurant_id: a.restaurant_id,
        missing: checks.filter(c => !c.ok).map(c => c.key),
        available: checks.filter(c => c.ok).map(c => c.key),
      };
    });
  }, [anns, restaurants]);

  const annsMissingCoords = useMemo(
    () => annsQuality.filter(q => q.available.length === 0),
    [annsQuality]
  );
  const annsPartialCoords = useMemo(
    () => annsQuality.filter(q => q.missing.length > 0 && q.available.length > 0),
    [annsQuality]
  );

  // Per il ristoratore: se non c'è ricerca / posizione browser, centra sul
  // proprio locale (latitude/longitude o service_area_*).
  const ownRestaurant = useMemo(
    () => (isRestaurant && user ? restaurants.find((r) => r.id === user.id) ?? null : null),
    [isRestaurant, user, restaurants],
  );
  const ownCenter: [number, number] | null = useMemo(() => {
    if (!ownRestaurant) return null;
    const lat = ownRestaurant.latitude ?? ownRestaurant.service_area_lat;
    const lng = ownRestaurant.longitude ?? ownRestaurant.service_area_lng;
    if (lat == null || lng == null) return null;
    return [lat, lng];
  }, [ownRestaurant]);

  const center: [number, number] = searchCenter
    ? [searchCenter.lat, searchCenter.lng]
    : me ? [me.lat, me.lng]
    : ownCenter
    ? ownCenter
    : isRestaurant && workerMapPoints.length > 0
      ? [
          workerMapPoints.reduce((s, p) => s + p.lat, 0) / workerMapPoints.length,
          workerMapPoints.reduce((s, p) => s + p.lng, 0) / workerMapPoints.length,
        ]
    : points[0] ? [points[0].lat, points[0].lng]
    : [42.5, 12.5];

  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return toast.error("Geolocalizzazione non supportata");
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setSearchCenter(null); setLocating(false); toast.success("Posizione rilevata"); },
      (err) => { setLocating(false); toast.error("Posizione: " + err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const ref = searchCenter || me;

  return (
    <AppShell>
      <PageHeader
        title="Mappa"
        subtitle="Ristoratori, lavoratori e richieste attive in tempo reale"
        action={
          <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm">
            {!isRestaurant && (
              <Button
                size="sm"
                variant={view === "restaurants" ? "secondary" : "ghost"}
                className="h-8 px-3 text-xs"
                onClick={() => setView("restaurants")}
              >
                Ristoratori
              </Button>
            )}
            <Button
              size="sm"
              variant={view === "workers" ? "secondary" : "ghost"}
              className="h-8 px-3 text-xs"
              onClick={() => setView("workers")}
            >
              Lavoratori
            </Button>
          </div>
        }
      />

      {/* FILTERS */}
      <div className="rounded-2xl border bg-card p-3 mb-3 space-y-3">
        {/* Primary filters */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={province} onValueChange={(v) => { setProvince(v); setCity("any"); setDistrict(""); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Provincia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutte le province</SelectItem>
              {ITALIAN_LOCATIONS.map((p) => <SelectItem key={p.province_code} value={p.province}>{p.province}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={(v) => { setCity(v); setDistrict(""); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Città" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutte le città</SelectItem>
              {(province !== "any" ? citiesForProvince(province) : cities).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={district === "" ? "__all__" : district}
            onValueChange={(v) => setDistrict(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Zona / quartiere" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte le zone</SelectItem>
              {(city !== "any" ? zonesForCity(city) : []).map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={radiusKm} onValueChange={setRadiusKm}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Distanza" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi distanza</SelectItem>
              <SelectItem value="1">Entro 1 km</SelectItem>
              <SelectItem value="3">Entro 3 km</SelectItem>
              <SelectItem value="5">Entro 5 km</SelectItem>
              <SelectItem value="10">Entro 10 km</SelectItem>
              <SelectItem value="20">Entro 20 km</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick actions + layer toggles */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" variant="outline" onClick={locateMe} disabled={locating} className="h-8 gap-2">
            <Locate className="h-4 w-4" />{locating ? "Rilevo…" : me ? "Aggiorna posizione" : "Usa la mia posizione"}
          </Button>
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 text-xs font-medium">
            <Checkbox checked={withRequests} onCheckedChange={v => setWithRequests(!!v)} />
            Solo con richieste attive
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">Layer</span>
            {!isRestaurant && !isWorker && (
              <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium">
                <Checkbox checked={showR} onCheckedChange={v=>setShowR(!!v)} /><Dot color="#4f46e5" />Ristoratori
              </label>
            )}
            {!isWorker && (
              <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium">
                <Checkbox checked={showW} onCheckedChange={v=>setShowW(!!v)} /><Dot color="#22c55e" />Lavoratori
              </label>
            )}
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium">
              <Checkbox checked={showA} onCheckedChange={v=>setShowA(!!v)} /><Dot color="#06b6d4" />Richieste
            </label>
          </div>
        </div>

        {/* Advanced filters */}
        {showW && !isWorker && (() => {
          const advCount = [wRole, wBadge, wExp, wMinRating, wMinReliab].filter(v => v !== "any").length;
          return (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border-t pt-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1 py-1 text-sm font-medium hover:text-primary"
                >
                  <span className="inline-flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> Filtri avanzati
                    {advCount > 0 && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {advCount} {advCount === 1 ? "attivo" : "attivi"}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Select value={wRole} onValueChange={setWRole}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Ruolo lavoratore" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tutti i ruoli</SelectItem>
                    {workerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={wBadge} onValueChange={setWBadge}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Badge" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Tutti i badge</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={wExp} onValueChange={setWExp}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Esperienza" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualsiasi esperienza</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="middle">Middle</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={wMinRating} onValueChange={setWMinRating}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Rating minimo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualsiasi rating</SelectItem>
                    <SelectItem value="3">≥ 3.0</SelectItem>
                    <SelectItem value="4">≥ 4.0</SelectItem>
                    <SelectItem value="4.5">≥ 4.5</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={wMinReliab} onValueChange={setWMinReliab}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Affidabilità minima" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualsiasi affidabilità</SelectItem>
                    <SelectItem value="70">≥ 70%</SelectItem>
                    <SelectItem value="85">≥ 85%</SelectItem>
                    <SelectItem value="95">≥ 95%</SelectItem>
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>
          );
        })()}
      </div>

      {/* LAYOUT: list + map */}
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* LIST */}
        <div className="rounded-2xl border bg-card p-3 max-h-[700px] overflow-y-auto order-2 lg:order-1">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Caricamento…</p>
          ) : view === "workers" ? (
            filteredWorkers.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nessun lavoratore trovato.</div>
            ) : (
              <ul className="space-y-2">
                {filteredWorkers.slice(0, 200).map(w => {
                  if (isRestaurant && !isRealWorker(w)) {
                    console.warn("[PUPILLO_BLOCKED_NON_WORKER_CARD_DEBUG]", { componente: "src/routes/mappa.tsx lista card", worker: w, motivo: nonWorkerReason(w) });
                    return null;
                  }
                  const coords = getWorkerCoordinates(w);
                  const d = ref && coords.hasValidCoordinates && coords.lat != null && coords.lng != null
                    ? distKm(ref.lat, ref.lng, coords.lat, coords.lng) : null;
                  const proRoles = workerProfessionalRoles(w);
                  const rolesLabel = formatRolesForCard(proRoles, 3);
                  const realAvailRows = availByWorker[w.id] ?? null;
                  const availabilityLabel = formatWorkerAvailabilityLine(w, realAvailRows);
                  const isNikla = (w.full_name ?? "").toLowerCase().includes("nikla");
                  if (isNikla || debugEnabled) {
                    const logTag = isNikla
                      ? "[PUPILLO_MAP_WORKER_AVAILABILITY_NIKLA_DEBUG]"
                      : "[PUPILLO_MAP_WORKER_AVAILABILITY_CARD_DEBUG]";
                    console.log(logTag, {
                      user_id: w.id,
                      nome: w.full_name,
                      availabilitySource: w.availability_source ?? "missing",
                      worker_availability_rows_count: realAvailRows?.length ?? 0,
                      worker_availability_rows: realAvailRows ?? [],
                      weekly_availability: w.weekly_availability ?? [],
                      hourly_availability: w.hourly_availability ?? null,
                      available_now_until: w.available_now_until ?? null,
                      work_area_mode: w.work_area_mode ?? null,
                      all_zones: w.all_zones ?? null,
                      selected_zones: w.selected_zones ?? [],
                      service_area_city: w.service_area_city ?? null,
                      service_area_district: w.service_area_district ?? null,
                      radius_km: w.radius_km ?? null,
                      cardAvailabilityText: availabilityLabel,
                      sorgente_finale: (realAvailRows && realAvailRows.length > 0)
                        ? "worker_availability (stessa del profilo)"
                        : ((w.weekly_availability ?? []).length > 0
                          ? "profiles.weekly_availability (fallback legacy)"
                          : "fallback area (city/zone) o nessuna"),
                    });
                  }
                  if (isNikla) {
                    console.log("[PUPILLO_MAP_CARD_AVAILABILITY_SYNC_DEBUG]", {
                      user_id: w.id,
                      nome: w.full_name,
                      tabella_sorgente_profilo: "worker_availability + worker_availability_exceptions",
                      tabella_sorgente_mappa: "worker_availability (ora allineata al profilo)",
                      raw_rows_count: realAvailRows?.length ?? 0,
                      raw_rows: realAvailRows ?? [],
                      formatted_card_mappa: availabilityLabel,
                    });
                  }
                  if (debugEnabled) {
                    console.log("[PUPILLO_MAP_WORKER_CARD_DETAILS_DEBUG]", {
                      user_id: w.id,
                      nome: w.full_name,
                      ruolo_account: (w.user_roles ?? []).join(",") || (w.role_is_worker ? "worker" : "?"),
                      ruolo_professionale_principale: w.primary_role,
                      ruoli_professionali_secondari: w.secondary_roles ?? [],
                      competenze: (w as any).default_required_skills ?? [],
                      ruoli_finali_card: proRoles,
                      disponibilita_grezza: w.weekly_availability ?? [],
                      disponibilita_mostrata: availabilityLabel,
                      citta: w.location_city ?? w.city,
                      zona: w.location_zone ?? w.neighborhood,
                      shownInList: true,
                      shownOnMap: coords.shownOnMap,
                    });
                  }
                  console.debug("[PUPILLO_WORKER_REVIEWS_CARD_DEBUG]", {
                    pagina: "mappa",
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
                        ? "rating_avg assente o 0 sul profilo"
                        : (w.reviews_count ?? 0) === 0
                          ? "reviews_count = 0 sul profilo"
                          : null,
                  });
                  return (
                    <li key={w.id} className="rounded-xl border p-3 hover:border-primary transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {isRestaurant
                              ? displayWorkerName(w, knownWorkerIds.has(w.id))
                              : (w.full_name || "Lavoratore")}
                          </div>
                          <div className="text-xs text-muted-foreground truncate" title={proRoles.join(" · ")}>
                            {rolesLabel}
                          </div>
                        </div>
                        {d != null && <span className="text-xs rounded-full bg-secondary px-2 py-0.5 whitespace-nowrap">{d.toFixed(1)} km</span>}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{workerLocationLabel(w)}</div>
                        <div className="flex items-start gap-1.5">
                          <span aria-hidden>🗓</span>
                          <span className="break-words">{availabilityLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {w.badge && <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 capitalize">{w.badge}</span>}
                          <WorkerRatingSummary
                            ratingAvg={w.rating_avg}
                            reviewsCount={w.reviews_count ?? null}
                          />
                          {(() => {
                            const c = Number(w.completed_shifts ?? 0);
                            if (c <= 0) return <span>Nuovo profilo</span>;
                            if (c < 3) return <span>In valutazione</span>;
                            return w.reliability_pct != null ? <span>{w.reliability_pct}% affid.</span> : null;
                          })()}
                          {w.hourly_rate != null && <span>€ {Number(w.hourly_rate).toFixed(0)}/h</span>}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {coords.hasValidCoordinates ? (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                            if (isRestaurant) {
                              focusWorkerOnMap(w.id);
                            } else if (coords.lat != null && coords.lng != null) {
                              focusOnMap(coords.lat, coords.lng, w.full_name || undefined);
                            }
                          }}>Mostra sulla mappa</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="flex-1" disabled>Posizione non disponibile</Button>
                        )}
                        <Button size="sm" onClick={() => openWorkerProfile(w.id, "lista_mappa", w.full_name)}>Vedi profilo</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : filteredRestaurants.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nessun ristoratore trovato per questa zona. Prova con un altro indirizzo, città o quartiere.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredRestaurants.map(r => {
                const d = ref && r.service_area_lat != null && r.service_area_lng != null
                  ? distKm(ref.lat, ref.lng, r.service_area_lat, r.service_area_lng) : null;
                const known = !isWorker || knownRestaurantIds.has(r.id);
                const activeCount = annCounts[r.id] || 0;
                const hasActive = activeCount > 0;
                const displayName = known
                  ? (r.business_name || r.full_name || "Locale")
                  : pickMaskedRestaurantLabel(r.id, hasActive);
                const displayLocation = known
                  ? ([r.address, r.neighborhood, r.city].filter(Boolean).join(", ") || "Indirizzo non disponibile")
                  : `Zona ${maskedZoneLabel(r)}`;
                return (
                  <li key={r.id} className="rounded-xl border p-3 hover:border-primary transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-1.5">
                          {!known && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="truncate">{displayName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">{r.venue_type || "—"}</div>
                        {r.price_range && <div className="text-xs text-muted-foreground">Fascia: {priceRangeLabel(r.price_range)}</div>}
                      </div>
                      {d != null && <span className="text-xs rounded-full bg-secondary px-2 py-0.5 whitespace-nowrap">{d.toFixed(1)} km</span>}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{displayLocation}</div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{activeCount} {activeCount === 1 ? "richiesta" : "richieste"}</span>
                        {!isWorker && <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{r.credits ?? 0}</span>}
                        {r.rating_avg ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{Number(r.rating_avg).toFixed(1)}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isWorker && <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 capitalize">{r.plan || "free"}</span>}
                        {isWorker ? (
                          hasActive ? (
                            <span className="rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5">Attivo</span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5">Nessuna richiesta attiva</span>
                          )
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 capitalize ${r.account_status === "active" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted"}`}>{r.account_status || "—"}</span>
                        )}
                        {!known && (
                          <span className="rounded-full bg-muted px-2 py-0.5 inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Nome visibile dopo conferma
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                        const lat = r.service_area_lat ?? r.latitude;
                        const lng = r.service_area_lng ?? r.longitude;
                        if (lat != null && lng != null) {
                          focusOnMap(lat, lng, known ? (r.business_name || undefined) : displayName);
                        }
                      }}>Mostra sulla mappa</Button>
                      {known ? (
                        <Link to="/restaurants/$id" params={{ id: r.id }}><Button size="sm">Vedi dettaglio</Button></Link>
                      ) : (
                        hasActive ? (
                          <Button size="sm" variant="secondary" onClick={() => focusOnMap(r.service_area_lat ?? r.latitude ?? 0, r.service_area_lng ?? r.longitude ?? 0)}>Vedi richieste</Button>
                        ) : null
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* MAP */}
        <div ref={mapBoxRef} className="order-1 lg:order-2">
          {loading ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground" style={{ minHeight: 500 }}>Caricamento mappa…</div>
          ) : isRestaurant ? (
            workerMapPoints.length === 0 ? (
              <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground" style={{ minHeight: 500 }}>
                Nessun lavoratore visualizzabile sulla mappa.
              </div>
            ) : (
              <>
                <MapInteractionShell
                  isMobile={isMobile}
                  active={mapActive}
                  onActivate={() => setMapActive(true)}
                  onDeactivate={() => setMapActive(false)}
                  mobileHeight={320}
                >
                <WorkersMap
                  points={workerMapPoints}
                  center={center}
                  height={isMobile ? 320 : (typeof window !== "undefined" ? Math.max(500, Math.min(window.innerHeight * 0.75, 700)) : 600)}
                  focusId={focusWorkerId}
                  focusNonce={focusWorkerNonce}
                  onViewProfile={(id) => openWorkerProfile(id, "marker_mappa")}
                  onOpenChat={async (workerId) => {
                    if (!user) return;
                    const { data, error } = await supabase
                      .from("applications")
                      .select("id, updated_at")
                      .eq("restaurant_id", user.id)
                      .eq("worker_id", workerId)
                      .order("updated_at", { ascending: false })
                      .limit(1);
                    if (error || !data || data.length === 0) {
                      toast.error("Nessuna chat disponibile con questo lavoratore.");
                      return;
                    }
                    navigate({ to: "/messages/$id", params: { id: data[0].id as string } });
                  }}
                />
                </MapInteractionShell>
                <div className="mt-2 text-xs text-muted-foreground">
                  {workerMapPoints.length} lavorator{workerMapPoints.length === 1 ? "e" : "i"} sulla mappa · posizione approssimativa per tutela privacy · OpenStreetMap
                </div>
              </>
            )
          ) : points.length === 0 ? (
            <div
              className="rounded-2xl border bg-card p-10 text-center flex flex-col items-center justify-center gap-4"
              style={{ minHeight: 500 }}
            >
              <div className="rounded-full bg-muted p-4">
                <MapPinOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-lg font-semibold text-foreground">
                  Nessuna opportunità nella zona selezionata
                </h3>
                <p className="text-sm text-muted-foreground">
                  {city !== "any" || (ref && radiusKm !== "any")
                    ? <>Al momento non ci sono richieste attive o annunci disponibili{city !== "any" ? <> a <strong>{city}</strong></> : null}{ref && radiusKm !== "any" ? <> entro <strong>{radiusKm} km</strong> da te</> : null}.</>
                    : "Al momento non ci sono richieste attive o annunci disponibili con i filtri impostati."}
                  <br />
                  Prova ad ampliare il raggio di ricerca o cambia città.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCity("any"); setProvince("any"); setDistrict(""); }}
                  disabled={city === "any" && province === "any" && !district}
                >
                  <MapPin className="h-4 w-4 mr-1.5" />
                  Cambia città
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRadiusKm(radiusKm === "any" ? "50" : "any")}
                >
                  <Locate className="h-4 w-4 mr-1.5" />
                  {radiusKm === "any" ? "Imposta raggio 50 km" : "Rimuovi limite di raggio"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCity("any"); setProvince("any"); setDistrict("");
                    setWithRequests(false); setRadiusKm("any");
                  }}
                >
                  <Settings2 className="h-4 w-4 mr-1.5" />
                  Reimposta tutti i filtri
                </Button>
              </div>
            </div>
          ) : (
            <MapInteractionShell
              isMobile={isMobile}
              active={mapActive}
              onActivate={() => setMapActive(true)}
              onDeactivate={() => setMapActive(false)}
              mobileHeight={320}
            >
              <Suspense fallback={<div className="rounded-xl bg-muted animate-pulse" style={{ height: isMobile ? 320 : 600 }} />}>
                <MapViewInner
                  points={points}
                  height={isMobile ? 320 : (typeof window !== "undefined" ? Math.max(500, Math.min(window.innerHeight * 0.75, 700)) : 600)}
                  center={center}
                  focusZoom={focusZoom}
                  me={ref}
                  radiusKm={radiusKm !== "any" ? Number(radiusKm) : null}
                />
              </Suspense>
            </MapInteractionShell>
          )}
          {!isRestaurant && (
          <div className="mt-2 text-xs text-muted-foreground">
            {points.length} marker · {filteredRestaurants.length} ristoratori · {filteredWorkers.length} lavoratori{ref && radiusKm !== "any" ? ` entro ${radiusKm} km` : ""} · OpenStreetMap
          </div>
          )}
        </div>
      </div>
      <WorkerProfilePreviewDialog
        workerId={profileModalWorkerId}
        open={profileModalWorkerId !== null}
        onOpenChange={(o: boolean) => { if (!o) setProfileModalWorkerId(null); }}
        source="mappa"
      />
    </AppShell>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ background: color, width: 10, height: 10, borderRadius: 9999, display: "inline-block" }} />;
}

function mapInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5 flex items-center gap-2">
      <span style={{ background: color, width: 8, height: 8, borderRadius: 9999, display: "inline-block", flexShrink: 0 }} />
      <span className="flex-1 truncate text-[11px] text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function firstNameOnly(name: string | null | undefined): string {
  if (!name) return "Lavoratore";
  const trimmed = name.trim();
  if (!trimmed) return "Lavoratore";
  return trimmed.split(/\s+/)[0];
}
