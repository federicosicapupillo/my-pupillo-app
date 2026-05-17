import { createFileRoute } from "@tanstack/react-router";
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
import { Coins, AlertCircle, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SpokenLanguagesView, normalizeSpokenLanguages, LANGUAGE_OPTIONS, type SpokenLanguage } from "@/components/SpokenLanguages";
import { useRequiredReviews } from "@/lib/required-reviews";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { sendShiftProposal } from "@/lib/shift-proposal";
import { getLastAnnouncementId, setLastAnnouncementId } from "@/lib/last-announcement";
import { getShiftStartDate } from "@/lib/announcement-time";

export const Route = createFileRoute("/workers")({
  head: () => ({ meta: [{ title: "Cerca lavoratori — Pupillo" }] }),
  component: () => <RequireAuth><WorkersPage /></RequireAuth>,
});

type W = {
  id: string;
  full_name: string | null;
  age: number | null;
  languages: string[] | null;
  spoken_languages: any;
  professional_profile: string | null;
  short_bio: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  city: string | null;
  neighborhood: string | null;
  province: string | null;
  badge: string | null;
  rating_avg: number | null;
  reliability_pct: number | null;
  no_shows: number | null;
  weekly_availability: string[] | null;
  last_active_at: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  service_area_radius_m: number | null;
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
type Ann = { id: string; service_date: string; service_time: string | null; location_address: string; location_lat: number | null; location_lng: number | null };

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

function WorkersPage() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const { isBlocked, blockedCount, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [workers, setWorkers] = useState<W[]>([]);
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

  // Carica TUTTI i lavoratori attivi una sola volta. I filtri lavorano poi lato client.
  const loadWorkers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, age, languages, spoken_languages, professional_profile, short_bio, primary_role, secondary_roles, city, neighborhood, province, badge, rating_avg, reliability_pct, no_shows, weekly_availability, last_active_at, service_area_lat, service_area_lng, service_area_radius_m")
        .eq("account_status", "active")
        .order("last_active_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setWorkers((data as W[]) ?? []);
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
        const { data } = await supabase.from("announcements").select("id, service_date, service_time, location_address, location_lat, location_lng").eq("restaurant_id", user.id).eq("status", "active");
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
      }
    })();
  }, [user]);

  // Carica tutti i lavoratori all'apertura della pagina
  useEffect(() => {
    if (role === "restaurant") {
      void loadWorkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Carica le relazioni ristoratore ↔ lavoratori (turni, candidature, proposte, recensioni)
  useEffect(() => {
    if (role !== "restaurant" || !user) return;
    let cancelled = false;
    (async () => {
      const [appsRes, shiftsRes, reviewsRes] = await Promise.all([
        supabase
          .from("applications")
          .select("id, worker_id, status, last_message_at, created_at")
          .eq("restaurant_id", user.id),
        supabase
          .from("shifts")
          .select("worker_id, status, shift_date")
          .eq("restaurant_id", user.id),
        supabase
          .from("reviews")
          .select("target_id, created_at, rating")
          .eq("author_id", user.id),
      ]);
      const apps = (appsRes.data as Array<{ id: string; worker_id: string; status: string | null; last_message_at: string | null; created_at: string }>) ?? [];
      const shifts = (shiftsRes.data as Array<{ worker_id: string; status: string | null; shift_date: string | null }>) ?? [];
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
        const resp = respByApp[a.id];
        if (resp) {
          if (resp.status === "accepted") r.hasAccepted = true;
          if (resp.status === "rejected") r.hasRejected = true;
          r.latestResponseAt = Math.max(r.latestResponseAt, new Date(resp.created_at).getTime());
          r.latestResponseStatus = r.latestResponseAt === new Date(resp.created_at).getTime() ? resp.status : r.latestResponseStatus;
        } else if (a.status === "pending") {
          r.hasPending = true;
        }
        map[a.worker_id] = r;
      }
      // Turni completati
      for (const s of shifts) {
        const r = map[s.worker_id] ?? emptyRel();
        if (s.status === "completed") r.workedWith = true;
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
      if (!cancelled) setRel(map);
    })();
    return () => { cancelled = true; };
  }, [role, user?.id]);

  if (role !== "restaurant") return <AppShell><p>Solo i ristoratori.</p></AppShell>;

  const invite = async (workerId: string) => {
    if (!selected || !user) { toast.error("Seleziona prima un annuncio"); return; }
    // If a conversation already exists for this restaurant + worker + announcement, just open it.
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("announcement_id", selected)
      .eq("worker_id", workerId)
      .eq("restaurant_id", user.id)
      .maybeSingle();
    if (existing?.id) {
      // Send a fresh proposal each time the restaurant re-contacts.
      await sendShiftProposal({
        applicationId: existing.id,
        announcementId: selected,
        restaurantId: user.id,
        workerId: workerId,
      });
      nav({ to: "/messages/$id", params: { id: existing.id } });
      return;
    }
    const { data: created, error } = await supabase
      .from("applications")
      .insert({ announcement_id: selected, worker_id: workerId, restaurant_id: user.id, status: "pending" })
      .select("id")
      .single();
    if (error || !created) { toast.error(error?.message ?? "Errore"); return; }
    await sendShiftProposal({
      applicationId: created.id,
      announcementId: selected,
      restaurantId: user.id,
      workerId: workerId,
    });
    await supabase.from("notifications").insert({ user_id: workerId, title: "Nuova offerta di lavoro", body: "Un ristoratore ti ha contattato.", link: `/messages/${created.id}` });
    toast.success("Chat aperta con il lavoratore");
    nav({ to: "/messages/$id", params: { id: created.id } });
  };

  const fieldsOf = (w: W) => {
    const fullName = (w.full_name ?? "").toLowerCase();
    const [first = "", ...rest] = fullName.split(" ");
    return {
      fullName,
      first,
      last: rest.join(" "),
      title: (w.professional_profile ?? "").toLowerCase(),
      description: (w.short_bio ?? "").toLowerCase(),
      roles: [w.primary_role ?? "", ...(w.secondary_roles ?? [])].join(" ").toLowerCase(),
      langs: [
        ...normalizeSpokenLanguages(w.spoken_languages).map((s) => s.language),
        ...(w.languages ?? []),
      ].join(" ").toLowerCase(),
      city: (w.city ?? "").toLowerCase(),
      zone: (w.neighborhood ?? "").toLowerCase(),
      province: (w.province ?? "").toLowerCase(),
      badge: (w.badge ?? "").toLowerCase(),
      availability: (w.weekly_availability ?? []).join(" ").toLowerCase(),
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
      case "role": return s === "altro ruolo" || (roleAliases[s] ?? [s]).some((alias) => f.roles.includes(alias));
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
        if (s === "affidabilità 80%+") return (w.reliability_pct ?? 0) >= 80;
        if (s === "affidabilità 90%+") return (w.reliability_pct ?? 0) >= 90;
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
    const t = term.toLowerCase().trim();
    const f = fieldsOf(w);
    const allText = [f.fullName, f.title, f.description, f.roles, f.langs, f.city, f.zone, f.province, f.badge, f.availability].join(" ");
    if (cat === "name_profile") {
      switch (sub) {
        case "Nome": return f.first.includes(t);
        case "Cognome": return f.last.includes(t);
        case "Nome completo": return f.fullName.includes(t);
        case "Titolo profilo": return f.title.includes(t);
        case "Descrizione profilo": return f.description.includes(t);
        default: return (f.fullName + " " + f.title + " " + f.description).includes(t);
      }
    }
    if (cat === "role") return (f.roles + " " + f.fullName).includes(t);
    if (cat === "skill") return (f.title + " " + f.description + " " + f.fullName + " " + f.city).includes(t);
    if (cat === "language") return (f.langs + " " + f.city + " " + f.title).includes(t);
    if (cat === "location") {
      switch (sub) {
        case "Città": return f.city.includes(t);
        case "Zona / Quartiere": return f.zone.includes(t);
        case "Provincia": return f.province.includes(t);
        default: return (f.city + " " + f.zone + " " + f.province).includes(t);
      }
    }
    if (cat === "badge") return (f.badge + " " + f.fullName + " " + f.roles).includes(t);
    if (cat === "availability") return (f.availability + " " + f.fullName + " " + f.roles).includes(t);
    return allText.includes(t); // all + custom
  };

  const q = qInput.trim();
  const hasActiveFilters = category !== "all" || !!subcategory || !!q || !!lang;
  const filtered = workers.filter((worker) => {
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
  };
  const onChangeCategory = (c: Category) => { setCategory(c); setSubcategory(""); };
  const removeCategoryChip = () => { setCategory("all"); setSubcategory(""); };
  const removeSubChip = () => setSubcategory("");
  const removeQChip = () => setQInput("");
  const removeLangChip = () => setLang("");


  const selectedAnn = anns.find((a) => a.id === selected);
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
  const sorted = [...distFiltered].sort((a, b) => {
    // Ordinamento personale per ristoratore: priorità a chi è già stato
    // contattato / ha già lavorato con questo ristoratore. I filtri di
    // ordinamento espliciti (subcategoria di "Tutto") vincono.
    if (category === "all") {
      if (subcategory === "Ultimi attivi") return (new Date(b.last_active_at ?? 0).getTime()) - (new Date(a.last_active_at ?? 0).getTime());
      if (subcategory === "Miglior rating") return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
      if (subcategory === "Più affidabili") return (b.reliability_pct ?? 0) - (a.reliability_pct ?? 0);
    }
    const ra = rel[a.id]; const rb = rel[b.id];
    const ta = tierOf(ra, a.rating_avg); const tb = tierOf(rb, b.rating_avg);
    if (ta !== tb) return ta - tb;
    // dentro lo stesso gruppo: ultimo contatto più recente, poi rating, poi in zona
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
            <option value="">Nessun annuncio attivo</option>
            {anns.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(a.service_date).toLocaleDateString("it-IT")}
                {a.location_address ? ` · ${a.location_address}` : ""}
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
          fallbackCenter={
            selectedAnn?.location_lat != null && selectedAnn?.location_lng != null
              ? [selectedAnn.location_lat as number, selectedAnn.location_lng as number]
              : [41.9028, 12.4964]
          }
          onInvite={invite}
          inviteDisabled={!selected}
          inviteLabel={selected ? "Messaggia" : "Seleziona annuncio"}
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
                  const near = inRange(w);
                  const r = rel[w.id];
                  return (
          <div key={w.id} className={`rounded-2xl border p-5 ${near ? "border-emerald-500/50 bg-emerald-500/5" : "bg-card"}`}>
            <div className="flex items-center gap-3">
              <UserAvatar userId={w.id} name={w.full_name} className="h-12 w-12" />
              <div>
                <div className="font-semibold">{w.full_name || "Lavoratore"}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {w.primary_role && <span className="capitalize">{w.primary_role}</span>}
                  {w.rating_avg != null && Number(w.rating_avg) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-600">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="tabular-nums font-medium">{Number(w.rating_avg).toFixed(1)}</span>
                    </span>
                  )}
                  {w.age && <span>· {w.age} anni</span>}
                </div>
              </div>
              {near && <span className="ml-auto text-[10px] rounded-full bg-emerald-500/20 text-emerald-700 px-2 py-0.5 font-medium">In zona</span>}
            </div>
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
                {w.city
                  ? `${w.city}${w.neighborhood ? ` · ${w.neighborhood}` : ""}`
                  : "Città non indicata"}
              </span>
            </div>
            {(() => {
              const langs: SpokenLanguage[] = normalizeSpokenLanguages(w.spoken_languages);
              const legacy = (langs.length === 0 ? (w.languages ?? []).map(l => ({ language: l })) : langs);
              return legacy.length > 0 ? (
                <div className="mt-2"><SpokenLanguagesView value={legacy} /></div>
              ) : null;
            })()}
            <Button
              size="sm"
              className="mt-4 w-full gap-1"
              onClick={() => invite(w.id)}
              disabled={!selected}
              title={!selected ? "Seleziona prima un annuncio" : undefined}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {selected ? "Chatta" : "Seleziona prima un annuncio"}
            </Button>
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

function WorkersMapSection({
  workers,
  fallbackCenter,
  onInvite,
  inviteDisabled,
  inviteLabel,
}: {
  workers: W[];
  fallbackCenter: [number, number];
  onInvite: (workerId: string) => void;
  inviteDisabled: boolean;
  inviteLabel: string;
}) {
  const located = workers.filter(
    (w) => w.service_area_lat != null && w.service_area_lng != null,
  );
  const ids = located.map((w) => w.id);
  const avatars = useAvatarUrls(ids);
  const points: WorkerMapPoint[] = located.map((w) => ({
    id: w.id,
    lat: w.service_area_lat as number,
    lng: w.service_area_lng as number,
    name: w.full_name,
    role: w.primary_role,
    city: w.city ?? w.neighborhood ?? null,
    rating: w.rating_avg != null && Number(w.rating_avg) > 0 ? Number(w.rating_avg) : null,
    badge: w.badge,
    avatarUrl: avatars[w.id] ?? null,
    initials: initialsOf(w.full_name),
    link: `/workers_/${w.id}`,
  }));
  const center: [number, number] =
    points.length > 0 ? [points[0].lat, points[0].lng] : fallbackCenter;
  return (
    <div className="rounded-2xl border bg-card p-2">
      <WorkersMap
        points={points}
        center={center}
        height={480}
        onInvite={onInvite}
        inviteDisabled={inviteDisabled}
        inviteLabel={inviteLabel}
      />
      <div className="p-3 text-xs text-muted-foreground">
        {points.length === 0
          ? "Nessun lavoratore con posizione disponibile per la mappa."
          : `${points.length} lavorator${points.length === 1 ? "e" : "i"} sulla mappa. La zona è approssimativa: non vengono mostrati indirizzi privati.`}
      </div>
    </div>
  );
}