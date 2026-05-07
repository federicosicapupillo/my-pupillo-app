import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, Users, MessageSquare, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pupillo" }] }),
  component: () => <RequireAuth><DashboardInner /></RequireAuth>,
});

function DashboardInner() {
  const { profile, role, user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ active: 0, applications: 0, messages: 0 });

  useEffect(() => {
    if (!user || !role) return;
    if (profile && !profile.profile_completed) nav({ to: "/onboarding" });
  }, [user, role, profile, nav]);

  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      if (role === "restaurant") {
        const { count: active } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "active");
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id);
        setStats({ active: active ?? 0, applications: apps ?? 0, messages: 0 });
      } else if (role === "worker") {
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("worker_id", user.id);
        setStats({ active: 0, applications: apps ?? 0, messages: 0 });
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

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Briefcase} label={role === "restaurant" ? "Annunci attivi" : "Candidature"} value={role === "restaurant" ? stats.active : stats.applications} />
        <StatCard icon={Users} label="Candidature totali" value={stats.applications} />
        <StatCard icon={MessageSquare} label="Messaggi" value={stats.messages} />
      </div>

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

function StatCard({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}