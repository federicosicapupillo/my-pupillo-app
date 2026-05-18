import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VENUE_TYPES, venueTypeLabel } from "@/lib/venue-types";
import { PRICE_RANGE_OPTIONS, priceRangeLabel } from "@/lib/price-range";
import { hasSavedDefaults } from "@/lib/restaurant-defaults";
import { ITALIAN_LOCATIONS, citiesForProvince } from "@/lib/italian-locations";
import { AdminRequiredReviewsSection } from "@/components/AdminRequiredReviewsSection";
import { AdminBackupsSection } from "@/components/AdminBackupsSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Pupillo" }] }),
  component: () => <RequireRole allow={["admin"]}><Admin /></RequireRole>,
});

type WorkerRow = { id: string; full_name: string | null; email: string | null; badge: string | null; completed_shifts: number | null; profile_completed: boolean | null; reputation_level: string | null };
type RestaurantRow = { id: string; business_name: string | null; full_name: string | null; email: string | null; city: string | null; credits: number | null; ann_count: number };
type AnnouncementRow = { id: string; restaurant_name: string | null; professional_profile: string | null; service_date: string | null; status: string | null; apps_count: number };
type CreditTx = { id: string; user_id: string; delta: number; balance_after: number; reason: string | null; created_at: string; user_name: string | null };
type ReviewRow = { id: string; rating: number; comment: string | null; created_at: string; target_id: string; author_id: string; target_name: string | null; author_name: string | null };

