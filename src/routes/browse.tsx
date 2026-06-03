import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, Euro, Heart, List, Map as MapIcon, Search, Send, Clock, Zap, User, CheckCircle2, Moon, Hourglass, Loader2, XCircle } from "lucide-react";
import { formatTariff, formatTotalService, formatOfferDateTime } from "@/lib/format";
import { publicLocationLabel, PRECISE_ADDRESS_HINT } from "@/lib/public-location";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlreadyInContactDialog } from "@/components/AlreadyInContactDialog";
import { checkExistingContact, isDuplicateContactError } from "@/lib/already-in-contact";
import {
  checkWorkerShiftConflict,
  CONFLICT_WORKER_APPLY_MESSAGE,
} from "@/lib/shift-conflict";
import {
  computeSpecialAvailabilityBlock,
  describeSpecialAvailability,
  fetchSpecialAvailabilityBlock,
  SPECIAL_INCOMPATIBLE_MESSAGE,
  type SpecialAvailabilityBlock,
} from "@/lib/worker-special-availability";
import {
  computeCompatibility,
  sameCity,
  type AvailabilityExceptionRow,
  type AvailabilityRow,
} from "@/lib/availability";

export const Route = createFileRoute("/browse")({
  head: () => ({ meta: [{ title: "Trova offerte — Pupillo" }] }),
  component: () => <RequireAuth><Browse /></RequireAuth>,
});

type Ann = {
  id: string; restaurant_id: string; service_date: string; service_time: string;
  end_time?: string | null; end_date?: string | null;
  duration_hours: number; speed: string; tariff_type: string; tariff_amount: number;
  location_address: string; location_lat: number | null; location_lng: number | null;
  professional_profile: string | null; status: string; created_at: string;
  job_city?: string | null; job_province?: string | null;
  dress_code_items?: string[] | null; dress_code_notes?: string | null;
  required_skills?: string[] | null; language_requirements?: string[] | null;
  license_requirement?: string | null;
  notes?: string | null; job_location_notes?: string | null;
  job_additional_directions?: string | null; job_access_restrictions?: string | null;
};

type RestaurantInfo = { id: string; full_name: string | null; business_name: string | null; venue_type: string | null; city: string | null; neighborhood: string | null; rating_avg: number | null } | null;

const ROLES = ["cameriere","bartender","chef","aiuto cucina","runner","lavapiatti","hostess","responsabile sala"];
const SPEEDS = [{v:"normal",l:"Standard"},{v:"urgent",l:"Urgente"},{v:"flash",l:"Flash"}];

function roleEmoji(role: string | null | undefined): string {
  const r = (role || "").toLowerCase();
  if (r.includes("camer")) return "🍽️";
  if (r.includes("barman") || r.includes("bartender") || r.includes("barista")) return "🍸";
  if (r.includes("cuoc") || r.includes("chef") || r.includes("cucina")) return "👨‍🍳";
  if (r.includes("lavapiatti") || r.includes("plonge")) return "🧽";
  if (r.includes("pizz")) return "🍕";
  if (r.includes("hostess") || r.includes("steward") || r.includes("accogli")) return "🎀";
  if (r.includes("runner")) return "🏃";
  if (r.includes("sommelier")) return "🍷";
  if (r.includes("commis")) return "🧑‍🍳";
  return "💼";
}

function speedLabel(s: string): string {
  if (s === "urgent") return "Urgente";
  if (s === "flash") return "Subito";
  return "Normal";
}

function speedClasses(s: string): string {
  if (s === "urgent") return "bg-destructive/15 text-destructive border border-destructive/30";
  if (s === "flash") return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  return "bg-secondary/60 text-foreground/80 border border-white/10";
}

