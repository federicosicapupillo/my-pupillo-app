import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Loader2, History, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { listBackupLogs, runFullBackup, type BackupLogRow } from "@/lib/backup-system.functions";

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Completato", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    running: { label: "In corso", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
    pending: { label: "In attesa", cls: "bg-muted text-muted-foreground" },
    partial: { label: "Parziale", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
    failed: { label: "Fallito", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    skipped: { label: "Saltato", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function AdminBackupSystemSection() {
  const fetchLogs = useServerFn(listBackupLogs);
  const runBackup = useServerFn(runFullBackup);
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-backup-logs"],
    queryFn: () => fetchLogs(),
    refetchInterval: (q) => {
      const logs = (q.state.data as { logs: BackupLogRow[] } | undefined)?.logs;
      return logs?.[0]?.status === "running" ? 3000 : false;
    },
  });

  const mutation = useMutation({
    mutationFn: () => runBackup(),
    onSuccess: (res) => {
      if (res.status === "completed") toast.success("Backup completato con successo");
      else if (res.status === "partial") toast.warning("Backup completato parzialmente. Controlla lo storico.");
      else toast.error("Backup fallito. Controlla i log.");
      qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
    },
    onError: (e: unknown) => {
      toast.error(`Errore: ${e instanceof Error ? e.message : "sconosciuto"}`);
    },
  });

  const logs = data?.logs ?? [];
  const last = logs[0];
  const isRunning = mutation.isPending || last?.status === "running";

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Backup sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Esegui un backup completo del database, dello storage e del codice progetto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)} className="gap-2">
            <History className="h-4 w-4" />
            {showHistory ? "Nascondi storico" : "Vedi storico backup"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ultimo backup</div>
          <div className="text-sm font-medium">{isLoading ? "Carico…" : formatDate(last?.completed_at ?? last?.started_at ?? last?.created_at ?? null)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Stato</div>
          <div className="text-sm"><StatusBadge status={last?.status ?? null} /></div>
        </div>
        {last && (
          <>
            <div className="text-xs text-muted-foreground sm:col-span-2 flex flex-wrap gap-3">
              <span>Database: <StatusBadge status={last.database_backup_status} /></span>
              <span>Storage: <StatusBadge status={last.storage_backup_status} /></span>
              <span>GitHub: <StatusBadge status={last.github_backup_status} /></span>
            </div>
            {last.error_message && (
              <div className="text-xs text-destructive sm:col-span-2 break-all">
                {last.error_message}
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="gap-2 w-full sm:w-auto" disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Backup in corso…" : "Esegui backup completo"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eseguire backup completo?</AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi davvero eseguire un backup completo del sistema? Verranno salvati database, storage e (se configurato) un tag sul repository GitHub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => mutation.mutate()}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showHistory && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Storico backup</h3>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>Aggiorna</Button>
          </div>
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Nessun backup eseguito.</p>}
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border p-3 text-sm flex flex-wrap items-center gap-3 justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{formatDate(l.created_at)}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>DB: <StatusBadge status={l.database_backup_status} /></span>
                    <span>Storage: <StatusBadge status={l.storage_backup_status} /></span>
                    <span>GitHub: <StatusBadge status={l.github_backup_status} /></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  {l.file_url && (
                    <a href={l.file_url} target="_blank" rel="noreferrer" className="text-primary text-xs inline-flex items-center gap-1">
                      Database <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {l.github_commit_url && (
                    <a href={l.github_commit_url} target="_blank" rel="noreferrer" className="text-primary text-xs inline-flex items-center gap-1">
                      Tag <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}