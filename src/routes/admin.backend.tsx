import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, HardDrive, Lock } from "lucide-react";

export const Route = createFileRoute("/admin/backend")({
  head: () => ({ meta: [{ title: "Backend — Admin Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <BackendInfo />
    </RequireAuth>
  ),
});

const PROJECT = {
  name: "wpczgwxsriezaubncuom",
  ref: "loxgasjxsjyskyapmxke",
  url: "https://loxgasjxsjyskyapmxke.supabase.co",
  region: "aws-1-eu-north-1",
};

const TABLES: string[] = [
  "activity_logs",
  "announcements",
  "applications",
  "credit_transactions",
  "discount_codes",
  "discount_redemptions",
  "favorites",
  "job_requests",
  "messages",
  "notifications",
  "phone_verifications",
  "profiles",
  "proposal_responses",
  "referral_invites",
  "required_reviews",
  "restaurant_worker_favorites",
  "reviews",
  "shifts",
  "subscriptions",
  "user_roles",
  "worker_badges",
  "worker_incidents",
];

const BUCKETS: { name: string; visibility: "private" | "public" }[] = [
  { name: "avatars", visibility: "private" },
  { name: "worker-documents", visibility: "private" },
];

function BackendInfo() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Backend" subtitle="Caricamento…" />
      </AppShell>
    );
  }

  if (role !== "admin") {
    return (
      <AppShell>
        <PageHeader title="Accesso negato" subtitle="Questa pagina è riservata agli amministratori." />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Non hai i permessi per visualizzare questa pagina.{" "}
            <Link to="/" className="text-primary hover:underline">Torna alla home</Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Backend"
        subtitle="Elenco tecnico di tabelle e bucket storage collegati al progetto."
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progetto</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Nome:</span> <code>{PROJECT.name}</code></div>
            <div><span className="text-muted-foreground">Ref:</span> <code>{PROJECT.ref}</code></div>
            <div className="break-all"><span className="text-muted-foreground">URL:</span> <code>{PROJECT.url}</code></div>
            <div><span className="text-muted-foreground">Regione DB:</span> <code>{PROJECT.region}</code></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riepilogo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Tabelle <code>public</code>: <strong>{TABLES.length}</strong></div>
            <div>Bucket storage: <strong>{BUCKETS.length}</strong></div>
            <div className="text-xs text-muted-foreground pt-2">Lista statica — aggiornare manualmente se cambia lo schema.</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Tabelle schema <code>public</code> ({TABLES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {TABLES.map((t) => (
              <code key={t} className="text-xs px-2 py-1 rounded bg-muted truncate">{t}</code>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Bucket storage ({BUCKETS.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {BUCKETS.map((b) => (
              <li key={b.name} className="flex items-center justify-between py-2 text-sm">
                <code>{b.name}</code>
                <Badge variant={b.visibility === "private" ? "secondary" : "default"}>
                  {b.visibility}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}