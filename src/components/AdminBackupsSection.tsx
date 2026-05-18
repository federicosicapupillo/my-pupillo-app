import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw, Database, Users, HardDrive, Code as CodeIcon, FileArchive, Copy, Check, ShieldCheck, FileCheck2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

  const files = data?.files ?? [];
  const sha256 = data?.sha256 ?? null;
  const shaFile = files.find((f) => f.key === "sha256") ?? null;
  const [copied, setCopied] = useState(false);

  // Verification state
  const [expectedInput, setExpectedInput] = useState("");
  const [computed, setComputed] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedSize, setPickedSize] = useState<number>(0);
  const [autoVerifyingKey, setAutoVerifyingKey] = useState<string | null>(null);

  const normalizedExpected = (expectedInput || sha256 || "").trim().toLowerCase().replace(/[^a-f0-9]/g, "");
  const expectedValid = /^[a-f0-9]{64}$/.test(normalizedExpected);
  const match = computed && expectedValid ? computed === normalizedExpected : null;

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setComputed(null);
    setPickedName(file.name);
    setPickedSize(file.size);
    setComputing(true);
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setComputed(hex);
    } catch {
      toast.error("Errore durante il calcolo dello SHA256");
    } finally {
      setComputing(false);
    }
  };

  const handleCopy = async () => {
    if (!sha256) return;
    try {
      await navigator.clipboard.writeText(sha256);
      setCopied(true);
      toast.success("Checksum SHA256 copiato negli appunti");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare negli appunti");
    }
  };

  const handleDownloadAndVerify = async (file: AdminBackupFile) => {
    const isFull = file.key === "full";
    const expected = isFull ? sha256 : null;
    setAutoVerifyingKey(file.key);
    const toastId = toast.loading(
      expected ? `Scarico e verifico ${file.name}…` : `Scarico ${file.name}…`,
    );
    try {
      const res = await fetch(file.signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      let verifiedOk: boolean | null = null;
      if (expected) {
        const digest = await crypto.subtle.digest("SHA-256", buf);
        const hex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        verifiedOk = hex.toLowerCase() === expected.toLowerCase();
        if (isFull) {
          setComputed(hex);
          setPickedName(file.name);
          setPickedSize(buf.byteLength);
        }
        if (!verifiedOk) {
          toast.error(
            "Checksum SHA256 non corrispondente: il file scaricato potrebbe essere corrotto. Non salvato.",
            { id: toastId },
          );
          return;
        }
      }

      const blob = new Blob([buf], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (verifiedOk) {
        toast.success(`Download completato e integrità SHA256 verificata: ${file.name}`, {
          id: toastId,
        });
      } else {
        toast.success(`Download completato: ${file.name}`, { id: toastId });
      }
    } catch (e) {
      toast.error(
        `Errore durante il download: ${e instanceof Error ? e.message : "sconosciuto"}`,
        { id: toastId },
      );
    } finally {
      setAutoVerifyingKey(null);
    }
  };

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

      {sha256 && (
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Checksum SHA256 del backup completo
          </div>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 break-all rounded-md bg-background border px-3 py-2 font-mono text-xs leading-relaxed">
              {sha256}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiato" : "Copia"}
            </Button>
            {shaFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadAndVerify(shaFile)}
                disabled={autoVerifyingKey === shaFile.key}
                className="gap-2 shrink-0"
                title="Scarica il file .sha256 per verificare in locale"
              >
                {autoVerifyingKey === shaFile.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                .sha256
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Verifica l'integrità dopo il download:{" "}
            <code className="font-mono">shasum -a 256 pupillo-full-backup-2026-05-18.zip</code>
          </p>
        </div>
      )}

      {sha256 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Verifica integrità del file scaricato
          </div>
          <p className="text-xs text-muted-foreground">
            Seleziona lo ZIP scaricato: il browser calcola lo SHA256 localmente e lo
            confronta con il checksum atteso. Niente viene inviato al server.
          </p>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <label className="text-xs font-medium text-muted-foreground">
              Checksum atteso (precompilato, modificabile)
            </label>
            <span />
            <Input
              value={expectedInput || sha256}
              onChange={(e) => setExpectedInput(e.target.value)}
              placeholder="64 caratteri esadecimali"
              className="font-mono text-xs"
              maxLength={200}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpectedInput("")}
              className="text-xs"
            >
              Ripristina
            </Button>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              File ZIP scaricato
            </label>
            <Input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="mt-1"
            />
            {pickedName && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {pickedName} · {formatBytes(pickedSize)}
              </p>
            )}
          </div>

          {computing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calcolo SHA256 in corso…
            </div>
          )}

          {computed && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Checksum calcolato dal file
              </div>
              <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {computed}
              </code>

              {!expectedValid && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Il checksum atteso non è un valore SHA256 valido (servono 64 caratteri esadecimali).
                </div>
              )}

              {expectedValid && match === true && (
                <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  Integrità verificata: i checksum corrispondono.
                </div>
              )}

              {expectedValid && match === false && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Mismatch: il file scaricato non corrisponde al checksum atteso. Riscarica il backup.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul className="divide-y">
          {files.map((f: AdminBackupFile) => {
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
                  size="sm"
                  variant={isPrimary ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => handleDownloadAndVerify(f)}
                  disabled={autoVerifyingKey === f.key}
                >
                  {autoVerifyingKey === f.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {autoVerifyingKey === f.key
                    ? isPrimary
                      ? "Verifico…"
                      : "Scarico…"
                    : "Scarica"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {data && files.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun file di backup disponibile.</p>
      )}
    </div>
  );
}