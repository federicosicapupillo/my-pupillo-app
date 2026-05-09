import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, List, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { CREDIT_COSTS } from "@/lib/pricing";
import { Coins, AlertCircle, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SpokenLanguagesView, normalizeSpokenLanguages, LANGUAGE_OPTIONS, type SpokenLanguage } from "@/components/SpokenLanguages";

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
type Ann = { id: string; service_date: string; location_address: string; location_lat: number | null; location_lng: number | null };

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
  const [workers, setWorkers] = useState<W[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [category, setCategory] = useState<Category>("all");
  const [subcategory, setSubcategory] = useState<string>("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  // Draft (form) state — committed only on "Cerca"
  const [catDraft, setCatDraft] = useState<Category>("all");
  const [subDraft, setSubDraft] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [lang, setLang] = useState("");
  const [langDraft, setLangDraft] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  const runSearch = async (overrides?: { category?: Category; subcategory?: string; text?: string; language?: string }) => {
    const nextCategory = overrides?.category ?? catDraft;
    const nextSubcategory = overrides?.subcategory ?? subDraft;
    const nextText = overrides?.text ?? qInput;
    const nextLanguage = overrides?.language ?? langDraft;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, age, languages, spoken_languages, professional_profile, short_bio, primary_role, secondary_roles, city, neighborhood, province, badge, rating_avg, reliability_pct, no_shows, weekly_availability, last_active_at, service_area_lat, service_area_lng, service_area_radius_m")
        .eq("account_status", "active")
        .not("primary_role", "is", null)
        .order("last_active_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const results = ((data as W[]) ?? []).filter((worker) => {
        if (!matchesSubcategory(worker, nextCategory, nextSubcategory)) return false;
        if (!matchesText(worker, nextText, nextCategory, nextSubcategory)) return false;
        if (nextLanguage) {
          const spoken = normalizeSpokenLanguages(worker.spoken_languages).map((item) => item.language.toLowerCase());
          const legacy = (worker.languages ?? []).map((item) => item.toLowerCase());
          if (![...spoken, ...legacy].some((item) => item.includes(nextLanguage.toLowerCase()))) return false;
        }
        return true;
      });
      setWorkers((results as W[]) ?? []);
      setCategory(nextCategory);
      setSubcategory(nextSubcategory);
      setQ(nextText);
      setLang(nextLanguage);
      setHasSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante la ricerca lavoratori");
      setWorkers([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (user) {
        await runSearch({ category: "all", subcategory: "", text: "", language: "" });
        const { data } = await supabase.from("announcements").select("id, service_date, location_address, location_lat, location_lng").eq("restaurant_id", user.id).eq("status", "active");
        setAnns((data as Ann[]) ?? []);
        if (data?.[0]) setSelected(data[0].id);
      }
    })();
  }, [user]);

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
      nav({ to: "/messages/$id", params: { id: existing.id } });
      return;
    }
    const { consumeCredits } = await import("@/lib/credits");
    const { CREDIT_COSTS } = await import("@/lib/pricing");
    const ok = await consumeCredits(CREDIT_COSTS.assignWorker, "assign_worker", selected);
    if (!ok) return;
    const { data: created, error } = await supabase
      .from("applications")
      .insert({ announcement_id: selected, worker_id: workerId, restaurant_id: user.id, status: "pending" })
      .select("id")
      .single();
    if (error || !created) { toast.error(error?.message ?? "Errore"); return; }
    await supabase.from("notifications").insert({ user_id: workerId, title: "Nuova offerta di lavoro", body: "Un ristoratore ti ha contattato.", link: `/messages/${created.id}` });
    toast.success("Lavoratore contattato! Apro la chat…");
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

  const filtered = workers;
  const resetFilters = () => {
    setCatDraft("all"); setSubDraft("");
    setCategory("all"); setSubcategory("");
    setQInput(""); setQ("");
    setLang(""); setLangDraft(""); setHasSearched(false);
    void runSearch({ category: "all", subcategory: "", text: "", language: "" });
  };
  const onChangeCategory = (c: Category) => { setCatDraft(c); setSubDraft(""); };
  const removeCategoryChip = () => { setCatDraft("all"); setSubDraft(""); void runSearch({ category: "all", subcategory: "" }); };
  const removeSubChip = () => { setSubDraft(""); void runSearch({ subcategory: "" }); };
  const removeQChip = () => { setQInput(""); void runSearch({ text: "" }); };
  const removeLangChip = () => { setLangDraft(""); void runSearch({ language: "" }); };


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
    if (category === "all") {
      if (subcategory === "Ultimi attivi") return (new Date(b.last_active_at ?? 0).getTime()) - (new Date(a.last_active_at ?? 0).getTime());
      if (subcategory === "Miglior rating") return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
      if (subcategory === "Più affidabili") return (b.reliability_pct ?? 0) - (a.reliability_pct ?? 0);
    }
    return Number(inRange(b)) - Number(inRange(a));
  });

  const credits = profile?.credits ?? 0;
  const isPaid = profile?.plan === "pro" || profile?.plan === "business";
  const cost = CREDIT_COSTS.assignWorker;
  const canAfford = isPaid || credits >= cost;

  return (
    <AppShell>
      <PageHeader title="Cerca lavoratori" subtitle="Trova personale extra disponibile" />
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${canAfford ? "bg-card" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          {isPaid ? (
            <span>Piano <strong className="capitalize">{profile?.plan}</strong> attivo · inviti illimitati</span>
          ) : (
            <span>
              Invitare un lavoratore costa <strong>{cost} crediti</strong>. Saldo: <strong>{credits}</strong>
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
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Nessun annuncio attivo" /></SelectTrigger>
            <SelectContent>
              {anns.map((a) => <SelectItem key={a.id} value={a.id}>{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.location_address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Lingua (filtro rapido)</label>
          <Select value={langDraft || "__all"} onValueChange={(v) => setLangDraft(v === "__all" ? "" : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Tutte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Tutte le lingue</SelectItem>
              {LANGUAGE_OPTIONS.filter(l => l !== "Altro").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Unified search box */}
      <div className="mb-4 rounded-2xl border bg-card p-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_15%,transparent)]">
        <label className="mb-2 block text-sm font-medium">Ricerca avanzata lavoratori</label>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <Select value={catDraft} onValueChange={(v) => onChangeCategory(v as Category)}>
            <SelectTrigger className="lg:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((k) => (
                <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subDraft || "__none"} onValueChange={(v) => setSubDraft(v === "__none" ? "" : v)}>
            <SelectTrigger className="lg:w-[220px]"><SelectValue placeholder="Sottocategoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— nessuna —</SelectItem>
              {SUBCATEGORIES[catDraft].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={PLACEHOLDER_BY_CATEGORY[catDraft]}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void runSearch()} disabled={searching} className="gap-1">
              <Search className="h-4 w-4" />{searching ? "Sto cercando…" : "Cerca"}
            </Button>
            <Button variant="outline" onClick={resetFilters} className="gap-1"><RotateCcw className="h-4 w-4" />Reset</Button>
          </div>
        </div>
        {/* Active filter chips */}
        {(category !== "all" || subcategory || q || lang) && (
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
          {searching ? "Ricerca in corso…" : `${sorted.length} ${sorted.length === 1 ? "lavoratore trovato" : "lavoratori trovati"}`}
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
                onClick={() => { setSelected(a.id); setView("map"); }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition ${selected===a.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent"}`}
              >
                <div className="font-medium">{new Date(a.service_date).toLocaleDateString("it-IT")}</div>
                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{a.location_address}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {view === "map" ? (
        <div className="rounded-2xl border bg-card p-2">
          {selectedAnn?.location_lat != null && selectedAnn?.location_lng != null ? (
            <>
              <AnnouncementMap
                lat={selectedAnn.location_lat}
                lng={selectedAnn.location_lng}
                address={selectedAnn.location_address}
                height={420}
                selectedId={selectedAnn.id}
                onSelect={(id) => setSelected(id)}
                markers={anns
                  .filter((a) => a.location_lat != null && a.location_lng != null)
                  .map((a) => ({ id: a.id, lat: a.location_lat as number, lng: a.location_lng as number, address: a.location_address }))}
              />
              <div className="p-3 text-xs text-muted-foreground">Posizione dell'annuncio selezionato. I lavoratori "in zona" sono evidenziati nella vista lista.</div>
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">Seleziona un annuncio con coordinate per vederne la posizione sulla mappa.</div>
          )}
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((w) => {
          const near = inRange(w);
          return (
          <div key={w.id} className={`rounded-2xl border p-5 ${near ? "border-emerald-500/50 bg-emerald-500/5" : "bg-card"}`}>
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold ${near ? "bg-emerald-500/20 text-emerald-700" : "bg-primary/10 text-primary"}`}>{w.full_name?.[0] ?? "?"}</div>
              <div>
                <div className="font-semibold">{w.full_name || "Lavoratore"}</div>
                {w.age && <div className="text-xs text-muted-foreground">{w.age} anni</div>}
              </div>
              {near && <span className="ml-auto text-[10px] rounded-full bg-emerald-500/20 text-emerald-700 px-2 py-0.5 font-medium">In zona</span>}
            </div>
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{w.professional_profile || "Profilo non specificato"}</p>
            {(() => {
              const langs: SpokenLanguage[] = normalizeSpokenLanguages(w.spoken_languages);
              const legacy = (langs.length === 0 ? (w.languages ?? []).map(l => ({ language: l })) : langs);
              return legacy.length > 0 ? (
                <div className="mt-2"><SpokenLanguagesView value={legacy} /></div>
              ) : null;
            })()}
            <Button size="sm" className="mt-4 w-full gap-1" onClick={() => invite(w.id)} disabled={!selected || !canAfford}>
              <MessageSquare className="h-3.5 w-3.5" />
              Messaggia {!isPaid && <span className="opacity-80">· {cost} <Coins className="inline h-3 w-3" /></span>}
            </Button>
          </div>
          );
        })}
        {hasSearched && !searching && sorted.length === 0 && <p className="text-muted-foreground col-span-full">Nessun lavoratore trovato. Prova a cambiare categoria, sottocategoria o parola chiave.</p>}
      </div>
      )}
    </AppShell>
  );
}