function Admin() {
  const { role } = useAuth();
  const [k, setK] = useState({ users: 0, restaurants: 0, workers: 0, anns: 0, active: 0, apps: 0, assigned: 0, shifts: 0, reviews: 0, ratingAvg: 0 });
  const [byBadge, setByBadge] = useState<Record<string, number>>({});
  const [byPlan, setByPlan] = useState<Record<string, number>>({});
  const [byCity, setByCity] = useState<Record<string, number>>({});
  const [byRole, setByRole] = useState<Record<string, number>>({});
  const [vatList, setVatList] = useState<any[]>([]);
  const [vatFilter, setVatFilter] = useState<"all" | "valid" | "invalid" | "pending" | "none">("all");
  const [vatSearch, setVatSearch] = useState("");
  const [vatVenueFilter, setVatVenueFilter] = useState<string>("all");
  const [byVenue, setByVenue] = useState<Record<string, number>>({});
  const [vatPriceFilter, setVatPriceFilter] = useState<string>("all");
  const [byPrice, setByPrice] = useState<Record<string, number>>({});
  const [vatProvinceFilter, setVatProvinceFilter] = useState<string>("all");
  const [vatCityFilter, setVatCityFilter] = useState<string>("all");

  // New tab data
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [restSearch, setRestSearch] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [annSearch, setAnnSearch] = useState("");
  const [creditTx, setCreditTx] = useState<CreditTx[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      const [u, rest, work, a, act, ap, asg, sh, rv, profs, anns] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role","restaurant"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role","worker"),
        supabase.from("announcements").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }).eq("status","active"),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }).eq("status", "assigned"),
        supabase.from("shifts").select("*", { count: "exact", head: true }),
        supabase.from("reviews").select("rating"),
        supabase.from("profiles").select("badge,plan,city,primary_role").limit(1000),
        supabase.from("announcements").select("location_address,professional_profile").limit(1000),
      ]);
      const ratings = (rv.data ?? []).map((r:any)=>r.rating);
      const avg = ratings.length ? +(ratings.reduce((s,n)=>s+n,0)/ratings.length).toFixed(2) : 0;
      setK({ users: u.count ?? 0, restaurants: rest.count ?? 0, workers: work.count ?? 0, anns: a.count ?? 0, active: act.count ?? 0, apps: ap.count ?? 0, assigned: asg.count ?? 0, shifts: sh.count ?? 0, reviews: ratings.length, ratingAvg: avg });
      const bb: Record<string,number> = {}; const bp: Record<string,number> = {}; const bc: Record<string,number> = {};
      (profs.data ?? []).forEach((p:any) => {
        if (p.badge) bb[p.badge] = (bb[p.badge]||0)+1;
        if (p.plan) bp[p.plan] = (bp[p.plan]||0)+1;
      });
      const br: Record<string,number> = {};
      (anns.data ?? []).forEach((an:any) => {
        const city = (an.location_address||"").split(",").pop()?.trim() || "—";
        bc[city] = (bc[city]||0)+1;
        if (an.professional_profile) br[an.professional_profile] = (br[an.professional_profile]||0)+1;
      });
      setByBadge(bb); setByPlan(bp); setByCity(bc); setByRole(br);

      // Worker IDs
      const workerIds = (await supabase.from("user_roles").select("user_id").eq("role","worker")).data?.map((r:any)=>r.user_id) ?? [];
      if (workerIds.length) {
        const { data: wrows } = await supabase
          .from("profiles")
          .select("id,full_name,email,badge,completed_shifts,profile_completed,reputation_level")
          .in("id", workerIds)
          .order("completed_shifts", { ascending: false })
          .limit(500);
        setWorkers((wrows ?? []) as WorkerRow[]);
      }

      // Restaurants list + announcement counts
      const restaurantIds = (await supabase.from("user_roles").select("user_id").eq("role","restaurant")).data?.map((r:any)=>r.user_id) ?? [];
      if (restaurantIds.length) {
        const { data: rrows } = await supabase
          .from("profiles")
          .select("id,full_name,business_name,vat_number,vat_status,vat_company_name,vat_verified_at,venue_type,venue_type_other,city,province,province_code,price_range,default_settings_updated_at,default_required_skills,default_dress_code_items,default_language_requirements,default_license_requirement,default_dress_code_notes,email,credits")
          .in("id", restaurantIds)
          .order("vat_verified_at", { ascending: false });
        setVatList(rrows ?? []);
        const bv: Record<string, number> = {};
        (rrows ?? []).forEach((r: any) => {
          const label = venueTypeLabel(r.venue_type, r.venue_type_other);
          if (label && label !== "—") bv[label] = (bv[label] || 0) + 1;
        });
        setByVenue(bv);
        const bpr: Record<string, number> = {};
        (rrows ?? []).forEach((r: any) => {
          if (r.price_range) {
            const label = priceRangeLabel(r.price_range);
            bpr[label] = (bpr[label] || 0) + 1;
          }
        });
        setByPrice(bpr);

        // Count announcements per restaurant
        const { data: annAll } = await supabase
          .from("announcements")
          .select("restaurant_id")
          .in("restaurant_id", restaurantIds);
        const annCount: Record<string, number> = {};
        (annAll ?? []).forEach((a: any) => { annCount[a.restaurant_id] = (annCount[a.restaurant_id]||0)+1; });
        setRestaurants((rrows ?? []).map((r: any): RestaurantRow => ({
          id: r.id, business_name: r.business_name, full_name: r.full_name,
          email: r.email, city: r.city, credits: r.credits,
          ann_count: annCount[r.id] ?? 0,
        })));
      }

      // Announcements list (with apps count)
      const { data: annList } = await supabase
        .from("announcements")
        .select("id,restaurant_id,professional_profile,service_date,status")
        .order("service_date", { ascending: false })
        .limit(300);
      const annRestIds = Array.from(new Set((annList ?? []).map((a: any) => a.restaurant_id)));
      const { data: annRestProfiles } = annRestIds.length
        ? await supabase.from("profiles").select("id,business_name,full_name").in("id", annRestIds)
        : { data: [] as any[] };
      const nameMap = new Map<string, string>();
      (annRestProfiles ?? []).forEach((p: any) => nameMap.set(p.id, p.business_name || p.full_name || "—"));
      const { data: appsAll } = await supabase.from("applications").select("announcement_id");
      const appsCount: Record<string, number> = {};
      (appsAll ?? []).forEach((a: any) => { appsCount[a.announcement_id] = (appsCount[a.announcement_id]||0)+1; });
      setAnnouncements((annList ?? []).map((a: any): AnnouncementRow => ({
        id: a.id, restaurant_name: nameMap.get(a.restaurant_id) ?? "—",
        professional_profile: a.professional_profile, service_date: a.service_date,
        status: a.status, apps_count: appsCount[a.id] ?? 0,
      })));

      // Credit transactions
      const { data: tx } = await supabase
        .from("credit_transactions")
        .select("id,user_id,delta,balance_after,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const txUserIds = Array.from(new Set((tx ?? []).map((t: any) => t.user_id)));
      const { data: txProfs } = txUserIds.length
        ? await supabase.from("profiles").select("id,business_name,full_name").in("id", txUserIds)
        : { data: [] as any[] };
      const txNameMap = new Map<string, string>();
      (txProfs ?? []).forEach((p: any) => txNameMap.set(p.id, p.business_name || p.full_name || "—"));
      setCreditTx((tx ?? []).map((t: any): CreditTx => ({
        ...t, user_name: txNameMap.get(t.user_id) ?? "—",
      })));

      // Reviews
      const { data: rev } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,target_id,author_id")
        .order("created_at", { ascending: false })
        .limit(200);
      const revIds = Array.from(new Set([
        ...(rev ?? []).map((r: any) => r.target_id),
        ...(rev ?? []).map((r: any) => r.author_id),
      ]));
      const { data: revProfs } = revIds.length
        ? await supabase.from("profiles").select("id,business_name,full_name").in("id", revIds)
        : { data: [] as any[] };
      const revNameMap = new Map<string, string>();
      (revProfs ?? []).forEach((p: any) => revNameMap.set(p.id, p.business_name || p.full_name || "—"));
      setReviews((rev ?? []).map((r: any): ReviewRow => ({
        ...r,
        target_name: revNameMap.get(r.target_id) ?? "—",
        author_name: revNameMap.get(r.author_id) ?? "—",
      })));
    })();
  }, [role]);

  if (role !== "admin") return <AppShell><p className="text-muted-foreground">Accesso riservato agli amministratori.</p></AppShell>;

  const workersFiltered = workers.filter(w => {
    if (!workerSearch.trim()) return true;
    const q = workerSearch.trim().toLowerCase();
    return (w.full_name ?? "").toLowerCase().includes(q) || (w.email ?? "").toLowerCase().includes(q);
  });
  const restsFiltered = restaurants.filter(r => {
    if (!restSearch.trim()) return true;
    const q = restSearch.trim().toLowerCase();
    return (r.business_name ?? "").toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q) || (r.city ?? "").toLowerCase().includes(q);
  });
  const annsFiltered = announcements.filter(a => {
    if (!annSearch.trim()) return true;
    const q = annSearch.trim().toLowerCase();
    return (a.restaurant_name ?? "").toLowerCase().includes(q) || (a.professional_profile ?? "").toLowerCase().includes(q) || (a.status ?? "").toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <PageHeader
        title="Pannello Admin"
        subtitle="Gestione piattaforma Pupillo"
        action={<Link to="/mappa"><Button variant="outline" size="sm" className="gap-2"><MapIcon className="h-4 w-4" />Mappa ristoratori</Button></Link>}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="workers">Lavoratori</TabsTrigger>
          <TabsTrigger value="restaurants">Ristoratori</TabsTrigger>
          <TabsTrigger value="announcements">Annunci</TabsTrigger>
          <TabsTrigger value="credits">Crediti</TabsTrigger>
          <TabsTrigger value="reviews">Recensioni</TabsTrigger>
          <TabsTrigger value="backups">Backup</TabsTrigger>
        </TabsList>

        {/* PANORAMICA */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { l: "Utenti totali", v: k.users },
              { l: "Ristoratori", v: k.restaurants },
              { l: "Lavoratori", v: k.workers },
              { l: "Annunci attivi", v: k.active },
              { l: "Candidature", v: k.apps },
              { l: "Match confermati", v: k.assigned },
              { l: "Turni completati", v: k.shifts },
              { l: "Rating medio", v: k.ratingAvg },
            ].map(s => (
              <div key={s.l} className="rounded-2xl border bg-card p-5">
                <div className="text-sm text-muted-foreground">{s.l}</div>
                <div className="mt-2 text-3xl font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="Lavoratori per badge" data={byBadge} />
            <Breakdown title="Ristoratori per piano" data={byPlan} />
            <Breakdown title="Ristoratori per tipologia locale" data={byVenue} />
            <Breakdown title="Ristoratori per fascia di prezzo" data={byPrice} />
            <Breakdown title="Annunci per città" data={byCity} />
            <Breakdown title="Annunci per ruolo" data={byRole} />
          </div>
        </TabsContent>

        {/* LAVORATORI */}
        <TabsContent value="workers">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
              <div className="font-medium">Lavoratori registrati ({workersFiltered.length})</div>
              <Input placeholder="Cerca nome o email" value={workerSearch} onChange={(e)=>setWorkerSearch(e.target.value)} className="h-9 w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Nome</th><th className="pr-3">Email</th><th className="pr-3">Stato profilo</th><th className="pr-3">Badge</th><th className="pr-3">Reputazione</th><th className="pr-3">Turni</th><th>Azioni</th></tr>
                </thead>
                <tbody>
                  {workersFiltered.slice(0, 200).map(w => (
                    <tr key={w.id} className="border-t">
                      <td className="py-2 pr-3">{w.full_name ?? "—"}</td>
                      <td className="pr-3">{w.email ?? "—"}</td>
                      <td className="pr-3">{w.profile_completed ? <span className="text-emerald-600 text-xs">Completo</span> : <span className="text-amber-600 text-xs">Incompleto</span>}</td>
                      <td className="pr-3 capitalize">{w.badge ?? "—"}</td>
                      <td className="pr-3 capitalize">{w.reputation_level ?? "—"}</td>
                      <td className="pr-3">{w.completed_shifts ?? 0}</td>
                      <td><Link to="/workers/$id" params={{ id: w.id }}><Button size="sm" variant="outline">Profilo</Button></Link></td>
                    </tr>
                  ))}
                  {workersFiltered.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Nessun lavoratore</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* RISTORATORI */}
        <TabsContent value="restaurants" className="space-y-6">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
              <div className="font-medium">Ristoratori registrati ({restsFiltered.length})</div>
              <Input placeholder="Cerca nome, email o città" value={restSearch} onChange={(e)=>setRestSearch(e.target.value)} className="h-9 w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Attività</th><th className="pr-3">Email</th><th className="pr-3">Città</th><th className="pr-3">Annunci</th><th className="pr-3">Crediti</th><th>Azioni</th></tr>
                </thead>
                <tbody>
                  {restsFiltered.slice(0, 200).map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-3">{r.business_name ?? r.full_name ?? "—"}</td>
                      <td className="pr-3">{r.email ?? "—"}</td>
                      <td className="pr-3">{r.city ?? "—"}</td>
                      <td className="pr-3">{r.ann_count}</td>
                      <td className="pr-3">{r.credits ?? 0}</td>
                      <td><Link to="/restaurants/$id" params={{ id: r.id }}><Button size="sm" variant="outline">Profilo</Button></Link></td>
                    </tr>
                  ))}
                  {restsFiltered.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nessun ristoratore</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Existing VAT verification table */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
              <div className="font-medium">Verifica Partita IVA</div>
              <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="Cerca P.IVA o ragione sociale" value={vatSearch} onChange={(e)=>setVatSearch(e.target.value)} className="h-9 w-64" />
                <select value={vatFilter} onChange={(e)=>setVatFilter(e.target.value as any)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="all">Tutti</option>
                  <option value="valid">Verificata</option>
                  <option value="invalid">Non verificata</option>
                  <option value="pending">In attesa</option>
                  <option value="none">Mancante</option>
                </select>
                <select value={vatVenueFilter} onChange={(e)=>setVatVenueFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="all">Tutte le tipologie</option>
                  {VENUE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={vatPriceFilter} onChange={(e)=>setVatPriceFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="all">Tutte le fasce di prezzo</option>
                  {PRICE_RANGE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.symbol ? `${p.symbol} — ${p.label}` : p.label}</option>
                  ))}
                </select>
                <select value={vatProvinceFilter} onChange={(e)=>{ setVatProvinceFilter(e.target.value); setVatCityFilter("all"); }} className="h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="all">Tutte le province</option>
                  {ITALIAN_LOCATIONS.map((p) => <option key={p.province_code} value={p.province}>{p.province}</option>)}
                </select>
                <select value={vatCityFilter} onChange={(e)=>setVatCityFilter(e.target.value)} disabled={vatProvinceFilter==="all"} className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50">
                  <option value="all">{vatProvinceFilter==="all" ? "Seleziona prima la provincia" : "Tutte le città"}</option>
                  {vatProvinceFilter !== "all" && citiesForProvince(vatProvinceFilter).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Ristoratore</th><th className="pr-3">Ragione sociale</th><th className="pr-3">Tipologia</th><th className="pr-3">Fascia prezzo</th><th className="pr-3">P.IVA</th><th className="pr-3">Stato</th><th className="pr-3">Verificata il</th><th className="pr-3">Default annunci</th><th>Azioni</th></tr>
                </thead>
                <tbody>
                  {vatList
                    .filter((r) => {
                      const status = r.vat_status ?? (r.vat_number ? "" : "none");
                      if (vatFilter === "none") return !r.vat_number;
                      if (vatFilter !== "all" && status !== vatFilter) return false;
                      if (vatVenueFilter !== "all" && r.venue_type !== vatVenueFilter) return false;
                      if (vatPriceFilter !== "all" && r.price_range !== vatPriceFilter) return false;
                      if (vatProvinceFilter !== "all" && r.province !== vatProvinceFilter) return false;
                      if (vatCityFilter !== "all" && r.city !== vatCityFilter) return false;
                      if (vatSearch.trim()) {
                        const q = vatSearch.trim().toLowerCase();
                        return (r.vat_number ?? "").toLowerCase().includes(q) || (r.business_name ?? "").toLowerCase().includes(q) || (r.vat_company_name ?? "").toLowerCase().includes(q);
                      }
                      return true;
                    })
                    .slice(0, 200)
                    .map((r:any) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-3">{r.full_name ?? "—"}</td>
                      <td className="pr-3">{r.business_name ?? r.vat_company_name ?? "—"}</td>
                      <td className="pr-3">{venueTypeLabel(r.venue_type, r.venue_type_other)}</td>
                      <td className="pr-3">{priceRangeLabel(r.price_range)}</td>
                      <td className="pr-3 font-mono">{r.vat_number ?? "—"}</td>
                      <td className="pr-3">{statusBadge(r.vat_status, r.vat_number)}</td>
                      <td className="pr-3">{r.vat_verified_at ? new Date(r.vat_verified_at).toLocaleDateString("it-IT") : "—"}</td>
                      <td className="pr-3">{defaultsCell(r)}</td>
                      <td>
                        <Button size="sm" variant="outline" onClick={async () => {
                          const { error } = await supabase.from("profiles").update({ vat_status: "valid", vat_verified_at: new Date().toISOString() }).eq("id", r.id);
                          if (error) toast.error(error.message);
                          else { toast.success("Segnata come verificata"); setVatList(l => l.map(x => x.id===r.id?{...x,vat_status:"valid",vat_verified_at:new Date().toISOString()}:x)); }
                        }}>Segna come verificata</Button>
                      </td>
                    </tr>
                  ))}
                  {vatList.length === 0 && (
                    <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">Nessun ristoratore</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ANNUNCI */}
        <TabsContent value="announcements">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
              <div className="font-medium">Annunci ({annsFiltered.length})</div>
              <Input placeholder="Cerca ristoratore, ruolo o stato" value={annSearch} onChange={(e)=>setAnnSearch(e.target.value)} className="h-9 w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Ristoratore</th><th className="pr-3">Ruolo</th><th className="pr-3">Data turno</th><th className="pr-3">Stato</th><th className="pr-3">Candidature</th><th>Azioni</th></tr>
                </thead>
                <tbody>
                  {annsFiltered.slice(0, 200).map(a => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 pr-3">{a.restaurant_name}</td>
                      <td className="pr-3 capitalize">{a.professional_profile ?? "—"}</td>
                      <td className="pr-3">{a.service_date ? new Date(a.service_date).toLocaleDateString("it-IT") : "—"}</td>
                      <td className="pr-3 capitalize">{a.status ?? "—"}</td>
                      <td className="pr-3">{a.apps_count}</td>
                      <td><Link to="/announcements/$id" params={{ id: a.id }}><Button size="sm" variant="outline">Apri</Button></Link></td>
                    </tr>
                  ))}
                  {annsFiltered.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nessun annuncio</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* CREDITI */}
        <TabsContent value="credits" className="space-y-6">
          <div className="rounded-2xl border bg-card p-5">
            <div className="font-medium mb-3">Saldo crediti ristoratori</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Ristoratore</th><th className="pr-3">Email</th><th className="pr-3">Crediti</th></tr>
                </thead>
                <tbody>
                  {[...restaurants].sort((a,b)=>(b.credits ?? 0)-(a.credits ?? 0)).slice(0, 200).map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-3">{r.business_name ?? r.full_name ?? "—"}</td>
                      <td className="pr-3">{r.email ?? "—"}</td>
                      <td className="pr-3 font-medium">{r.credits ?? 0}</td>
                    </tr>
                  ))}
                  {restaurants.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Nessun dato</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="font-medium mb-3">Storico movimenti crediti (ultimi 200)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Data</th><th className="pr-3">Utente</th><th className="pr-3">Variazione</th><th className="pr-3">Saldo dopo</th><th className="pr-3">Motivo</th></tr>
                </thead>
                <tbody>
                  {creditTx.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 pr-3">{new Date(t.created_at).toLocaleString("it-IT")}</td>
                      <td className="pr-3">{t.user_name ?? "—"}</td>
                      <td className={`pr-3 font-medium ${t.delta < 0 ? "text-destructive" : "text-emerald-600"}`}>{t.delta > 0 ? `+${t.delta}` : t.delta}</td>
                      <td className="pr-3">{t.balance_after}</td>
                      <td className="pr-3 text-muted-foreground">{t.reason ?? "—"}</td>
                    </tr>
                  ))}
                  {creditTx.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Nessun movimento</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* RECENSIONI */}
        <TabsContent value="reviews" className="space-y-6">
          <div className="rounded-2xl border bg-card p-5">
            <div className="font-medium mb-3">Recensioni recenti ({reviews.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Data</th><th className="pr-3">Autore</th><th className="pr-3">Destinatario</th><th className="pr-3">Voto</th><th className="pr-3">Commento</th></tr>
                </thead>
                <tbody>
                  {reviews.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-3">{new Date(r.created_at).toLocaleDateString("it-IT")}</td>
                      <td className="pr-3">{r.author_name ?? "—"}</td>
                      <td className="pr-3">{r.target_name ?? "—"}</td>
                      <td className="pr-3 font-medium">{r.rating}/5</td>
                      <td className="pr-3 text-muted-foreground max-w-md truncate">{r.comment ?? "—"}</td>
                    </tr>
                  ))}
                  {reviews.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Nessuna recensione</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <AdminRequiredReviewsSection />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function statusBadge(s: string | null | undefined, vat: string | null | undefined) {
  if (!vat) return <span className="text-xs text-muted-foreground">Mancante</span>;
  if (s === "valid") return <span className="text-xs text-emerald-600 font-medium">Verificata</span>;
  if (s === "pending") return <span className="text-xs text-amber-600">In attesa</span>;
  if (s === "invalid") return <span className="text-xs text-destructive">Non verificata</span>;
  return <span className="text-xs text-muted-foreground">Non verificata</span>;
}

function defaultsCell(r: any) {
  if (!hasSavedDefaults(r)) return <span className="text-xs text-muted-foreground">—</span>;
  const when = r.default_settings_updated_at
    ? new Date(r.default_settings_updated_at).toLocaleDateString("it-IT")
    : null;
  const summary: string[] = [];
  if ((r.default_required_skills || []).length) summary.push(`${r.default_required_skills.length} comp.`);
  if ((r.default_dress_code_items || []).length) summary.push(`${r.default_dress_code_items.length} dress`);
  if ((r.default_language_requirements || []).length) summary.push(`${r.default_language_requirements.length} lingue`);
  return (
    <div className="text-xs">
      <div className="text-emerald-600 font-medium">Attive{when ? ` · ${when}` : ""}</div>
      {summary.length > 0 && <div className="text-muted-foreground">{summary.join(" · ")}</div>}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="font-medium mb-3">{title}</div>
      {entries.length === 0 ? <div className="text-sm text-muted-foreground">Nessun dato</div> : (
        <ul className="space-y-1 text-sm">
          {entries.map(([k,v]) => (
            <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-medium">{v}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
