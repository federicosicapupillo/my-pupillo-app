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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CleanupReport | null>(null);

  const canConfirm = confirm === "PULISCI DATABASE" && !running;

  async function execute() {
    if (!canConfirm) return;
    setRunning(true);
    try {
      const r = await run({ data: { confirm: "PULISCI DATABASE" } });
      setReport(r);
      setConfirmOpen(false);
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
            <Trash2 className="h-4 w-4 text-destructive" /> Pulizia completa database
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
            Cancella tutti i profili lavoratore e ristoratore, foto, documenti, annunci,
            candidature, turni, chat, notifiche e recensioni. Gli admin verranno mantenuti.
            Assicurati di avere un backup prima di procedere.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Pulisci database
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
            <DialogTitle>Confermi la pulizia completa del database?</DialogTitle>
            <DialogDescription>
              Questa operazione cancellerà tutti i profili lavoratori e ristoratori, inclusi
              foto, documenti, annunci, candidature, turni, chat, notifiche e recensioni.
              Gli admin verranno mantenuti. Assicurati di avere un backup Supabase prima di procedere.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cleanup-confirm">Scrivi <code>PULISCI DATABASE</code> per continuare</Label>
            <Input
              id="cleanup-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="PULISCI DATABASE"
              autoComplete="off"
              disabled={running}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>Annulla</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={!canConfirm}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Procedi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!running) setConfirmOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sei sicuro?</DialogTitle>
            <DialogDescription>
              Questa operazione non può essere annullata senza backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={execute} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confermo pulizia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PopulateTestUsersBlock() {
  const run = useServerFn(populateTestUsers);
  const checkExisting = useServerFn(countExistingTestProfiles);
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState(300);
  const [restaurants, setRestaurants] = useState(100);
  const [running, setRunning] = useState(false);
  const [existing, setExisting] = useState<number | null>(null);
  const [warned, setWarned] = useState(false);
  const [report, setReport] = useState<PopulateReport | null>(null);

  async function openDialog() {
    setReport(null);
    setWarned(false);
    setExisting(null);
    try {
      const r = await checkExisting();
      setExisting(r.existing);
    } catch {/* non bloccante */}
    setOpen(true);
  }

  const needsWarning = (existing ?? 0) > 0 && !warned;

  async function execute() {
    if (running) return;
    if (needsWarning) { setWarned(true); return; }
    setRunning(true);
    try {
      const r = await run({ data: { workers, restaurants } });
      setReport(r);
      setOpen(false);
      toast.success("Utenti di test creati");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore durante la creazione");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="pt-4 border-t">
      <Button variant="secondary" onClick={openDialog}>
        <UsersRound className="h-4 w-4 mr-2" /> Popola utenti di test
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Crea automaticamente profili lavoratore e ristoratore completi al 100% per testare la piattaforma.
      </p>

      {report && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1 mt-4">
          <div className="font-medium">Utenti di test creati</div>
          <p className="text-muted-foreground mb-2">
            La piattaforma è stata popolata con nuovi profili lavoratore e ristoratore completi al 100%.
          </p>
          <div>Lavoratori creati: <strong>{report.seed.createdPerTable.workers ?? 0}</strong></div>
          <div>Ristoratori creati: <strong>{report.seed.createdPerTable.restaurants ?? 0}</strong></div>
          <div>Annunci creati: <strong>{report.seed.createdPerTable.announcements ?? 0}</strong></div>
          <div>Candidature create: <strong>{report.seed.createdPerTable.applications ?? 0}</strong></div>
          <div>Turni creati: <strong>{report.seed.createdPerTable.shifts ?? 0}</strong></div>
          <div>Recensioni create: <strong>{report.seed.createdPerTable.reviews ?? 0}</strong></div>
          <div>Profili completati al 100%: <strong>{report.complete.updatedWorkers + report.complete.updatedRestaurants}</strong></div>
          <div className="pt-2 border-t mt-2">
            <div className="font-medium">Password utenti test: <code>{report.password}</code></div>
            <div className="text-xs text-muted-foreground mt-1">Esempi accesso:</div>
            <ul className="text-xs">
              {report.sampleAccounts.map((a) => <li key={a}><code>{a}</code></li>)}
            </ul>
          </div>
          {(report.seed.errors.length + report.complete.errors.length) > 0 && (
            <details className="text-xs text-destructive pt-2">
              <summary>Errori ({report.seed.errors.length + report.complete.errors.length})</summary>
              <ul className="max-h-40 overflow-y-auto mt-1">
                {[...report.seed.errors, ...report.complete.errors].map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {needsWarning ? "Profili di test già presenti" : "Conferma creazione utenti di test"}
            </DialogTitle>
            <DialogDescription>
              {needsWarning
                ? `Sono già presenti ${existing} profili di test nel database. Puoi continuare e aggiungerne altri, oppure annullare e usare prima la funzione di pulizia.`
                : "Questa operazione creerà nuovi profili lavoratore e ristoratore di test completi al 100%, con dati fittizi, foto profilo di test, ruoli, disponibilità e informazioni operative. Gli utenti creati saranno utilizzabili per simulare il funzionamento della piattaforma."}
            </DialogDescription>
          </DialogHeader>

          {!needsWarning && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pop-workers">Numero lavoratori (1-500)</Label>
                <Input id="pop-workers" type="number" min={1} max={500} value={workers}
                  onChange={(e) => setWorkers(Math.max(1, Math.min(500, Number(e.target.value) || 0)))}
                  disabled={running} />
              </div>
              <div>
                <Label htmlFor="pop-restaurants">Numero ristoratori (1-200)</Label>
                <Input id="pop-restaurants" type="number" min={1} max={200} value={restaurants}
                  onChange={(e) => setRestaurants(Math.max(1, Math.min(200, Number(e.target.value) || 0)))}
                  disabled={running} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>Annulla</Button>
            <Button onClick={execute} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UsersRound className="h-4 w-4 mr-2" />}
              {needsWarning ? "Continua comunque" : "Crea utenti di test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}