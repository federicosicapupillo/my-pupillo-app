import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { previewDemoReset, executeDemoReset, completeDemoProfilesFn } from "@/lib/demo-seed.functions";

export const Route = createFileRoute("/admin/reset-test-db")({
  head: () => ({ meta: [{ title: "Reset DB Demo — Admin" }] }),
  component: () => (
    <RequireRole allow={["admin"]}>
      <ResetTestDbPage />
    </RequireRole>
  ),
});

function ResetTestDbPage() {
  const preview = useServerFn(previewDemoReset);
  const execute = useServerFn(executeDemoReset);
  const completeProfiles = useServerFn(completeDemoProfilesFn);
  const [completing, setCompleting] = useState(false);
  const [completeReport, setCompleteReport] = useState<any>(null);

  const [emails, setEmails] = useState("");
  const [phones, setPhones] = useState("");
  const [restaurants, setRestaurants] = useState(100);
  const [workers, setWorkers] = useState(300);
  const [previewData, setPreviewData] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [ack, setAck] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any>(null);

  const parsedEmails = emails.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const parsedPhones = phones.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);

  async function runCompleteProfiles() {
    setCompleting(true);
    setCompleteReport(null);
    try {
      const r = await completeProfiles();
      setCompleteReport(r);
      toast.success(`Profili demo completati: ${r.updatedWorkers} lavoratori, ${r.updatedRestaurants} ristoratori`);
    } catch (e: any) {
      toast.error(e?.message ?? "Errore completamento profili");
    } finally {
      setCompleting(false);
    }
  }

  async function runPreview() {
    setLoadingPreview(true);
    setReport(null);
    try {
      const r = await preview({ data: { emails: parsedEmails, phones: parsedPhones } });
      setPreviewData(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Errore anteprima");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function runReset() {
    if (confirmText !== "RESET DEMO" || !ack) {
      toast.error("Conferma mancante");
      return;
    }
    setRunning(true);
    try {
      const r = await execute({
        data: {
          confirm: confirmText,
          emails: parsedEmails,
          phones: parsedPhones,
          restaurants,
          workers,
        },
      });
      setReport(r);
      toast.success("Reset completato");
    } catch (e: any) {
      toast.error(e?.message ?? "Reset bloccato");
    } finally {
      setRunning(false);
    }
  }

  const safety = previewData?.safety;
  const blocked = safety?.reasonsBlocked?.length > 0;

  return (
    <AppShell>
      <PageHeader
        title="Reset DB Demo"
        subtitle="Pulizia e ripopolamento dei soli dati demo (is_demo=true)"
        action={<Link to="/admin"><Button variant="outline" size="sm">← Admin</Button></Link>}
      />

      <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/30 p-4 mb-6 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium mb-1">Solo ambiente di test</div>
          <p className="text-muted-foreground">
            Questa operazione elimina <strong>solo</strong> i record con <code>is_demo = true</code> e ricrea
            utenti demo con email <code>@pupillo.test</code>. Nessun utente reale viene toccato.
            Nessuna email, SMS, WhatsApp, notifica push o pagamento reale viene inviato.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-5 mb-6 space-y-3">
        <h2 className="font-medium">Completa profili test</h2>
        <p className="text-sm text-muted-foreground">
          Riempie automaticamente i campi mancanti su tutti i profili demo (<code>is_demo = true</code>):
          foto/avatar, telefono fittizio confermato, documenti fake, indirizzo, città, lat/lng,
          ruoli, disponibilità e <code>profile_completed = true</code>. Non tocca alcun profilo reale.
        </p>
        <Button onClick={runCompleteProfiles} disabled={completing} className="w-full sm:w-auto">
          {completing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Completa profili test
        </Button>
        {completeReport && (
          <div className="text-sm border-t pt-3 space-y-1">
            <div>Profili analizzati: <strong>{completeReport.scannedProfiles}</strong></div>
            <div>Lavoratori aggiornati: <strong>{completeReport.updatedWorkers}</strong></div>
            <div>Ristoratori aggiornati: <strong>{completeReport.updatedRestaurants}</strong></div>
            <div>Profili reali ignorati: <strong>{completeReport.skippedRealProfiles}</strong></div>
            <div className="text-muted-foreground text-xs">Durata: {(completeReport.durationMs / 1000).toFixed(1)}s</div>
            {completeReport.errors?.length > 0 && (
              <details className="text-xs text-destructive">
                <summary>Errori ({completeReport.errors.length})</summary>
                <ul className="max-h-40 overflow-y-auto mt-1">
                  {completeReport.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="font-medium">Parametri</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rest">Ristoratori demo</Label>
              <Input id="rest" type="number" min={1} max={200} value={restaurants}
                onChange={(e) => setRestaurants(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="work">Lavoratori demo</Label>
              <Input id="work" type="number" min={1} max={500} value={workers}
                onChange={(e) => setWorkers(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label htmlFor="we">Whitelist email (opzionale, separate da virgola)</Label>
            <Input id="we" placeholder="me@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wp">Whitelist telefoni (opzionale)</Label>
            <Input id="wp" placeholder="+39..." value={phones} onChange={(e) => setPhones(e.target.value)} />
          </div>
          <Button onClick={runPreview} disabled={loadingPreview} variant="outline" className="w-full">
            {loadingPreview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Calcola anteprima
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Stato protezioni</h2>
          {!safety && <p className="text-sm text-muted-foreground">Esegui l'anteprima per vedere lo stato.</p>}
          {safety && (
            <ul className="text-sm space-y-1.5">
              <SafetyRow label="DEMO_SEED_MODE" value={safety.demoSeedMode ? "attivo" : "spento"} ok={safety.demoSeedMode} />
              <SafetyRow label="Service role" value={safety.serviceRoleAvailable ? "disponibile" : "mancante"} ok={safety.serviceRoleAvailable} />
              <SafetyRow label="WhatsApp" value={safety.whatsapp} ok={safety.whatsapp !== "live" || safety.whitelist.phones.length > 0} />
              <SafetyRow label="Email" value={safety.email} ok={safety.email !== "live" || safety.whitelist.emails.length > 0} />
              <SafetyRow label="SMS" value={safety.sms} ok={safety.sms !== "live" || safety.whitelist.phones.length > 0} />
              <SafetyRow label="Pagamenti" value={safety.payments} ok={safety.payments !== "live"} />
              <SafetyRow label="Notifiche reali" value={safety.realNotifications} ok={true} />
            </ul>
          )}
          {blocked && (
            <div className="text-xs text-destructive border border-destructive/40 rounded-md p-2 mt-2">
              Reset bloccato: <br />
              {safety.reasonsBlocked.map((r: string) => <div key={r}>• {r}</div>)}
            </div>
          )}
        </section>
      </div>

      {previewData && (
        <section className="rounded-2xl border bg-card p-5 mt-6 space-y-4">
          <h2 className="font-medium">Anteprima</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <div className="font-medium mb-1">Verranno eliminati (solo demo)</div>
              <ul className="text-muted-foreground space-y-0.5">
                {Object.entries(previewData.willDelete).map(([k, v]: any) => (
                  <li key={k}>{k}: <strong>{v}</strong></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium mb-1">Verranno creati</div>
              <ul className="text-muted-foreground space-y-0.5">
                <li>Ristoratori: <strong>{restaurants}</strong></li>
                <li>Lavoratori: <strong>{workers}</strong></li>
                <li>~Annunci: <strong>{previewData.willCreate.announcements}</strong></li>
                <li>~Candidature: <strong>{previewData.willCreate.applications}</strong></li>
                <li>~Turni: <strong>{previewData.willCreate.shifts}</strong></li>
                <li>~Recensioni: <strong>{previewData.willCreate.reviews}</strong></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(!!v)} disabled={blocked} />
              <Label htmlFor="ack" className="text-sm leading-tight">
                Confermo: solo i record demo verranno eliminati, nessun utente reale verrà cancellato,
                nessuna integrazione esterna reale verrà attivata.
              </Label>
            </div>
            <div>
              <Label htmlFor="conf">Per procedere scrivi <code>RESET DEMO</code></Label>
              <Input id="conf" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} disabled={blocked} />
            </div>
            <Button
              onClick={runReset}
              disabled={running || blocked || !ack || confirmText !== "RESET DEMO"}
              variant="destructive"
              className="w-full"
            >
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Esegui reset e ripopola (3-6 min)
            </Button>
          </div>
        </section>
      )}

      {report && (
        <section className="rounded-2xl border bg-card p-5 mt-6 space-y-3 text-sm">
          <h2 className="font-medium">Report finale</h2>
          <p className="text-muted-foreground">Batch: <code>{report.batchId}</code> — durata {(report.durationMs / 1000).toFixed(1)}s</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="font-medium mb-1">Eliminati per tabella</div>
              <ul className="text-muted-foreground">
                {Object.entries(report.deletedPerTable).map(([k, v]: any) => (
                  <li key={k}>{k}: <strong>{v}</strong></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium mb-1">Creati per tabella</div>
              <ul className="text-muted-foreground">
                {Object.entries(report.createdPerTable).map(([k, v]: any) => (
                  <li key={k}>{k}: <strong>{v}</strong></li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">Record reali preservati (is_demo=false, intatti)</div>
            <ul className="text-muted-foreground">
              {report.preservedNonDemo.map((r: any) => (
                <li key={r.table}>{r.table}: <strong>{r.count}</strong></li>
              ))}
            </ul>
          </div>
          {report.errors?.length > 0 && (
            <div>
              <div className="font-medium mb-1 text-destructive">Errori ({report.errors.length})</div>
              <ul className="text-xs text-destructive max-h-48 overflow-y-auto">
                {report.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}

function SafetyRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
        {value}
      </span>
    </li>
  );
}