function distKm(aLat:number,aLng:number,bLat:number,bLng:number){
  const R=6371,toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function Browse() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Ann[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [appStatusById, setAppStatusById] = useState<Record<string, string>>({});
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list"|"map">("list");
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState<string>("any");
  const [speedF, setSpeedF] = useState<string>("any");
  const [maxKm, setMaxKm] = useState<string>("");
  const [onlyNotApplied, setOnlyNotApplied] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState<"recent"|"pay"|"date">("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo>(null);
  const [restaurantsById, setRestaurantsById] = useState<Record<string, { city: string | null; neighborhood: string | null }>>({});
  const [workersNeededById, setWorkersNeededById] = useState<Record<string, number>>({});
  const [filledById, setFilledById] = useState<Record<string, number>>({});
  const [confirmAnn, setConfirmAnn] = useState<Ann | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successApp, setSuccessApp] = useState<{ id: string; ann: Ann } | null>(null);
  const [applyMode, setApplyMode] = useState<"accept" | "counter">("accept");
  const [counterAmount, setCounterAmount] = useState<string>("");
  const [alreadyContactAppId, setAlreadyContactAppId] = useState<string | null>(null);
  // Disponibilità speciali del lavoratore: se per la data dell'annuncio
  // esistono entry "speciali", quelle prevalgono sempre sulla disponibilità
  // abituale. Se nessuna è compatibile con città/orario dell'annuncio,
  // candidatura bloccata sia lato UI sia lato submit.
  const [specialExceptions, setSpecialExceptions] = useState<AvailabilityExceptionRow[]>([]);
  // Disponibilità ABITUALE (settimanale) del lavoratore, usata per calcolare
  // la compatibilità di ogni annuncio quando non c'è una disponibilità
  // speciale per quella data. Serve a ordinare la lista nazionale per
  // affinità (rule 5) e a mostrare i badge "Compatibile…" (rule 8-11).
  const [weeklyAvailability, setWeeklyAvailability] = useState<AvailabilityRow[]>([]);
  // Filtri aggiuntivi richiesti dal contratto "Trova offerte":
  // città, data, fascia oraria, tariffa minima, solo compatibili (rule 12).
  const [cityF, setCityF] = useState<string>("any");
  const [dateF, setDateF] = useState<string>("");
  const [timeFromF, setTimeFromF] = useState<string>("");
  const [timeToF, setTimeToF] = useState<string>("");
  const [minTariff, setMinTariff] = useState<string>("");
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  const selected = useMemo(() => items.find(i => i.id === openId) ?? null, [items, openId]);

  useEffect(() => {
    if (!selected) { setRestaurant(null); return; }
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, business_name, venue_type, city, neighborhood, rating_avg")
        .eq("id", selected.restaurant_id).maybeSingle();
      setRestaurant((data as RestaurantInfo) ?? null);
    })();
  }, [selected]);

  const load = async () => {
    setLoading(true);
    console.log("[PUPILLO_WORKER_OFFERS_LOAD_START]", { worker_user_id: user?.id ?? null });
    // Use the PII-safe view for public browsing (excludes job contact details
    // and exact GPS). Workers only see full row via base table once they have
    // an application/shift on the announcement (enforced by RLS).
    // Vista nazionale: carichiamo tutti gli annunci attivi in Italia (rule 1-3).
    // L'ordinamento per compatibilità avviene client-side nel useMemo.
    const { data: anns, error: annsError } = await (supabase as any)
      .from("announcements_public")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(500);
    if (annsError) {
      console.log("[PUPILLO_WORKER_OFFERS_ERROR]", { stage: "load_announcements", error: annsError.message });
    }
    const rawList = (anns as Ann[]) ?? [];
    const supabaseCount = rawList.length;
    console.log("[PUPILLO_WORKER_OFFERS_QUERY_RESULT]", {
      source: "announcements_public",
      count: supabaseCount,
      ids: rawList.map((a) => a.id),
    });

    // Filtro stato: solo "active" (già applicato dalla query), ma rimuoviamo
    // difensivamente eventuali stati che NON devono comparire al lavoratore.
    const HIDDEN_STATUSES = new Set([
      "draft", "deleted", "archived", "closed", "cancelled",
      "expired", "assigned", "completed",
    ]);
    const statusFiltered = rawList.filter((a) => !HIDDEN_STATUSES.has(String(a.status)));

    // Carica i profili dei ristoratori per filtrare gli annunci orfani:
    // - ristoratore eliminato (is_deleted)
    // - ristoratore non esistente nel DB
    // - utente che non ha ruolo "restaurant" (es. admin)
    // NOTA: NON filtriamo per ruolo lato client perché la RLS di `user_roles`
    // consente al lavoratore di vedere solo il PROPRIO ruolo. Qualunque join
    // con `user_roles` lato lavoratore tornerebbe vuota e svuoterebbe la
    // lista degli annunci. Filtriamo quindi solo per profilo esistente e
    // non eliminato (is_deleted=true), che il lavoratore può leggere
    // tramite la policy "Profiles viewable by all authenticated".
    const restIdsAll = Array.from(new Set(statusFiltered.map((a) => a.restaurant_id))).filter(Boolean);
    const restaurantsMeta: Record<string, { city: string | null; neighborhood: string | null }> = {};
    const deletedRestaurantIds = new Set<string>();
    const existingProfileIds = new Set<string>();
    if (restIdsAll.length) {
      const { data: rs } = await supabase
        .from("profiles")
        .select("id, city, neighborhood, is_deleted")
        .in("id", restIdsAll);
      for (const r of ((rs ?? []) as any[])) {
        existingProfileIds.add(r.id);
        restaurantsMeta[r.id] = { city: r.city, neighborhood: r.neighborhood };
        if (r.is_deleted === true) deletedRestaurantIds.add(r.id);
      }
      for (const a of statusFiltered) {
        if (!existingProfileIds.has(a.restaurant_id) || deletedRestaurantIds.has(a.restaurant_id)) {
          console.log("[PUPILLO_WORKER_OFFERS_EMPTY_REASON]", {
            announcement_id: a.id,
            restaurant_user_id: a.restaurant_id,
            reason: !existingProfileIds.has(a.restaurant_id)
              ? "ristoratore inesistente"
              : "ristoratore eliminato (is_deleted=true)",
          });
        }
      }
    }
    setRestaurantsById(restaurantsMeta);

    // Mostriamo TUTTI gli annunci attivi, eccetto quelli del ristoratore
    // eliminato. Se il profilo non è ancora caricato (es. errori RLS),
    // teniamo comunque l'annuncio visibile per non nascondere offerte valide.
    const restaurantFiltered = statusFiltered.filter(
      (a) => !deletedRestaurantIds.has(a.restaurant_id),
    );

    // Deduplicazione per announcement_id (difensiva contro join doppi).
    const seen = new Set<string>();
    const list: Ann[] = [];
    for (const a of restaurantFiltered) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      list.push(a);
    }

    console.log("[PUPILLO_WORKER_FIND_OFFERS_SOURCE_DEBUG]", {
      worker_user_id: user?.id ?? null,
      source: "supabase:announcements_public",
      supabase_count: supabaseCount,
      mock_count: 0,
      after_status_filter: statusFiltered.length,
      after_real_restaurant_filter: restaurantFiltered.length,
      after_dedup: list.length,
      final_rendered: list.length,
      titles: list.map((a) => a.professional_profile),
    });
    if (list.length === 0) {
      console.log("[PUPILLO_WORKER_OFFERS_EMPTY_REASON]", {
        reason: supabaseCount === 0
          ? "nessun annuncio attivo restituito dalla query"
          : "tutti gli annunci sono stati filtrati (status nascosto o ristoratore eliminato)",
        supabase_count: supabaseCount,
        after_status_filter: statusFiltered.length,
        after_real_restaurant_filter: restaurantFiltered.length,
      });
    }

    setItems(list);
    // Multi-position: load workers_needed per announcement and accepted count.
    const annIds = list.map(a => a.id);
    if (annIds.length) {
      const availability = await Promise.all(
        annIds.map(async (id) => {
          const { data } = await (supabase as any).rpc("get_application_availability", { _announcement_id: id }).maybeSingle();
          return { id, data };
        }),
      );
      const needMap: Record<string, number> = {};
      const fillMap: Record<string, number> = {};
      availability.forEach(({ id, data }) => {
        needMap[id] = Math.max(1, Number(data?.workers_needed ?? 1) || 1);
        fillMap[id] = Math.max(0, Number(data?.accepted_count ?? 0) || 0);
      });
      setWorkersNeededById(needMap);
      setFilledById(fillMap);
    }
    if (user) {
      const [{data:apps},{data:favs}] = await Promise.all([
        supabase.from("applications").select("announcement_id,status,created_at").eq("worker_id",user.id).order("created_at",{ascending:false}),
        supabase.from("favorites").select("announcement_id").eq("user_id",user.id),
      ]);
      setAppliedIds(new Set((apps??[]).map((a:any)=>a.announcement_id)));
      const statusMap: Record<string, string> = {};
      for (const a of (apps ?? []) as any[]) {
        if (!statusMap[a.announcement_id]) statusMap[a.announcement_id] = a.status;
      }
      setAppStatusById(statusMap);
      setFavIds(new Set((favs??[]).map((f:any)=>f.announcement_id)));
      const annDates = Array.from(new Set(list.map(a => a.service_date).filter(Boolean))) as string[];
      if (annDates.length > 0) {
        const { data: excs } = await supabase
          .from("worker_availability_exceptions")
          .select("id, worker_id, date, is_available, time_slot, start_time, end_time, notes, city, province, district, latitude, longitude, radius_km")
          .eq("worker_id", user.id)
          .in("date", annDates);
        setSpecialExceptions((excs as AvailabilityExceptionRow[] | null) ?? []);
      } else {
        setSpecialExceptions([]);
      }
      // Disponibilità settimanale (sempre, indipendentemente dalle date).
      const { data: weekly } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("worker_id", user.id);
      setWeeklyAvailability((weekly as AvailabilityRow[] | null) ?? []);
    } else {
      setSpecialExceptions([]);
      setWeeklyAvailability([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const lat = profile?.service_area_lat, lng = profile?.service_area_lng;
    const max = maxKm ? Number(maxKm) : null;
    let out = items.filter(a => {
      if (roleF !== "any" && a.professional_profile !== roleF) return false;
      if (speedF !== "any" && a.speed !== speedF) return false;
      if (onlyNotApplied && appliedIds.has(a.id)) return false;
      if (onlyFav && !favIds.has(a.id)) return false;
      if (q) {
        const r = restaurantsById[a.restaurant_id];
        const loc = publicLocationLabel({ job_city: a.job_city, city: r?.city, neighborhood: r?.neighborhood });
        const s = `${loc} ${a.professional_profile||""} ${a.speed}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      if (max != null && lat != null && lng != null && a.location_lat != null && a.location_lng != null) {
        if (distKm(lat,lng,a.location_lat,a.location_lng) > max) return false;
      }
      return true;
    });
    if (sort === "pay") out = [...out].sort((a,b)=>b.tariff_amount-a.tariff_amount);
    if (sort === "date") out = [...out].sort((a,b)=>a.service_date.localeCompare(b.service_date));
    return out;
  }, [items, roleF, speedF, q, maxKm, onlyNotApplied, onlyFav, sort, profile, appliedIds, favIds, restaurantsById]);

  // Soft-matching: per ogni annuncio della lista calcoliamo la compatibilità
  // rispetto alla disponibilità del lavoratore (settimanale + eccezioni
  // speciali). NON è un filtro: gli annunci non compatibili restano
  // visibili. Serve solo per dare priorità in lista e per il badge.
  const compatById = useMemo(() => {
    const map: Record<string, "compatible" | "partial" | "unknown" | "incompatible" | "other_city"> = {};
    for (const a of items) {
      const dayExc = (specialExceptions ?? []).filter((e) => e.date === a.service_date);
      const block = computeSpecialAvailabilityBlock(specialExceptions, a);
      if (block?.blocked) {
        map[a.id] = "incompatible";
        continue;
      }
      const hasWeekly = (weeklyAvailability ?? []).length > 0;
      if (!hasWeekly && dayExc.length === 0) {
        map[a.id] = "unknown";
        continue;
      }
      const start = a.service_time ? a.service_time.slice(0, 5) : null;
      const end = a.end_time ? a.end_time.slice(0, 5) : null;
      const level = computeCompatibility(
        weeklyAvailability ?? [],
        dayExc,
        a.service_date,
        start,
        end,
        a.job_city ?? null,
      );
      if (level === "disponibile" || level === "compatibile") map[a.id] = "compatible";
      else if (level === "parziale") map[a.id] = "partial";
      else if (level === "non_disponibile") {
        // distinguiamo "altra città" da "fuori disponibilità oraria"
        const workerCities = new Set(
          (weeklyAvailability ?? [])
            .map((r) => (r.city ?? "").trim().toLowerCase())
            .filter(Boolean),
        );
        const annCity = (a.job_city ?? "").trim().toLowerCase();
        if (annCity && workerCities.size > 0 && !workerCities.has(annCity)) {
          map[a.id] = "other_city";
        } else {
          map[a.id] = "incompatible";
        }
      } else map[a.id] = "unknown";
    }
    return map;
  }, [items, weeklyAvailability, specialExceptions]);

  // Ordina la lista filtrata: prima compatibili, poi parziali/unknown,
  // poi non compatibili / altra città. Mai nascondere.
  const tier = (id: string): number => {
    const c = compatById[id];
    if (c === "compatible") return 0;
    if (c === "partial") return 1;
    if (c === "unknown") return 2;
    if (c === "other_city") return 3;
    return 4; // incompatible
  };
  const orderedFiltered = useMemo(() => {
    // Stable sort: applica solo se l'utente NON ha scelto un ordinamento
    // esplicito alternativo (pay/date). Per "recent" usiamo il sort di
    // affinità sopra l'ordine di arrivo già rispettato dalla query.
    if (sort !== "recent") return filtered;
    return [...filtered].sort((a, b) => tier(a.id) - tier(b.id));
  }, [filtered, compatById, sort]);
  const firstOtherIdx = useMemo(() => {
    if (sort !== "recent") return -1;
    const idx = orderedFiltered.findIndex((a) => tier(a.id) > 0);
    return idx;
  }, [orderedFiltered, compatById, sort]);
  const hasCompatibleHeader =
    sort === "recent" &&
    firstOtherIdx > 0 &&
    orderedFiltered.length - firstOtherIdx > 0;

  useEffect(() => {
    if (loading || !user) return;
    const counts = { compatible: 0, partial: 0, unknown: 0, other_city: 0, incompatible: 0 };
    for (const a of items) {
      const k = compatById[a.id] ?? "unknown";
      (counts as any)[k] = ((counts as any)[k] ?? 0) + 1;
    }
    const explicitFilters = {
      role: roleF !== "any" ? roleF : null,
      speed: speedF !== "any" ? speedF : null,
      max_km: maxKm || null,
      text: q || null,
      only_not_applied: onlyNotApplied,
      only_favorites: onlyFav,
      sort,
    };
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_VISIBILITY_NOT_HARD_FILTER_DEBUG]", {
      page: "trova_offerte",
      current_user_id: user.id,
      selected_filters: explicitFilters,
      worker_availability_city: (weeklyAvailability ?? []).map((r) => r.city).filter(Boolean),
      worker_extra_availability_city: (specialExceptions ?? []).map((e) => e.city).filter(Boolean),
      selected_announcement_city: null,
      hard_filters_applied: false,
      soft_matching_used: true,
      total_items_before_filters: items.length,
      total_items_after_filters: filtered.length,
      total_items_final_rendered: orderedFiltered.length,
    });
    // eslint-disable-next-line no-console
    console.log("[PUPILLO_WORKER_FIND_OFFERS_SOFT_MATCH_DEBUG]", {
      worker_user_id: user.id,
      worker_availability: (weeklyAvailability ?? []).map((r) => ({
        day_of_week: r.day_of_week, city: r.city, district: r.district,
      })),
      worker_extra_availability: (specialExceptions ?? []).map((e) => ({
        date: e.date, city: e.city, is_available: e.is_available,
      })),
      total_real_offers: items.length,
      offers_compatible: counts.compatible,
      offers_partial_or_unknown: counts.partial + counts.unknown,
      offers_other_city: counts.other_city,
      offers_not_compatible: counts.incompatible,
      offers_final_rendered: orderedFiltered.length,
      offer_excluded_reason: null, // mai escluse: filtro hard non applicato
    });
  }, [loading, user, items, filtered, orderedFiltered, compatById, weeklyAvailability, specialExceptions, roleF, speedF, maxKm, q, onlyNotApplied, onlyFav, sort]);

  const toggleFav = async (annId: string) => {
    if (!user) return;
    if (favIds.has(annId)) {
      await supabase.from("favorites").delete().eq("user_id",user.id).eq("announcement_id",annId);
      const n = new Set(favIds); n.delete(annId); setFavIds(n);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, announcement_id: annId });
      setFavIds(new Set(favIds).add(annId));
    }
  };

  const apply = (a: Ann) => {
    if (appliedIds.has(a.id)) {
      toast.info("Ti sei già candidato a questo turno.");
      return;
    }
    const block = computeSpecialAvailabilityBlock(specialExceptions, a);
    if (block?.blocked) {
      toast.error(SPECIAL_INCOMPATIBLE_MESSAGE);
      return;
    }
    setConfirmAnn(a);
  };

  const submitApplication = async () => {
    if (!user || !confirmAnn) return;
    if (appliedIds.has(confirmAnn.id)) {
      toast.info("Ti sei già candidato a questo turno.");
      setConfirmAnn(null);
      return;
    }
    // Safety re-check lato backend: rileggiamo le eccezioni per quella data
    // e blocchiamo se incompatibili, indipendentemente dallo stato in UI.
    const freshBlock = await fetchSpecialAvailabilityBlock(user.id, confirmAnn);
    if (freshBlock?.blocked) {
      toast.error(SPECIAL_INCOMPATIBLE_MESSAGE);
      setConfirmAnn(null);
      return;
    }
    const workerProfile = profile?.id === user.id
      ? profile
      : (await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()).data;
    if (!workerProfile?.id) {
      toast.error("Profilo lavoratore non trovato.");
      return;
    }
    const { data: availability } = await (supabase as any)
      .rpc("get_application_availability", { _announcement_id: confirmAnn.id })
      .maybeSingle();
    if (!availability?.restaurant_id) {
      toast.error("Turno non valido.");
      return;
    }
    const contact = await checkExistingContact({
      announcementId: confirmAnn.id,
      workerId: workerProfile.id,
    });
    if (contact.existing) {
      setConfirmAnn(null);
      setAlreadyContactAppId(contact.applicationId);
      return;
    }
    const needed = Math.max(1, Number(availability.workers_needed ?? workersNeededById[confirmAnn.id] ?? 1) || 1);
    const acceptedCount = Math.max(0, Number(availability.accepted_count ?? 0) || 0);
    if (acceptedCount >= needed) {
      toast.error("Turno già assegnato. Questo turno non è più disponibile perché tutte le posizioni sono già state assegnate.");
      setConfirmAnn(null);
      return;
    }
    // Validazione contro-offerta lato client
    let counterValueNum: number | null = null;
    if (applyMode === "counter") {
      const v = parseFloat(counterAmount.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        toast.error("Inserisci una tariffa valida.");
        return;
      }
      if (v <= (confirmAnn.tariff_amount ?? 0)) {
        toast.error(`La contro offerta deve essere superiore a € ${confirmAnn.tariff_amount}.`);
        return;
      }
      if (v > 100) {
        toast.error("Importo non valido (max € 100/h).");
        return;
      }
      counterValueNum = Math.round(v * 100) / 100;
    }
    setSubmitting(true);
    // PUPILLO: regola di OCCUPAZIONE — blocco hard candidatura su conflitto
    // con un turno già accettato dal lavoratore (buffer 1h post-fine).
    const conflict = await checkWorkerShiftConflict(workerProfile.id, confirmAnn as any);
    if (conflict) {
      setSubmitting(false);
      toast.error(CONFLICT_WORKER_APPLY_MESSAGE);
      return;
    }
    const insertPayload: any = {
      announcement_id: confirmAnn.id,
      worker_id: workerProfile.id,
      restaurant_id: confirmAnn.restaurant_id,
      status: "pending",
    };
    if (counterValueNum != null) {
      insertPayload.proposed_tariff = counterValueNum;
      insertPayload.worker_response_at = new Date().toISOString();
    }
    console.log("auth user id", user.id);
    console.log("worker profile id", workerProfile.id);
    console.log("worker profile user_id", (workerProfile as any).user_id);
    console.log("application payload", insertPayload);
    const { data: app, error } = await supabase.from("applications").insert(insertPayload).select("id").single();
    if (error) {
      setSubmitting(false);
      const msg = (error.message || "").toLowerCase();
      if (isDuplicateContactError(error) || msg.includes("duplicate") || msg.includes("unique")) {
        const contact = await checkExistingContact({
          announcementId: confirmAnn.id,
          workerId: workerProfile.id,
        });
        setAlreadyContactAppId(contact.existing ? contact.applicationId : null);
        return;
      }
      // Only claim the shift is full after confirming with fresh data — never
      // infer it from a generic RLS error.
      const { data: freshAvailability } = await (supabase as any)
        .rpc("get_application_availability", { _announcement_id: confirmAnn.id })
        .maybeSingle();
      const freshNeeded = Math.max(1, Number(freshAvailability?.workers_needed ?? needed) || 1);
      const freshAcceptedCount = Math.max(0, Number(freshAvailability?.accepted_count ?? 0) || 0);
      if (freshAcceptedCount >= freshNeeded) {
        return toast.error(
          freshNeeded > 1
            ? "Turno completo. Tutte le posizioni sono già state assegnate."
            : "Turno già assegnato. Questo turno non è più disponibile perché tutte le posizioni sono già state assegnate.",
        );
      }
      if (msg.includes("row-level security") || msg.includes("violates row-level")) {
        return toast.error("Errore autorizzazione candidatura. Controlla le policy Supabase della tabella applications.");
      }
      return toast.error(error.message);
    }
    // Notifica al ristoratore (best-effort)
    if (app?.id) {
      await supabase.from("notifications").insert({
        user_id: confirmAnn.restaurant_id,
        title: counterValueNum != null ? "Nuova contro offerta ricevuta" : "Nuova candidatura ricevuta",
        body: counterValueNum != null
          ? `Un lavoratore propone € ${counterValueNum}/h per uno dei tuoi turni.`
          : "Un lavoratore si è candidato per uno dei tuoi turni.",
        link: `/messages/${app.id}`,
      });
    }
    setAppliedIds(new Set(appliedIds).add(confirmAnn.id));
    setSubmitting(false);
    if (app?.id) {
      setSuccessApp({ id: app.id, ann: confirmAnn });
      toast.success("Candidatura inviata correttamente.");
    }
    setConfirmAnn(null);
    setOpenId(null);
    setApplyMode("accept");
    setCounterAmount("");
  };

  if (role && role !== "worker") {
    return <AppShell><p className="text-muted-foreground">Sezione riservata ai lavoratori.</p></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Trova offerte" subtitle="Esplora gli annunci attivi e candidati" />

      <div className="rounded-2xl border bg-card p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={roleF} onValueChange={setRoleF}>
            <SelectTrigger><SelectValue placeholder="Ruolo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi ruolo</SelectItem>
              {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={speedF} onValueChange={setSpeedF}>
            <SelectTrigger><SelectValue placeholder="Tipologia annuncio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutte le tipologie</SelectItem>
              {SPEEDS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Input type="number" placeholder="Distanza max" value={maxKm} onChange={e=>setMaxKm(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyNotApplied} onCheckedChange={v=>setOnlyNotApplied(!!v)} />
              Non candidato
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyFav} onCheckedChange={v=>setOnlyFav(!!v)} />
              Preferiti
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Parola chiave (città, ruolo…)" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <Select value={sort} onValueChange={(v)=>setSort(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Ordina per recenti</SelectItem>
              <SelectItem value="pay">Tariffa più alta</SelectItem>
              <SelectItem value="date">Data servizio</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border p-0.5">
            <Button size="sm" variant={view==="list"?"secondary":"ghost"} onClick={()=>setView("list")} className="gap-1"><List className="h-4 w-4" />Lista</Button>
            <Button size="sm" variant={view==="map"?"secondary":"ghost"} onClick={()=>setView("map")} className="gap-1"><MapIcon className="h-4 w-4" />Mappa</Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : orderedFiltered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Al momento non ci sono offerte disponibili. Torna più tardi o aggiorna i filtri.
        </div>
      ) : view === "list" ? (
        <div className="space-y-6">
        {(() => {
          const compatibles = hasCompatibleHeader
            ? orderedFiltered.slice(0, firstOtherIdx)
            : orderedFiltered;
          const others = hasCompatibleHeader
            ? orderedFiltered.slice(firstOtherIdx)
            : [];
          const renderCard = (a: Ann) => {
            const applied = appliedIds.has(a.id);
            const appStatus = appStatusById[a.id];
            const rejected = appStatus === "rejected" || appStatus === "not_interested";
            const fav = favIds.has(a.id);
            const role = a.professional_profile || "ruolo";
            const specialBlock = computeSpecialAvailabilityBlock(specialExceptions, a);
            const incompatibleSpecial = !!specialBlock?.blocked;
            const compatTag = compatById[a.id];
            const compatChip =
              compatTag === "compatible"
                ? { text: "Compatibile con la tua disponibilità", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
                : compatTag === "partial"
                ? { text: "Disponibilità parziale", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" }
                : compatTag === "other_city"
                ? { text: "Altra città", cls: "bg-muted text-foreground/70" }
                : compatTag === "incompatible"
                ? { text: "Fuori disponibilità", cls: "bg-muted text-foreground/70" }
                : null;
            const loc = publicLocationLabel({
              job_city: a.job_city,
              city: restaurantsById[a.restaurant_id]?.city,
              neighborhood: restaurantsById[a.restaurant_id]?.neighborhood,
            });
            const totalDisplay = formatTotalService(
              a.tariff_amount,
              a.tariff_type,
              a.duration_hours,
              a.service_time,
              null, // end_time non disponibile in Ann, usiamo duration_hours
            );
            const hourlyRate = a.tariff_type === "hourly" ? a.tariff_amount : null;
            return (
              <div
                key={a.id}
                className="group relative rounded-3xl border border-white/[0.06] bg-card p-5 shadow-[0_20px_50px_-30px_oklch(0_0_0/0.7)] transition-all hover:border-primary/30 hover:shadow-[0_28px_60px_-25px_oklch(0.65_0.25_310/0.35)]"
              >
                <button
                  type="button"
                  onClick={() => toggleFav(a.id)}
                  aria-label="Preferiti"
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/40 backdrop-blur transition-colors hover:bg-background/70"
                >
                  <Heart className={`h-5 w-5 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>

                <div className="flex items-start gap-4 pr-10">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 blur-md opacity-70" aria-hidden />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-background/60 text-2xl">
                      <span aria-hidden>{roleEmoji(a.professional_profile)}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold leading-tight capitalize truncate">{role}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${speedClasses(a.speed)}`}>
                        {speedLabel(a.speed)}
                      </span>
                      {compatChip && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${compatChip.cls}`}>
                          {compatChip.text}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ristorante partner</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">
                        {formatOfferDateTime({
                          service_date: a.service_date,
                          service_time: a.service_time,
                          end_date: a.end_date,
                          end_time: a.end_time,
                        })}
                      </span>
                      <span className="text-muted-foreground">· Durata {a.duration_hours}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                      <span className="truncate">{loc}</span>
                    </div>
                  </div>

                  {totalDisplay ? (
                    <div className="flex flex-col items-start gap-0.5 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:items-end sm:text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                        Totale servizio
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-extrabold tracking-tight text-primary tabular-nums">
                          {totalDisplay}
                        </span>
                      </div>
                      {hourlyRate != null && (
                        <span className="text-[10px] text-primary/70">
                          Calcolato su €{hourlyRate}/ora per {a.duration_hours}h
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-start gap-1 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:justify-end">
                      <Euro className="h-4 w-4 text-primary" />
                      <span className="text-xl font-extrabold tracking-tight text-primary tabular-nums">
                        {formatTariff(a.tariff_amount, a.tariff_type)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {(() => {
                    const need = workersNeededById[a.id] ?? 1;
                    const filled = filledById[a.id] ?? 0;
                    if (need <= 1) return null;
                    const remaining = Math.max(0, need - filled);
                    return (
                      <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
                        {remaining > 0 ? `${remaining}/${need} posti disponibili` : "Turno completo"}
                      </span>
                    );
                  })()}
                  {rejected ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                      <XCircle className="h-4 w-4" />
                      Candidatura rifiutata
                    </div>
                  ) : applied ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Candidatura inviata
                    </div>
                  ) : incompatibleSpecial ? (
                    <div className="flex-1 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      <div className="font-semibold inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Non compatibile con la tua disponibilità speciale
                      </div>
                      {specialBlock?.specials.map((e) => (
                        <p key={e.id} className="mt-0.5 opacity-90">· {describeSpecialAvailability(e)}</p>
                      ))}
                    </div>
                  ) : (
                    <Button size="lg" className="flex-1 rounded-xl gap-2" onClick={() => apply(a)}>
                      <Send className="h-4 w-4" />
                      Candidati
                    </Button>
                  )}
                  <Button size="lg" variant="outline" className="rounded-xl" onClick={() => setOpenId(a.id)}>
                    Dettagli
                  </Button>
                </div>
              </div>
            );
          };
          return (
            <>
              {hasCompatibleHeader && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Offerte compatibili con la tua disponibilità
                    <span className="text-xs font-normal text-muted-foreground">({compatibles.length})</span>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">{compatibles.map(renderCard)}</div>
                </section>
              )}
              <section>
                {hasCompatibleHeader && (
                  <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    Altre offerte disponibili
                    <span className="text-xs font-normal text-muted-foreground">({others.length})</span>
                  </h3>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {(hasCompatibleHeader ? others : compatibles).map(renderCard)}
                </div>
              </section>
            </>
          );
        })()}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-2">
          <div className="p-8 text-center text-muted-foreground text-sm">
            La mappa con la posizione esatta è disponibile solo dopo la conferma del turno.<br />
            Usa la vista lista per esplorare le offerte per zona.
          </div>
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o)=>!o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (() => {
            const applied = appliedIds.has(selected.id);
            const appStatus = appStatusById[selected.id];
            const rejected = appStatus === "rejected" || appStatus === "not_interested";
            const fav = favIds.has(selected.id);
            const selectedBlock = computeSpecialAvailabilityBlock(specialExceptions, selected);
            const selectedIncompatible = !!selectedBlock?.blocked;
            const dist = (profile?.service_area_lat != null && profile?.service_area_lng != null && selected.location_lat != null && selected.location_lng != null)
              ? distKm(profile.service_area_lat, profile.service_area_lng, selected.location_lat, selected.location_lng) : null;
            const selectedTotal = formatTotalService(
              selected.tariff_amount,
              selected.tariff_type,
              selected.duration_hours,
              selected.service_time,
              null,
            );
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="capitalize">{selected.professional_profile || "Offerta di lavoro"}</SheetTitle>
                  <SheetDescription>
                    {restaurant?.business_name || restaurant?.full_name || "Ristoratore"}
                    {restaurant?.rating_avg ? ` · ★ ${restaurant.rating_avg}` : ""}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">{selected.speed}</span>
                  <span className="rounded-full bg-accent text-accent-foreground px-2 py-1 text-xs">{selected.duration_hours}h</span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">{selectedTotal ?? formatTariff(selected.tariff_amount, selected.tariff_type)}</span>
                  {dist != null && <span className="rounded-full bg-muted px-2 py-1 text-xs">{dist.toFixed(1)} km</span>}
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <Row icon={Calendar} label="Data" value={new Date(selected.service_date).toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long", year:"numeric" })} />
                  <Row icon={Clock} label="Orario" value={`${selected.service_time?.slice(0,5)} · durata ${selected.duration_hours}h`} />
                  <Row icon={Euro} label="Compenso" value={selectedTotal ?? formatTariff(selected.tariff_amount, selected.tariff_type)} detail={selectedTotal && selected.tariff_type === "hourly" ? `€${selected.tariff_amount}/ora × ${selected.duration_hours}h` : undefined} />
                  <Row icon={Zap} label="Tipologia" value={selected.speed} />
                  <Row icon={MapPin} label="Zona" value={publicLocationLabel({ job_city: selected.job_city, city: restaurant?.city, neighborhood: restaurant?.neighborhood })} />
                  {restaurant?.venue_type && <Row icon={User} label="Locale" value={restaurant.venue_type} />}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{PRECISE_ADDRESS_HINT}</p>

                {(() => {
                  const skills = (selected.required_skills ?? []).filter(Boolean);
                  const dressItems = (selected.dress_code_items ?? []).filter(Boolean);
                  const dressNotes = (selected.dress_code_notes ?? "").trim();
                  const langs = (selected.language_requirements ?? []).filter(Boolean);
                  const license = (selected.license_requirement ?? "").trim();
                  const opsParts = [selected.notes, selected.job_location_notes, selected.job_additional_directions, selected.job_access_restrictions]
                    .map((s) => (s ?? "").trim()).filter(Boolean);
                  const need = workersNeededById[selected.id] ?? 1;
                  const filled = filledById[selected.id] ?? 0;
                  const endLabel = (() => {
                    if (selected.end_time) return selected.end_time.slice(0, 5);
                    if (!selected.service_time) return null;
                    const [h, m] = selected.service_time.split(":").map(Number);
                    const total = h * 60 + (m || 0) + Math.round((selected.duration_hours || 0) * 60);
                    const eh = Math.floor(total / 60) % 24;
                    const em = total % 60;
                    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
                  })();
                  const statusLabel =
                    selected.status === "active" ? "Annuncio attivo" :
                    selected.status === "completed" ? "Turno completo" :
                    selected.status === "cancelled" ? "Annuncio annullato" :
                    selected.status === "expired" ? "Annuncio scaduto" : selected.status;
                  console.log("[PUPILLO_WORKER_ANNOUNCEMENT_DETAILS_DEBUG]", {
                    worker_user_id: user?.id ?? null,
                    announcement_id: selected.id,
                    job_request_id: null,
                    shift_id: null,
                    status: selected.status,
                    has_application: applied,
                    application_status: appStatus ?? null,
                    workers_needed: need,
                    workers_filled: filled,
                    end_label: endLabel,
                    privacy_hidden: ["indirizzo_preciso", "referente_completo", "telefono_diretto"],
                    shown_before_confirm: {
                      role: selected.professional_profile,
                      city: selected.job_city ?? restaurant?.city ?? null,
                      zone: restaurant?.neighborhood ?? null,
                      dress_code_items: dressItems,
                      required_skills: skills,
                      languages: langs,
                      license,
                      notes_count: opsParts.length,
                    },
                  });
                  return (
                    <div className="mt-5 space-y-4 text-sm">
                      {endLabel && (
                        <Row icon={Clock} label="Fine turno" value={endLabel} />
                      )}
                      {need > 1 && (
                        <Row icon={User} label="Posti" value={`${Math.max(0, need - filled)} disponibili su ${need}`} />
                      )}

                      {skills.length > 0 && (
                        <section>
                          <div className="font-semibold text-foreground mb-1.5">Mansioni richieste</div>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((s) => (
                              <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{s}</span>
                            ))}
                          </div>
                        </section>
                      )}

                      {(dressItems.length > 0 || dressNotes) && (
                        <section>
                          <div className="font-semibold text-foreground mb-1.5">Dress code</div>
                          {dressItems.length > 0 && (
                            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                              {dressItems.map((d) => <li key={d}>{d}</li>)}
                            </ul>
                          )}
                          {dressNotes && <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{dressNotes}</p>}
                        </section>
                      )}

                      {(langs.length > 0 || license) && (
                        <section>
                          <div className="font-semibold text-foreground mb-1.5">Requisiti</div>
                          {langs.length > 0 && (
                            <p className="text-muted-foreground"><span className="text-foreground">Lingue:</span> {langs.join(", ")}</p>
                          )}
                          {license && (
                            <p className="text-muted-foreground"><span className="text-foreground">Patente:</span> {license}</p>
                          )}
                        </section>
                      )}

                      {opsParts.length > 0 && (
                        <section>
                          <div className="font-semibold text-foreground mb-1.5">Istruzioni servizio</div>
                          <div className="space-y-1 text-muted-foreground">
                            {opsParts.map((p, i) => (
                              <p key={i} className="whitespace-pre-wrap">{p}</p>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground/80">
                            Indirizzo preciso, referente e contatti diretti saranno visibili dopo la conferma del turno.
                          </p>
                        </section>
                      )}

                      <section>
                        <div className="font-semibold text-foreground mb-1.5">Stato</div>
                        <p className="text-muted-foreground">
                          {statusLabel}
                          {applied ? " · Candidatura già inviata" : ""}
                        </p>
                      </section>
                    </div>
                  );
                })()}

                <div className="mt-6 flex gap-2 sticky bottom-0 bg-background pt-3">
                  <Button variant="outline" size="icon" onClick={()=>toggleFav(selected.id)} aria-label="Preferiti">
                    <Heart className={`h-5 w-5 ${fav?"fill-primary text-primary":""}`} />
                  </Button>
                  {rejected ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                      <XCircle className="h-4 w-4" />
                      Candidatura rifiutata
                    </div>
                  ) : applied ? (
                    <Button disabled variant="secondary" className="flex-1">Candidatura già inviata</Button>
                  ) : selectedIncompatible ? (
                    <div className="flex-1 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      <div className="font-semibold inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Non compatibile con la tua disponibilità speciale
                      </div>
                      {selectedBlock?.specials.map((e) => (
                        <p key={e.id} className="mt-0.5 opacity-90">· {describeSpecialAvailability(e)}</p>
                      ))}
                    </div>
                  ) : (
                    <Button className="flex-1 gap-2" onClick={()=>apply(selected)}><Send className="h-4 w-4" />Candidati ora</Button>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <ApplyConfirmDialog
        ann={confirmAnn}
        restaurantInfo={confirmAnn ? restaurantsById[confirmAnn.restaurant_id] : undefined}
        submitting={submitting}
        applyMode={applyMode}
        setApplyMode={setApplyMode}
        counterAmount={counterAmount}
        setCounterAmount={setCounterAmount}
        onCancel={() => { if (!submitting) { setConfirmAnn(null); setApplyMode("accept"); setCounterAmount(""); } }}
        onConfirm={submitApplication}
      />

      <SuccessDialog
        open={!!successApp}
        onClose={() => setSuccessApp(null)}
        onGoToApplications={() => { const id = successApp?.id; setSuccessApp(null); if (id) navigate({ to: "/messages/$id", params: { id } }); }}
      />
      <AlreadyInContactDialog
        open={!!alreadyContactAppId}
        applicationId={alreadyContactAppId}
        onClose={() => setAlreadyContactAppId(null)}
      />
    </AppShell>
  );
}

function isNightShift(time?: string | null) {
  if (!time) return false;
  const h = Number(time.slice(0, 2));
  return h >= 20 || h < 6;
}

function ApplyConfirmDialog({
  ann, restaurantInfo, submitting, applyMode, setApplyMode, counterAmount, setCounterAmount, onCancel, onConfirm,
}: {
  ann: Ann | null;
  restaurantInfo?: { city: string | null; neighborhood: string | null };
  submitting: boolean;
  applyMode: "accept" | "counter";
  setApplyMode: (m: "accept" | "counter") => void;
  counterAmount: string;
  setCounterAmount: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const night = ann ? isNightShift(ann.service_time) : false;
  const long = !!(ann && (ann.duration_hours ?? 0) >= 8);
  const startH = ann?.service_time?.slice(0, 5) ?? "—";
  const endLabel = (() => {
    if (!ann?.service_time) return "—";
    const [h, m] = ann.service_time.split(":").map(Number);
    const total = h * 60 + (m || 0) + Math.round((ann.duration_hours || 0) * 60);
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  })();
  const zone = ann ? publicLocationLabel({ job_city: ann.job_city, city: restaurantInfo?.city, neighborhood: restaurantInfo?.neighborhood }) : "";
  const totalDisplay = ann ? formatTotalService(
    ann.tariff_amount,
    ann.tariff_type,
    ann.duration_hours,
    ann.service_time,
    null,
  ) : null;
  const dressCodeItems = (ann?.dress_code_items ?? []).filter(Boolean);
  const requiredSkills = (ann?.required_skills ?? []).filter(Boolean);
  const languageReqs = (ann?.language_requirements ?? []).filter(Boolean);
  const operationalNotes = [ann?.notes, ann?.job_location_notes, ann?.job_additional_directions, ann?.job_access_restrictions]
    .map((s) => (s ?? "").trim()).filter(Boolean);

  return (
    <Dialog open={!!ann} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)] animate-scale-in max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Confermi la candidatura?</DialogTitle>
            <DialogDescription className="text-sm">
              Controlla i dettagli del turno prima di inviare la candidatura.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1">
        {ann && (
          <div className="px-6 pb-2 space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-base font-semibold capitalize">
                <User className="h-4 w-4 text-primary" />
                {ann.professional_profile || "Ruolo"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /><span className="truncate">{zone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /><span>{startH} → {endLabel} · {ann.duration_hours}h</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" /><span>{new Date(ann.service_date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              {totalDisplay ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-lg font-extrabold text-primary">
                    {totalDisplay}
                  </div>
                  {ann.tariff_type === "hourly" && (
                    <div className="text-xs text-muted-foreground pl-7">
                      Calcolato su €{ann.tariff_amount}/ora per {ann.duration_hours}h
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Euro className="h-4 w-4 text-primary" />{formatTariff(ann.tariff_amount, ann.tariff_type)}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                Ristorante partner · Locale verificato
              </div>
            </div>
            {(night || long) && (
              <div className="flex flex-wrap gap-2">
                {night && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-300 dark:text-indigo-300 text-xs px-2.5 py-1 font-medium">
                    <Moon className="h-3 w-3" />Turno notturno
                  </span>
                )}
                {long && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs px-2.5 py-1 font-medium">
                    <Hourglass className="h-3 w-3" />Turno lungo
                  </span>
                )}
              </div>
            )}

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dress code</div>
              {dressCodeItems.length > 0 || ann.dress_code_notes ? (
                <>
                  {dressCodeItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {dressCodeItems.map((d) => (
                        <span key={d} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{d}</span>
                      ))}
                    </div>
                  )}
                  {ann.dress_code_notes && <div className="text-muted-foreground">{ann.dress_code_notes}</div>}
                </>
              ) : (
                <div className="text-muted-foreground">Non specificato dal ristoratore.</div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando presentarsi</div>
              <div className="text-muted-foreground">
                Ti consigliamo di presentarti almeno 10 minuti prima dell'orario di ingresso.
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mansioni</div>
              <div className="text-muted-foreground capitalize">
                {ann.professional_profile || "Mansioni standard del ruolo."}
              </div>
            </div>

            {(requiredSkills.length > 0 || languageReqs.length > 0 || ann.license_requirement) && (
              <div className="rounded-xl border bg-card p-3 text-sm space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisiti</div>
                {requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {requiredSkills.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{s}</span>
                    ))}
                  </div>
                )}
                {languageReqs.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Lingue: <span className="text-foreground">{languageReqs.join(", ")}</span>
                  </div>
                )}
                {ann.license_requirement && (
                  <div className="text-xs text-muted-foreground">
                    Patente/mezzo: <span className="text-foreground">{ann.license_requirement}</span>
                  </div>
                )}
              </div>
            )}

            {operationalNotes.length > 0 && (
              <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note operative</div>
                {operationalNotes.map((n, i) => (
                  <div key={i} className="text-muted-foreground whitespace-pre-wrap">{n}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {ann && (
          <div className="px-6 pb-2 space-y-2">
            <Label className="text-sm font-medium">Vuoi candidarti alla tariffa proposta o fare una contro offerta?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setApplyMode("accept")}
                className={`rounded-xl border p-3 text-left transition ${applyMode === "accept" ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:bg-muted/40"}`}
              >
                <div className="text-xs text-muted-foreground">Accetta tariffa</div>
                <div className="font-semibold text-sm mt-0.5">€ {ann.tariff_amount} {ann.tariff_type === "hourly" ? "/h" : ""}</div>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setApplyMode("counter")}
                className={`rounded-xl border p-3 text-left transition ${applyMode === "counter" ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:bg-muted/40"}`}
              >
                <div className="text-xs text-muted-foreground">Fai contro offerta</div>
                <div className="font-semibold text-sm mt-0.5">Proponi tariffa</div>
              </button>
            </div>
            {applyMode === "counter" && (
              <div className="pt-1 animate-fade-in">
                <Label className="text-xs text-muted-foreground">La tua tariffa (EUR/h)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={ann.tariff_amount + 0.01}
                    max={100}
                    step="0.5"
                    placeholder={`min € ${ann.tariff_amount + 1}`}
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    disabled={submitting}
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR/h</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deve essere superiore a € {ann.tariff_amount}. Massimo € 100/h.
                </p>
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="sm:flex-1">
            Annulla
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="sm:flex-1 gap-2 shadow-lg shadow-primary/30">
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Invio candidatura…</>) : (<><Send className="h-4 w-4" />Invia candidatura</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessDialog({ open, onClose, onGoToApplications }: { open: boolean; onClose: () => void; onGoToApplications: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md text-center p-8 border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.5)] animate-scale-in">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mb-2 animate-fade-in">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Candidatura inviata</DialogTitle>
          <DialogDescription className="text-base">
            Il ristoratore riceverà subito la tua disponibilità.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="sm:flex-1">Continua a cercare</Button>
          <Button onClick={onGoToApplications} className="sm:flex-1 shadow-lg shadow-primary/30">Vai alle mie candidature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value, detail }: { icon: typeof Calendar; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="capitalize">{value}</div>
        {detail && <div className="text-xs text-muted-foreground/70">{detail}</div>}
      </div>
    </div>
  );
}