import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Download, RotateCcw, Trash2, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listBackupRuns,
  getBackupDownloadUrl,
  deleteBackupRun,
  restoreBackupRun,
  validateBackupRun,
  type BackupRun,
  type RestoreReport,
} from "@/lib/backup-restore.functions";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

type RestoreState =
  | { phase: "idle" }
  | { phase: "first"; run: BackupRun; text: string }
  | { phase: "second"; run: BackupRun }
  | { phase: "running"; run: BackupRun }
  | { phase: "done"; run: BackupRun; report: RestoreReport };

export function AdminBackupRestoreSection() {
  const fetchRuns = useServerFn(listBackupRuns);
  const fetchUrl = useServerFn(getBackupDownloadUrl);
  const removeRun = useServerFn(deleteBackupRun);
  const restoreRun = useServerFn(restoreBackupRun);
  const validateRun = useServerFn(validateBackupRun);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-backup-runs"],
    queryFn: () => fetchRuns(),
    refetchOnWindowFocus: false,
  });

  const runs = data?.runs ?? [];

  // Stato dialog ripristino
  const [restore, setRestore] = useState<RestoreState>({ phase: "idle" });

  // Stato dialog elimina
  const [del, setDel] = useState<{ run: BackupRun; text: string } | null>(null);

  const handleDownload = async (run: BackupRun) => {
    try {
      const { url } = await fetchUrl({ data: { stamp: run.stamp } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download non disponibile");
    }
  };

  const startRestore = async (run: BackupRun) => {
    try {
      const v = await validateRun({ data: { stamp: run.stamp } });
      if (!v.ok) {
        toast.error(v.reason ?? "Backup non valido o non compatibile.");
        return;
      }
      setRestore({ phase: "first", run, text: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validazione fallita");
    }
  };

  const runRestore = async () => {
    if (restore.phase !== "second") return;
    const run = restore.run;
    setRestore({ phase: "running", run });
    try {
      const report = await restoreRun({
        data: { stamp: run.stamp, confirm: "RIPRISTINA BACKUP" },
      });
      setRestore({ phase: "done", run, report });
      qc.invalidateQueries({ queryKey: ["admin-backup-runs"] });
      qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
      if (report.ok) toast.success("Ripristino completato.");
      else toast.warning("Ripristino completato con errori. Controlla il riepilogo.");
    } catch (e) {
      setRestore({ phase: "idle" });
      toast.error(e instanceof Error ? e.message : "Ripristino fallito");
    }
  };

  const confirmDelete = async () => {
    if (!del) return;
    try {
      await removeRun({ data: { stamp: del.run.stamp, confirm: "ELIMINA BACKUP" } });
      toast.success("Backup eliminato.");
      setDel(null);
      qc.invalidateQueries({ queryKey: ["admin-backup-runs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eliminazione fallita");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Backup e ripristino
          </h2>
          <p className="text-sm text-muted-foreground">
            Scarica o ripristina un backup esistente. Prima di ogni ripristino viene creato automaticamente un backup dello stato attuale.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Aggiorna lista
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carico backup disponibili…</p>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          Nessun backup disponibile. Esegui prima un “Backup completo” dalla sezione qui sopra.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.stamp}
              className="rounded-lg border p-3 text-sm flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{formatDate(run.createdAt)}</span>
                  <Badge variant="outline" className="text-[10px]">{run.type ?? "full"}</Badge>
                  {run.status && (
                    <Badge variant="outline" className="text-[10px] capitalize">{run.status}</Badge>
                  )}
                  {run.includesFiles ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      con file storage
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">solo database</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  {run.databasePath} · {formatBytes(run.databaseSize)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownload(run)}>
                  <Download className="h-3.5 w-3.5" />
                  Scarica
                </Button>
                <Button size="sm" className="gap-1" onClick={() => startRestore(run)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ripristina
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => setDel({ run, text: "" })}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Elimina
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog 1: conferma testuale */}
      <AlertDialog
        open={restore.phase === "first"}
        onOpenChange={(v) => { if (!v) setRestore({ phase: "idle" }); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi il ripristino del backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione può sovrascrivere i dati attuali del database. Prima di procedere assicurati di aver creato un backup dello stato attuale (verrà comunque creato automaticamente).
              <br /><br />
              Per procedere scrivi esattamente: <strong>RIPRISTINA BACKUP</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restore.phase === "first" && (
            <Input
              autoFocus
              placeholder="RIPRISTINA BACKUP"
              value={restore.text}
              onChange={(e) => setRestore({ ...restore, text: e.target.value })}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestore({ phase: "idle" })}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={restore.phase !== "first" || restore.text !== "RIPRISTINA BACKUP"}
              onClick={() => restore.phase === "first" && setRestore({ phase: "second", run: restore.run })}
            >
              Avanti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog 2: seconda conferma */}
      <AlertDialog
        open={restore.phase === "second"}
        onOpenChange={(v) => { if (!v) setRestore({ phase: "idle" }); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sei sicuro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione non può essere annullata senza un altro backup. Verrà creato uno snapshot di sicurezza prima del ripristino.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestore({ phase: "idle" })}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={runRestore}>Confermo ripristino</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog running */}
      <AlertDialog open={restore.phase === "running"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Ripristino in corso…
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sto creando uno snapshot di sicurezza e ripristinando i dati del backup. Non chiudere questa pagina.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog done */}
      <AlertDialog
        open={restore.phase === "done"}
        onOpenChange={(v) => { if (!v) setRestore({ phase: "idle" }); }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {restore.phase === "done" && restore.report.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Ripristino completato.
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {restore.phase === "done" ? (
                <div className="space-y-2 text-sm">
                  {restore.report.preRestoreStamp && (
                    <p>
                      Snapshot di sicurezza creato:{" "}
                      <span className="font-mono text-xs">{restore.report.preRestoreStamp}</span>
                    </p>
                  )}
                  {restore.report.includesFilesNotice && (
                    <p className="text-amber-600">
                      Questo backup contiene solo dati database e non include file storage.
                    </p>
                  )}
                  <div className="rounded-lg border bg-muted/30 p-3 max-h-64 overflow-auto">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Righe ripristinate per tabella
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {Object.entries(restore.report.restored).map(([t, n]) => (
                        <li key={t} className="flex justify-between gap-3">
                          <span>{t}</span><span className="tabular-nums">{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {restore.report.errors.length > 0 && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
                      <p className="font-medium text-destructive mb-1">
                        Errori ({restore.report.errors.length})
                      </p>
                      <ul className="space-y-0.5 max-h-32 overflow-auto break-all">
                        {restore.report.errors.slice(0, 20).map((er, i) => (
                          <li key={i}>· {er}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : <span />}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRestore({ phase: "idle" })}>Chiudi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog elimina */}
      <AlertDialog open={!!del} onOpenChange={(v) => { if (!v) setDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Il file verrà rimosso dallo storage e non sarà più recuperabile. Per confermare scrivi{" "}
              <strong>ELIMINA BACKUP</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {del && (
            <Input
              autoFocus
              placeholder="ELIMINA BACKUP"
              value={del.text}
              onChange={(e) => setDel({ ...del, text: e.target.value })}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDel(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!del || del.text !== "ELIMINA BACKUP"}
              onClick={confirmDelete}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}