import * as React from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 500;
const OUT_DIM = 800;

type Props = {
  value: string | null;
  onPickFile: (file: File | null, previewUrl: string | null) => void;
};

/** Center-crops the image into a square, resizes to OUT_DIM, returns JPEG File. */
async function processImage(file: File): Promise<{ file: File; preview: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  if (img.naturalWidth < MIN_DIM || img.naturalHeight < MIN_DIM) {
    throw new Error(`Immagine troppo piccola: minimo ${MIN_DIM}x${MIN_DIM} px.`);
  }
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_DIM;
  canvas.height = OUT_DIM;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT_DIM, OUT_DIM);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Errore conversione immagine"))), "image/jpeg", 0.9),
  );
  const out = new File([blob], "avatar.jpg", { type: "image/jpeg" });
  return { file: out, preview: URL.createObjectURL(blob) };
}

export function AvatarUpload({ value, onPickFile }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [hasLocal, setHasLocal] = React.useState(false);

  const display = preview ?? value ?? null;

  const handleFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      toast.error("Formato non supportato. Usa JPG, PNG o WEBP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File troppo grande. Massimo 5MB.");
      return;
    }
    setBusy(true);
    try {
      const { file, preview: p } = await processImage(f);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(p);
      setHasLocal(true);
      onPickFile(file, p);
      toast.success("Anteprima aggiornata. Salva per confermare.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento immagine.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setHasLocal(false);
    if (inputRef.current) inputRef.current.value = "";
    onPickFile(null, null);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
        {display ? (
          <img src={display} alt="Foto profilo" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-8 w-8 text-muted-foreground" />
        )}
        {busy && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {display ? "Sostituisci foto" : "Carica foto"}
          </Button>
          {hasLocal && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={busy}>
              <X className="h-4 w-4 mr-1" /> Rimuovi
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG o WEBP · min 500×500 px · max 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          capture="user"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}