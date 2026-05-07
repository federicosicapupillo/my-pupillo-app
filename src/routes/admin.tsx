import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Pupillo" }] }),
  component: () => <RequireAuth><Admin /></RequireAuth>,
});

function Admin() {
  const { role } = useAuth();
  const [k, setK] = useState({ users: 0, anns: 0, apps: 0, assigned: 0 });

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      const [u, a, ap, asg] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("announcements").select("*", { count: "exact", head: true }).eq("status", "assigned"),
      ]);
      setK({ users: u.count ?? 0, anns: a.count ?? 0, apps: ap.count ?? 0, assigned: asg.count ?? 0 });
    })();
  }, [role]);

  if (role !== "admin") return <AppShell><p className="text-muted-foreground">Accesso riservato agli amministratori.</p></AppShell>;

  return (
    <AppShell>
      <PageHeader title="Pannello Admin" subtitle="Statistiche piattaforma" />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Utenti", v: k.users },
          { l: "Annunci", v: k.anns },
          { l: "Candidature", v: k.apps },
          { l: "Servizi assegnati", v: k.assigned },
        ].map(s => (
          <div key={s.l} className="rounded-2xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-semibold">{s.v}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}