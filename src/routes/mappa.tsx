import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Locate, Search, MapPin, Coins, Briefcase, Star, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { geocodeAddressWithRetry } from "@/lib/geocode";
import type { MapPoint } from "@/components/MapViewInner";
import { useAuth } from "@/lib/auth-context";

const MapViewInner = lazy(() => import("@/components/MapViewInner"));

export const Route = createFileRoute("/mappa")({
  head: () => ({ meta: [{ title: "Mappa — Pupillo" }] }),
  component: () => <RequireAuth><MapPage /></RequireAuth>,
});

type Restaurant = {
  id: string;
  business_name: string | null;
  full_name: string | null;
  venue_type: string | null;
  address: string | null;
  city: string | null;
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
  city: string | null;
  neighborhood: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  badge: string | null;
  rating_avg: number | null;
  reliability_pct: number | null;
  completed_shifts: number | null;
  hourly_rate: number | null;
  experience_level: string | null;
  weekly_availability: string[] | null;
  account_status: string | null;
};

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
};

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function MapPage() {
  const { role } = useAuth();
  const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;
  const debugEnabled = role === "admin" || isDev;
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [annCounts, setAnnCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // search & filters
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("any");
  const [district, setDistrict] = useState("");
  const [venue, setVenue] = useState("any");
  const [planF, setPlanF] = useState("any");
  const [statusF, setStatusF] = useState("any");
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

  // location
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>("any");
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: r }, { data: w }, { data: a }] = await Promise.all([
        supabase.from("profiles")
          .select("id, business_name, full_name, venue_type, address, city, neighborhood, service_area_lat, service_area_lng, latitude, longitude, contact_person_first_name, contact_person_last_name, contact_person_role, contact_person_phone, contact_person_email, account_status, plan, credits, rating_avg")
          .or("primary_role.eq.restaurant,business_name.not.is.null")
          .limit(1000),
        supabase
          .from("user_roles")
          .select("user_id, profiles:profiles!inner(id, full_name, primary_role, secondary_roles, city, neighborhood, service_area_lat, service_area_lng, badge, rating_avg, reliability_pct, completed_shifts, hourly_rate, experience_level, weekly_availability, account_status)")
          .eq("role", "worker")
          .limit(2000),
        supabase.from("announcements")
          .select("id, professional_profile, location_address, location_lat, location_lng, job_latitude, job_longitude, job_address, job_contact_person_name, job_contact_person_phone, job_contact_person_email, status, restaurant_id")
          .eq("status", "active")
          .limit(1000),
      ]);
      setRestaurants((r as Restaurant[]) || []);
      const wsRaw = ((w as any[]) || []).map(x => x.profiles).filter(Boolean) as Worker[];
      setWorkers(wsRaw);
      setAnns((a as Ann[]) || []);
      const counts: Record<string, number> = {};
      (a || []).forEach((x: any) => { counts[x.restaurant_id] = (counts[x.restaurant_id] || 0) + 1; });
      setAnnCounts(counts);
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(() => Array.from(new Set(restaurants.map(r => r.city).filter(Boolean))) as string[], [restaurants]);
  const venues = useMemo(() => Array.from(new Set(restaurants.map(r => r.venue_type).filter(Boolean))) as string[], [restaurants]);
  const workerRoles = useMemo(() => Array.from(new Set(workers.map(w => w.primary_role).filter(Boolean))) as string[], [workers]);

  const matchesWorkerQuery = (w: Worker) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [w.full_name, w.primary_role, w.city, w.neighborhood, w.badge, w.experience_level, ...(w.secondary_roles || [])]
      .some(v => (v || "").toString().toLowerCase().includes(q));
  };

  const filteredWorkers = useMemo(() => {
    const max = radiusKm !== "any" ? Number(radiusKm) : null;
    const ref = searchCenter || me;
    return workers.filter(w => {
      if (!matchesWorkerQuery(w)) return false;
      if (city !== "any" && w.city !== city) return false;
      if (district && !(w.neighborhood || "").toLowerCase().includes(district.toLowerCase())) return false;
      if (wRole !== "any" && w.primary_role !== wRole) return false;
      if (wBadge !== "any" && w.badge !== wBadge) return false;
      if (wExp !== "any" && w.experience_level !== wExp) return false;
      if (wMinRating !== "any" && Number(w.rating_avg || 0) < Number(wMinRating)) return false;
      if (wMinReliab !== "any" && Number(w.reliability_pct || 0) < Number(wMinReliab)) return false;
      if (statusF !== "any" && w.account_status !== statusF) return false;
      if (max != null && ref && w.service_area_lat != null && w.service_area_lng != null) {
        if (distKm(ref.lat, ref.lng, w.service_area_lat, w.service_area_lng) > max) return false;
      }
      return true;
    });
  }, [workers, query, city, district, wRole, wBadge, wExp, wMinRating, wMinReliab, statusF, radiusKm, searchCenter, me]);

  const matchesQuery = (r: Restaurant) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [r.business_name, r.full_name, r.address, r.city, r.neighborhood, r.venue_type]
      .some(v => (v || "").toLowerCase().includes(q));
  };

  const filteredRestaurants = useMemo(() => {
    const max = radiusKm !== "any" ? Number(radiusKm) : null;
    const ref = searchCenter || me;
    return restaurants.filter(r => {
      if (!matchesQuery(r)) return false;
      if (city !== "any" && r.city !== city) return false;
      if (district && !(r.neighborhood || "").toLowerCase().includes(district.toLowerCase())) return false;
      if (venue !== "any" && r.venue_type !== venue) return false;
      if (planF !== "any" && r.plan !== planF) return false;
      if (statusF !== "any" && r.account_status !== statusF) return false;
      if (withRequests && !annCounts[r.id]) return false;
      if (max != null && ref && r.service_area_lat != null && r.service_area_lng != null) {
        if (distKm(ref.lat, ref.lng, r.service_area_lat, r.service_area_lng) > max) return false;
      }
      return true;
    });
  }, [restaurants, query, city, district, venue, planF, statusF, withRequests, annCounts, radiusKm, searchCenter, me]);

  const restaurantIdSet = useMemo(() => new Set(filteredRestaurants.map(r => r.id)), [filteredRestaurants]);

  const points: MapPoint[] = useMemo(() => {
    const pts: MapPoint[] = [];
    if (showR) {
      filteredRestaurants.forEach(r => {
        if (r.service_area_lat == null || r.service_area_lng == null) return;
        pts.push({
          id: r.id,
          lat: r.service_area_lat,
          lng: r.service_area_lng,
          category: "restaurant",
          title: r.business_name || r.full_name || "Locale",
          subtitle: [r.venue_type, r.address].filter(Boolean).join(" · "),
          city: [r.neighborhood, r.city].filter(Boolean).join(", ") || r.city,
          status: r.account_status,
        });
      });
    }
    if (showW) {
      filteredWorkers.forEach(w => {
        if (w.service_area_lat == null || w.service_area_lng == null) return;
        pts.push({
          id: w.id,
          lat: w.service_area_lat,
          lng: w.service_area_lng,
          category: "worker",
          title: w.full_name || "Lavoratore",
          subtitle: [w.primary_role, w.badge ? `· ${w.badge}` : null].filter(Boolean).join(" "),
          city: [w.neighborhood, w.city].filter(Boolean).join(", ") || w.city,
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
        // Fallback ordinato: job_latitude/job_longitude (sempre prioritari se presenti)
        // → location_lat/lng dell'annuncio → coordinate del profilo ristoratore → service_area_*
        const candidates: Array<[number | null | undefined, number | null | undefined, string]> = [
          [a.job_latitude, a.job_longitude, "job"],
          [a.location_lat, a.location_lng, "location"],
          [rest?.latitude, rest?.longitude, "profile"],
          [rest?.service_area_lat, rest?.service_area_lng, "service_area"],
        ];
        const picked = candidates.find(([la, ln]) => la != null && ln != null);
        if (!picked) return; // nessuna coordinata disponibile → conteggiato a parte
        const [lat, lng] = picked as [number, number, string];
        // se c'è una ricerca attiva, mostra solo annunci dei ristoratori filtrati
        if (query || city !== "any" || district || venue !== "any" || planF !== "any" || statusF !== "any" || withRequests) {
          if (!restaurantIdSet.has(a.restaurant_id)) return;
        }
        const refPoint = searchCenter || me;
        const distance = refPoint ? distKm(refPoint.lat, refPoint.lng, lat, lng) : null;
        const contactName = a.job_contact_person_name
          || [rest?.contact_person_first_name, rest?.contact_person_last_name].filter(Boolean).join(" ").trim()
          || null;
        const contactPhone = a.job_contact_person_phone || rest?.contact_person_phone || null;
        const contactEmail = a.job_contact_person_email || rest?.contact_person_email || null;
        const contactRole = rest?.contact_person_role || null;
        pts.push({
          id: a.id,
          lat,
          lng,
          category: "announcement",
          title: a.professional_profile || "Annuncio",
          subtitle: a.job_address || a.location_address || undefined,
          status: a.status,
          link: `/announcements/${a.id}`,
          meta: {
            distanceKm: distance,
            contactName,
            contactPhone,
            contactEmail,
            contactRole,
          } as any,
        });
      });
    }
    return pts;
  }, [filteredRestaurants, filteredWorkers, anns, restaurants, showR, showW, showA, restaurantIdSet, query, city, district, venue, planF, statusF, withRequests, searchCenter, me]);

  // Conteggio annunci senza alcuna coordinata disponibile (per warning UI)
  const annsMissingCoords = useMemo(() => {
    const restById = new Map(restaurants.map(r => [r.id, r]));
    return anns.filter(a => {
      const rest = restById.get(a.restaurant_id);
      const hasAny =
        (a.job_latitude != null && a.job_longitude != null) ||
        (a.location_lat != null && a.location_lng != null) ||
        (rest?.latitude != null && rest?.longitude != null) ||
        (rest?.service_area_lat != null && rest?.service_area_lng != null);
      return !hasAny;
    });
  }, [anns, restaurants]);

  const center: [number, number] = searchCenter
    ? [searchCenter.lat, searchCenter.lng]
    : me ? [me.lat, me.lng]
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

  const runSearch = async () => {
    if (!query.trim()) { setSearchCenter(null); return; }
    setGeocoding(true);
    const r = await geocodeAddressWithRetry(query.trim(), { maxAttempts: 2 });
    setGeocoding(false);
    if (r.ok) {
      setSearchCenter({ lat: r.lat, lng: r.lng, label: r.displayName });
    } else {
      // ricerca testuale comunque attiva, niente center change
      setSearchCenter(null);
    }
  };

  const ref = searchCenter || me;

  return (
    <AppShell>
      <PageHeader title="Mappa" subtitle="Ristoratori, lavoratori e richieste attive in tempo reale" />

      {/* SEARCH BAR */}
      <div className="rounded-2xl border bg-card p-4 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); runSearch(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 text-base"
              placeholder="Cerca lavoratore, ruolo, città o zona"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={geocoding} className="h-11">
            {geocoding ? "Cerco…" : "Cerca"}
          </Button>
        </form>
        {searchCenter?.label && (
          <p className="mt-2 text-xs text-muted-foreground">📍 {searchCenter.label}</p>
        )}
      </div>

      {showA && annsMissingCoords.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800 p-3 mb-4 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>{annsMissingCoords.length}</strong> {annsMissingCoords.length === 1 ? "annuncio non è" : "annunci non sono"} visibili sulla mappa: nessuna coordinata disponibile (né <code>job_latitude/longitude</code>, né indirizzo dell'annuncio, né del ristoratore).
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="rounded-2xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-3">
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger><SelectValue placeholder="Città" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tutte le città</SelectItem>
            {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Zona / quartiere" value={district} onChange={e => setDistrict(e.target.value)} />
        <Select value={venue} onValueChange={setVenue}>
          <SelectTrigger><SelectValue placeholder="Tipologia locale" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tutte le tipologie</SelectItem>
            {venues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={planF} onValueChange={setPlanF}>
          <SelectTrigger><SelectValue placeholder="Piano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tutti i piani</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger><SelectValue placeholder="Stato account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="pending">In attesa</SelectItem>
            <SelectItem value="suspended">Sospeso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={radiusKm} onValueChange={setRadiusKm}>
          <SelectTrigger><SelectValue placeholder="Raggio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Qualsiasi distanza</SelectItem>
            <SelectItem value="1">Entro 1 km</SelectItem>
            <SelectItem value="3">Entro 3 km</SelectItem>
            <SelectItem value="5">Entro 5 km</SelectItem>
            <SelectItem value="10">Entro 10 km</SelectItem>
            <SelectItem value="20">Entro 20 km</SelectItem>
          </SelectContent>
        </Select>

        <div className="md:col-span-3 flex flex-wrap items-center gap-4 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={locateMe} disabled={locating} className="gap-2">
            <Locate className="h-4 w-4" />{locating ? "Rilevo…" : me ? "Aggiorna posizione" : "Usa la mia posizione"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={withRequests} onCheckedChange={v => setWithRequests(!!v)} />
            Solo con richieste attive
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={showR} onCheckedChange={v=>setShowR(!!v)} /><Dot color="#4f46e5" /> Ristoratori</label>
            <label className="flex items-center gap-2"><Checkbox checked={showW} onCheckedChange={v=>setShowW(!!v)} /><Dot color="#22c55e" /> Lavoratori</label>
            <label className="flex items-center gap-2"><Checkbox checked={showA} onCheckedChange={v=>setShowA(!!v)} /><Dot color="#06b6d4" /> Richieste</label>
          </div>
        </div>
      </div>

      {/* WORKER FILTERS */}
      {showW && (
        <div className="rounded-2xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-3">
          <Select value={wRole} onValueChange={setWRole}>
            <SelectTrigger><SelectValue placeholder="Ruolo lavoratore" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutti i ruoli</SelectItem>
              {workerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={wBadge} onValueChange={setWBadge}>
            <SelectTrigger><SelectValue placeholder="Badge" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutti i badge</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="elite">Elite</SelectItem>
            </SelectContent>
          </Select>
          <Select value={wExp} onValueChange={setWExp}>
            <SelectTrigger><SelectValue placeholder="Esperienza" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi esperienza</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="middle">Middle</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
            </SelectContent>
          </Select>
          <Select value={wMinRating} onValueChange={setWMinRating}>
            <SelectTrigger><SelectValue placeholder="Rating minimo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi rating</SelectItem>
              <SelectItem value="3">≥ 3.0</SelectItem>
              <SelectItem value="4">≥ 4.0</SelectItem>
              <SelectItem value="4.5">≥ 4.5</SelectItem>
            </SelectContent>
          </Select>
          <Select value={wMinReliab} onValueChange={setWMinReliab}>
            <SelectTrigger><SelectValue placeholder="Affidabilità minima" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi affidabilità</SelectItem>
              <SelectItem value="70">≥ 70%</SelectItem>
              <SelectItem value="85">≥ 85%</SelectItem>
              <SelectItem value="95">≥ 95%</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm">
            <Button size="sm" variant={view === "restaurants" ? "secondary" : "ghost"} onClick={() => setView("restaurants")}>Lista ristoratori</Button>
            <Button size="sm" variant={view === "workers" ? "secondary" : "ghost"} onClick={() => setView("workers")}>Lista lavoratori</Button>
          </div>
        </div>
      )}

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
                  const d = ref && w.service_area_lat != null && w.service_area_lng != null
                    ? distKm(ref.lat, ref.lng, w.service_area_lat, w.service_area_lng) : null;
                  return (
                    <li key={w.id} className="rounded-xl border p-3 hover:border-primary transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{w.full_name || "Lavoratore"}</div>
                          <div className="text-xs text-muted-foreground capitalize">{w.primary_role || "—"}</div>
                        </div>
                        {d != null && <span className="text-xs rounded-full bg-secondary px-2 py-0.5 whitespace-nowrap">{d.toFixed(1)} km</span>}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[w.neighborhood, w.city].filter(Boolean).join(", ") || "—"}</div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {w.badge && <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 capitalize">{w.badge}</span>}
                          {w.rating_avg ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{Number(w.rating_avg).toFixed(1)}</span> : null}
                          {w.reliability_pct != null && <span>{w.reliability_pct}% affid.</span>}
                          {w.hourly_rate != null && <span>€ {Number(w.hourly_rate).toFixed(0)}/h</span>}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                          if (w.service_area_lat != null && w.service_area_lng != null) {
                            setSearchCenter({ lat: w.service_area_lat, lng: w.service_area_lng, label: w.full_name || undefined });
                          } else { toast.info("Coordinate non disponibili"); }
                        }}>Mostra sulla mappa</Button>
                        <Link to="/workers"><Button size="sm">Vedi profilo</Button></Link>
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
                return (
                  <li key={r.id} className="rounded-xl border p-3 hover:border-primary transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.business_name || r.full_name || "Locale"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{r.venue_type || "—"}</div>
                      </div>
                      {d != null && <span className="text-xs rounded-full bg-secondary px-2 py-0.5 whitespace-nowrap">{d.toFixed(1)} km</span>}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[r.address, r.neighborhood, r.city].filter(Boolean).join(", ") || "Indirizzo non disponibile"}</div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{annCounts[r.id] || 0} richieste</span>
                        <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{r.credits ?? 0}</span>
                        {r.rating_avg ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{Number(r.rating_avg).toFixed(1)}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 capitalize">{r.plan || "free"}</span>
                        <span className={`rounded-full px-2 py-0.5 capitalize ${r.account_status === "active" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted"}`}>{r.account_status || "—"}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                        if (r.service_area_lat != null && r.service_area_lng != null) {
                          setSearchCenter({ lat: r.service_area_lat, lng: r.service_area_lng, label: r.business_name || undefined });
                        } else {
                          toast.info("Coordinate non disponibili per questo locale");
                        }
                      }}>Mostra sulla mappa</Button>
                      <Link to="/restaurants/$id" params={{ id: r.id }}><Button size="sm">Vedi dettaglio</Button></Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* MAP */}
        <div className="order-1 lg:order-2">
          {loading ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground" style={{ minHeight: 500 }}>Caricamento mappa…</div>
          ) : points.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground" style={{ minHeight: 500 }}>
              Nessun risultato sulla mappa. Modifica filtri o ricerca.
            </div>
          ) : (
            <Suspense fallback={<div className="rounded-xl bg-muted animate-pulse" style={{ height: 600 }} />}>
              <MapViewInner
                points={points}
                height={typeof window !== "undefined" ? Math.max(500, Math.min(window.innerHeight * 0.75, 700)) : 600}
                center={center}
                me={ref}
                radiusKm={radiusKm !== "any" ? Number(radiusKm) : null}
              />
            </Suspense>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {points.length} marker · {filteredRestaurants.length} ristoratori · {filteredWorkers.length} lavoratori{ref && radiusKm !== "any" ? ` entro ${radiusKm} km` : ""} · OpenStreetMap
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ background: color, width: 10, height: 10, borderRadius: 9999, display: "inline-block" }} />;
}