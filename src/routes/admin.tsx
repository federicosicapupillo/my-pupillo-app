import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
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

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Pupillo" }] }),
  component: () => <RequireAuth><Admin /></RequireAuth>,
});

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
      const restaurantIds = (await supabase.from("user_roles").select("user_id").eq("role","restaurant")).data?.map((r:any)=>r.user_id) ?? [];
      if (restaurantIds.length) {
        const { data: rows } = await supabase
          .from("profiles")
          .select("id,full_name,business_name,vat_number,vat_status,vat_company_name,vat_verified_at,venue_type,venue_type_other,city,price_range")
          .in("id", restaurantIds)
          .order("vat_verified_at", { ascending: false });
        setVatList(rows ?? []);
        const bv: Record<string, number> = {};
        (rows ?? []).forEach((r: any) => {
          const label = venueTypeLabel(r.venue_type, r.venue_type_other);
          if (label && label !== "—") bv[label] = (bv[label] || 0) + 1;
        });
        setByVenue(bv);
        const bpr: Record<string, number> = {};
        (rows ?? []).forEach((r: any) => {
          if (r.price_range) {
            const label = priceRangeLabel(r.price_range);
            bpr[label] = (bpr[label] || 0) + 1;
          }
        });
        setByPrice(bpr);
      }
    })();
  }, [role]);

  if (role !== "admin") return <AppShell><p className="text-muted-foreground">Accesso riservato agli amministratori.</p></AppShell>;

  return (
    <AppShell>
      <PageHeader
        title="Pannello Admin"
        subtitle="Statistiche piattaforma"
        action={<Link to="/mappa"><Button variant="outline" size="sm" className="gap-2"><MapIcon className="h-4 w-4" />Cerca ristoratori sulla mappa</Button></Link>}
      />
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
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Breakdown title="Lavoratori per badge" data={byBadge} />
        <Breakdown title="Ristoratori per piano" data={byPlan} />
        <Breakdown title="Ristoratori per tipologia locale" data={byVenue} />
        <Breakdown title="Ristoratori per fascia di prezzo" data={byPrice} />
        <Breakdown title="Annunci per città" data={byCity} />
        <Breakdown title="Annunci per ruolo" data={byRole} />
      </div>

      <div className="mt-8 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
          <div className="font-medium">Verifica Partita IVA ristoratori</div>
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
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">Ristoratore</th><th className="pr-3">Ragione sociale</th><th className="pr-3">Tipologia</th><th className="pr-3">Fascia prezzo</th><th className="pr-3">P.IVA</th><th className="pr-3">Stato</th><th className="pr-3">Verificata il</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {vatList
                .filter((r) => {
                  const status = r.vat_status ?? (r.vat_number ? "" : "none");
                  if (vatFilter === "none") return !r.vat_number;
                  if (vatFilter !== "all" && status !== vatFilter) return false;
                  if (vatVenueFilter !== "all" && r.venue_type !== vatVenueFilter) return false;
                  if (vatPriceFilter !== "all" && r.price_range !== vatPriceFilter) return false;
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
                <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">Nessun ristoratore</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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