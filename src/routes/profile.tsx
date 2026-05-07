import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profilo — Pupillo" }] }),
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

function Profile() {
  const { profile, role, user } = useAuth();
  return (
    <AppShell>
      <PageHeader title="Il tuo profilo" subtitle="Visualizza e modifica le tue informazioni" action={<Link to="/onboarding"><Button>Modifica</Button></Link>} />
      <div className="rounded-2xl border bg-card p-6 max-w-2xl space-y-3">
        <Row label="Email" value={user?.email} />
        <Row label="Ruolo" value={role} />
        <Row label="Nome" value={profile?.full_name} />
        <Row label="Telefono" value={profile?.phone} />
        {role === "restaurant" && (<>
          <Row label="Nome locale" value={profile?.business_name} />
          <Row label="Partita IVA" value={profile?.vat_number} />
          <Row label="Tipo locale" value={profile?.venue_type} />
          <Row label="Indirizzo" value={profile?.address} />
          <Row label="Fascia prezzo" value={profile?.price_range} />
        </>)}
        {role === "worker" && (<>
          <Row label="Età" value={profile?.age?.toString()} />
          <Row label="Lingue" value={profile?.languages?.join(", ")} />
          <Row label="Profilo professionale" value={profile?.professional_profile} />
        </>)}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}