import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, ImageIcon, Loader2, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processImage } from "@/components/AvatarUpload";
import { moderateWorkerFacePhoto } from "@/lib/avatar-moderation.functions";

type Props = {
  /** URL visualizzabile della foto già approvata (se presente). */
  value: string | null;
  /** true se `value` è una foto approvata dal server. */
  approved: boolean;
  onApproved: (path: string, displayUrl: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  invalid?: boolean;
};

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Foto viso del lavoratore: scatto frontale o galleria, controllo server prima dell'uso. */
export function FacePhotoCapture({ value, approved, onApproved, onBusyChange, invalid }: Props) {
  const moderate = useServerFn(moderateWorkerFacePhoto);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedPreview, setRejectedPreview] = React.useState<string | null>(null);
  const [lastFile, setLastFile] = React.useState<File | null>(null);
  const [lastKind, setLastKind] = React.useState<string | null>(null);
  const errorId = React.useId();
  const statusId = React.useId();

  React.useEffect(() => () => { if (rejectedPreview) URL.revokeObjectURL(rejectedPreview); }, [rejectedPreview]);

  const setBusy = (b: boolean) => { setChecking(b); onBusyChange?.(b); };

  const submit = async (file: File, preview: string) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await moderate({ data: fd });
      if (res.ok) {
        setRejectedPreview(null);
        setLastFile(null);
        await onApproved(res.path, res.signedUrl ?? preview);
      } else {
        setRejectedPreview(preview);
        setLastKind(res.kind);
        setLastFile(res.kind === "service" ? file : null);
        setError(res.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      setRejectedPreview(preview);
      setLastKind("service");
      setLastFile(file);
      setError(msg.includes("fetch") || msg.includes("network")
        ? "Connessione assente o instabile. Riprova quando sei online."
        : "Controllo della foto non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (f: File | undefined | null) => {
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) { setError("Formato non supportato. Usa una foto JPG, PNG o WEBP."); return; }
    if (f.size > 15 * 1024 * 1024) { setError("La foto è troppo grande."); return; }
    try {
      const { file, preview } = await processImage(f);
      await submit(file, preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Immagine non valida.");
    }
  };

  const display = rejectedPreview ?? value;
  const statusText = checking
    ? "Controllo della foto in corso…"
    : approved && !rejectedPreview && value
      ? "Foto approvata"
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
          {display ? (
            <img src={display} alt={rejectedPreview ? "Foto non approvata" : "Anteprima foto profilo"} className={rejectedPreview ? "h-full w-full object-cover opacity-50" : "h-full w-full object-cover"} />
          ) : (
            <UserRound className="h-10 w-10 text-muted-foreground" aria-hidden />
          )}
          {checking && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button type="button" variant="outline" size="sm" disabled={checking}
              aria-invalid={invalid || !!error} aria-describedby={error ? errorId : undefined}
              onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4 mr-1" aria-hidden /> {value ? "Scatta una nuova foto" : "Scatta una foto"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={checking}
              aria-invalid={invalid || !!error} aria-describedby={error ? errorId : undefined}
              onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-1" aria-hidden /> {value ? "Sostituisci dalla galleria" : "Scegli dalla galleria"}
            </Button>
            {lastFile && lastKind === "service" && !checking && rejectedPreview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => submit(lastFile, rejectedPreview)}>
                <RotateCcw className="h-4 w-4 mr-1" aria-hidden /> Riprova il controllo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Serve una foto frontale e nitida con solo il tuo viso. Viene controllata automaticamente prima di essere usata.
          </p>
          <p id={statusId} role="status" aria-live="polite" className="text-xs font-medium flex items-center gap-1">
            {statusText === "Foto approvata" && <CheckCircle2 className="h-4 w-4 text-compensation-positive" aria-hidden />}
            {statusText}
          </p>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}{value && approved ? " La foto precedente resta attiva." : ""}
            </p>
          )}
        </div>
      </div>
      <input ref={cameraRef} type="file" accept={ACCEPT} capture="user" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}
