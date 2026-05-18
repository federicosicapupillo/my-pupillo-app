import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Database, Users, HardDrive, Code as CodeIcon, FileArchive } from "lucide-react";
import { listAdminBackups, type AdminBackupFile } from "@/lib/admin-backups.functions";

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  full: FileArchive,
  sha256: FileArchive,
  database: Database,
  auth: Users,
  storage: HardDrive,
  code: CodeIcon,
};

export function AdminBackupsSection() {
  const fetchBackups = useServerFn(listAdminBackups);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => fetchBackups(),
    // Signed URLs expire after 30 min; refetch keeps them fresh.
    staleTime: 1000 * 60 * 20,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Backup completo del progetto</h2>
          <p className="text-sm text-muted-foreground">
            Snapshot del 18/05/2026 — database, utenti Auth, Storage e codice. I link
            sono firmati e validi per 30 minuti.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Rinnova link
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Impossibile caricare i backup. Verifica di avere il ruolo admin.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carico…</p>}

      {data && data.length > 0 && (
        <ul className="divide-y">
          {data.map((f: AdminBackupFile) => {
            const Icon = ICONS[f.key] ?? FileArchive;
            const isPrimary = f.key === "full";
            return (
              <li
                key={f.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {f.name} · {formatBytes(f.size)}
                    </div>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant={isPrimary ? "default" : "outline"}
                  className="gap-2"
                >
                  <a href={f.signedUrl} download={f.name} rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Scarica
                  </a>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun file di backup disponibile.</p>
      )}
    </div>
  );
}