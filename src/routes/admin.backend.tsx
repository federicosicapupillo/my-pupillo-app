import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, HardDrive, Lock, Trash2, Loader2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cleanupTestProfiles, type CleanupReport } from "@/lib/cleanup-test-profiles.functions";
import { populateTestUsers, countExistingTestProfiles, type PopulateReport } from "@/lib/populate-test-users.functions";

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

      <TestDataCleanupSection />
    </AppShell>
  );
}

function TestDataCleanupSection() {
  const run = useServerFn(cleanupTestProfiles);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CleanupReport | null>(null);

  const canConfirm = confirm === "CANCELLA TEST" && !running;

  async function execute() {
    if (!canConfirm) return;
    setRunning(true);
    try {
      const r = await run({ data: { confirm: "CANCELLA TEST" } });
      setReport(r);
      setOpen(false);
      setConfirm("");
      toast.success("Pulizia completata");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore durante la pulizia");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="mt-6 border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" /> Gestione dati di test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usa questa funzione per ripulire il database dai profili lavoratore e ristoratore
          creati durante i test. Gli account admin verranno mantenuti.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Ripulisci profili di test
        </Button>

        <PopulateTestUsersBlock />

        {report && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
            <div className="font-medium mb-1">Pulizia completata</div>
            <p className="text-muted-foreground mb-2">
              La pulizia dei profili di test è stata completata. Gli account admin sono stati mantenuti.
            </p>
            <div>Profili lavoratore cancellati: <strong>{report.workersDeleted}</strong></div>
            <div>Profili ristoratore cancellati: <strong>{report.restaurantsDeleted}</strong></div>
            <div>Altri profili cancellati: <strong>{report.otherProfilesDeleted}</strong></div>
            <div>Account auth cancellati: <strong>{report.authUsersDeleted}</strong></div>
            <div>File storage cancellati: <strong>{report.storageFilesDeleted}</strong></div>
            <div>Annunci cancellati: <strong>{report.perTable["announcements"] ?? 0}</strong></div>
            <div>Candidature cancellate: <strong>{report.perTable["applications"] ?? 0}</strong></div>
            <div>Messaggi cancellati: <strong>{report.perTable["messages"] ?? 0}</strong></div>
            <div>Notifiche cancellate: <strong>{report.perTable["notifications"] ?? 0}</strong></div>
            <div>Recensioni cancellate: <strong>{report.perTable["reviews"] ?? 0}</strong></div>
            <div>Disponibilità cancellate: <strong>{(report.perTable["worker_availability"] ?? 0) + (report.perTable["worker_availability_exceptions"] ?? 0)}</strong></div>
            <div>Admin mantenuti: <strong>{report.adminsKept}</strong></div>
            <div className="text-xs text-muted-foreground pt-1">Durata: {(report.durationMs / 1000).toFixed(1)}s</div>
            {report.errors.length > 0 && (
              <details className="text-xs text-destructive pt-2">
                <summary>Errori ({report.errors.length})</summary>
                <ul className="max-h-40 overflow-y-auto mt-1">
                  {report.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { if (!running) { setOpen(v); if (!v) setConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma cancellazione profili di test</DialogTitle>
            <DialogDescription>
              Questa operazione cancellerà definitivamente tutti i profili lavoratore e ristoratore
              di test, comprese foto profilo, annunci, candidature, messaggi, notifiche, recensioni,
              disponibilità e dati collegati. Gli account admin verranno mantenuti.
              L'operazione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cleanup-confirm">Scrivi <code>CANCELLA TEST</code> per continuare</Label>
            <Input
              id="cleanup-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="CANCELLA TEST"
              autoComplete="off"
              disabled={running}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>Annulla</Button>
            <Button variant="destructive" onClick={execute} disabled={!canConfirm}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Cancella profili di test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}