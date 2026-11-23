import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, Loader2, RotateCcw, UserRound } from "lucide-react";
import { FaceSelfieDialog, type PortraitShot } from "@/components/FaceSelfieDialog";
import { Button } from "@/components/ui/button";
import { moderateWorkerFacePhoto, type FacePhotoResult } from "@/lib/avatar-moderation.functions";

type Props = {
  /** URL visualizzabile della foto già approvata (se presente). */
  value: string | null;
  /** true se `value` è una foto approvata dal server. */
  approved: boolean;
  onApproved: (path: string, displayUrl: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  invalid?: boolean;
  /** Solo per test: sostituisce la chiamata al controllo server. */
  moderateOverride?: (fd: FormData) => Promise<FacePhotoResult>;
};


/** Foto viso del lavoratore: solo scatto dal vivo, sfondo albicocca, controllo server prima dell'uso. */
export function FacePhotoCapture({ value, approved, onApproved, onBusyChange, invalid, moderateOverride }: Props) {
  const serverModerate = useServerFn(moderateWorkerFacePhoto);
  const inFlight = React.useRef(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedPreview, setRejectedPreview] = React.useState<string | null>(null);
  const [lastShot, setLastShot] = React.useState<PortraitShot | null>(null);
  const [lastKind, setLastKind] = React.useState<string | null>(null);
  const errorId = React.useId();
  const statusId = React.useId();

  React.useEffect(() => () => { if (rejectedPreview) URL.revokeObjectURL(rejectedPreview); }, [rejectedPreview]);

  const setBusy = (b: boolean) => { setChecking(b); onBusyChange?.(b); };

  const submit = async (shot: PortraitShot) => {
    const preview = shot.preview;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("original", shot.original);
      fd.append("file", shot.final);
      const res = moderateOverride ? await moderateOverride(fd) : await serverModerate({ data: fd });
      if (res.ok) {
        setRejectedPreview(null);
        setLastShot(null);
        await onApproved(res.path, res.signedUrl ?? preview);
      } else {
        setRejectedPreview(preview);
        setLastKind(res.kind);
        setLastShot(res.kind === "service" ? shot : null);
        setError(res.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      setRejectedPreview(preview);
      setLastKind("service");
      setLastShot(shot);
      setError(msg.includes("fetch") || msg.includes("network")
        ? "Connessione assente o instabile. Riprova quando sei online."
        : "Controllo della foto non riuscito. Riprova.");
    } finally {
      inFlight.current = false;
      setBusy(false);
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
              onClick={() => setCameraOpen(true)}>
              <Camera className="h-4 w-4 mr-1" aria-hidden /> {value ? "Scatta una nuova foto" : "Scatta una foto"}
            </Button>
            {lastShot && lastKind === "service" && !checking && rejectedPreview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => submit(lastShot)}>
                <RotateCcw className="h-4 w-4 mr-1" aria-hidden /> Riprova il controllo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Inquadra il viso nel cerchio: quando diventa verde puoi scattare. La foto viene controllata automaticamente prima di essere usata.
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
      <FaceSelfieDialog open={cameraOpen} onOpenChange={setCameraOpen} onConfirm={(shot) => { setCameraOpen(false); void submit(shot); }} />
    </div>
  );
}
