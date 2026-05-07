import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, Users, MessageSquare, AlertCircle, Coins, CheckCircle2, Calendar, MapPin, ArrowRight } from "lucide-react";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pupillo" }] }),
  component: () => <RequireAuth><DashboardInner /></RequireAuth>,
});

function DashboardInner() {
  const { profile, role, user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ active: 0, assigned: 0, applications: 0, messages: 0 });
  const [assignedList, setAssignedList] = useState<Array<{ id: string; service_date: string; service_time: string; location_address: string; assigned_worker_id: string | null; worker_name?: string | null }>>([]);

  useEffect(() => {
    if (!user || !role) return;
    if (profile && !profile.profile_completed) nav({ to: "/onboarding" });
  }, [user, role, profile, nav]);

  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      if (role === "restaurant") {
        const { count: active } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "active");
        const { count: assignedCount } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "assigned");
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id);
        const { data: appIds } = await supabase.from("applications").select("id").eq("restaurant_id", user.id);
        const ids = (appIds ?? []).map((a) => a.id);
        const { count: msgs } = ids.length
          ? await supabase.from("messages").select("*", { count: "exact", head: true }).in("application_id", ids)
          : { count: 0 };
        setStats({ active: active ?? 0, assigned: assignedCount ?? 0, applications: apps ?? 0, messages: msgs ?? 0 });
        // Anteprima annunci assegnati (max 5, ordinati per data servizio)
        const { data: assignedRows } = await supabase
          .from("announcements")
          .select("id, service_date, service_time, location_address, assigned_worker_id")
          .eq("restaurant_id", user.id)
          .eq("status", "assigned")
          .order("service_date", { ascending: true })
          .limit(5);
        const rows = (assignedRows ?? []) as any[];
        const workerIds = Array.from(new Set(rows.map(r => r.assigned_worker_id).filter(Boolean)));
        let nameMap: Record<string, string> = {};
        if (workerIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", workerIds);
          (profs ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
        }
        setAssignedList(rows.map(r => ({ ...r, worker_name: r.assigned_worker_id ? nameMap[r.assigned_worker_id] ?? null : null })));
      } else if (role === "worker") {
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("worker_id", user.id);
        const { data: appIds } = await supabase.from("applications").select("id").eq("worker_id", user.id);
        const ids = (appIds ?? []).map((a) => a.id);
        const { count: msgs } = ids.length
          ? await supabase.from("messages").select("*", { count: "exact", head: true }).in("application_id", ids)
          : { count: 0 };
        setStats({ active: 0, assigned: 0, applications: apps ?? 0, messages: msgs ?? 0 });
      }
    })();
  }, [user, role]);

  return (
    <AppShell>
      <PageHeader
        title={`Ciao ${profile?.full_name || ""} 👋`}
        subtitle={role === "restaurant" ? "Gestisci i tuoi annunci e trova personale extra." : role === "worker" ? "Visualizza le offerte e gestisci le tue candidature." : "Pannello amministratore."}
        action={role === "restaurant" && (
          <Link to="/announcements/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo annuncio</Button></Link>
        )}
      />

      {profile && !profile.profile_completed && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium text-yellow-900">Profilo incompleto</div>
            <div className="text-sm text-yellow-800">Completa il profilo per usare tutte le funzionalità.</div>
          </div>
          <Link to="/onboarding"><Button size="sm">Completa</Button></Link>
        </div>
      )}

      <div className={`grid gap-4 ${role === "restaurant" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard icon={Briefcase} label={role === "restaurant" ? "Annunci attivi" : "Candidature"} value={role === "restaurant" ? stats.active : stats.applications} />
        {role === "restaurant" && (
          <Link to="/announcements" search={{ status: "assigned" } as never} className="block">
            <StatCard icon={CheckCircle2} label="Annunci assegnati" value={stats.assigned} highlight />
          </Link>
        )}
        <StatCard icon={Users} label="Candidature totali" value={stats.applications} />
        <StatCard icon={MessageSquare} label="Messaggi" value={stats.messages} />
      </div>

      {role === "restaurant" && assignedList.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold">Turni assegnati da gestire</h2>
            </div>
            <Link to="/announcements" search={{ status: "assigned" } as never}>
              <Button variant="ghost" size="sm" className="gap-1">Vedi tutti <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          <ul className="divide-y">
            {assignedList.map((a) => (
              <li key={a.id}>
                <Link to="/announcements/$id" params={{ id: a.id }} className="flex items-center justify-between py-3 hover:bg-accent/40 -mx-2 px-2 rounded-md transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.service_time?.slice(0,5)}</span>
                      {a.worker_name && <span className="text-xs rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5">→ {a.worker_name}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.location_address}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {role === "restaurant" && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Saldo crediti</div>
              <div className="text-2xl font-semibold">{profile?.credits ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Pubblica annuncio: 1 credito · Urgente: 3 · Invita lavoratore: 2
              </div>
            </div>
          </div>
          <Link to="/billing"><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" />Acquista crediti</Button></Link>
        </div>
      )}

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-2">Cosa puoi fare ora</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          {role === "restaurant" && <>
            <li>Crea un nuovo annuncio per il prossimo servizio</li>
            <li>Cerca lavoratori disponibili nella tua zona</li>
            <li>Chatta con i candidati interessati</li>
          </>}
          {role === "worker" && <>
            <li>Aggiorna il tuo profilo professionale</li>
            <li>Rispondi alle offerte ricevute</li>
            <li>Imposta la tua zona di interesse</li>
          </>}
          {role === "admin" && <li>Apri il pannello Admin per gestire utenti e annunci</li>}
        </ul>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: typeof Briefcase; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 transition-colors ${highlight ? "hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-emerald-600" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}