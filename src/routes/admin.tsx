import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
        <Breakdown title="Annunci per città" data={byCity} />
        <Breakdown title="Annunci per ruolo" data={byRole} />
      </div>
    </AppShell>
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