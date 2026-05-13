import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ID_DOC_ACCEPT_ATTR,
  validateIdDocumentFile,
} from "@/lib/id-document-file";

type Props = {
  /** "Fronte" / "Retro" — drives the visible labels and hints. */
  side: "fronte" | "retro";
  file: File | null;
  storedPath: string | null;
  storedName: string | null;
  preview: string | null;
  onFileSelected: (next: { file: File; preview: string | null; name: string }) => void;
};

/**
 * Single-side ID document picker.
 *
 * - Mobile: `capture="environment"` opens the rear camera directly.
 * - Desktop: standard file picker (gallery / disk).
 * - Accepts JPG/JPEG/PNG/PDF, with magic-byte validation reused from the
 *   existing helper `validateIdDocumentFile`.
 */
export function IdDocumentDropzone({
  side,
  file,
  storedPath,
  storedName,
  preview,
  onFileSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const labelTitle = side === "fronte" ? "Fronte documento" : "Retro documento";
  const cta = side === "fronte" ? "Scatta o carica fronte" : "Scatta o carica retro";
  const hasFile = !!file || !!storedPath;

  async function accept(f: File | null) {
    if (!f) return;
    const check = await validateIdDocumentFile(f);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const isImage = f.type === "image/jpeg" || f.type === "image/png";
    onFileSelected({
      file: f,
      preview: isImage ? URL.createObjectURL(f) : null,
      name: f.name,
    });
  }

  return (
    <div className="space-y-2">
      <Label className="font-medium">{labelTitle} *</Label>
      <input
        ref={inputRef}
        type="file"
        accept={ID_DOC_ACCEPT_ATTR}
        className="hidden"
        onChange={async (e) => {
          await accept(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          await accept(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={cta}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          await accept(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex flex-col items-center justify-center gap-2 w-full min-h-[150px] px-4 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center select-none ${
          dragging
            ? "border-primary bg-primary/10"
            : hasFile
              ? "border-emerald-500/60 bg-emerald-500/5 hover:bg-emerald-500/10"
              : "border-border bg-muted/30 hover:bg-muted/50"
        }`}
      >
        <div className="text-3xl" aria-hidden>
          {hasFile ? "✅" : side === "fronte" ? "🪪" : "🔄"}
        </div>
        <div className="text-base font-medium">
          {hasFile ? `Sostituisci ${side}` : cta}
        </div>
        <div className="text-xs text-muted-foreground">
          Trascina, tocca per la galleria o usa la fotocamera
        </div>
        {(file || storedName) && (
          <div className="mt-1 text-xs text-foreground break-all max-w-full">
            📎 {file?.name ?? storedName}
            <span className="text-muted-foreground">
              {file ? " (nuovo file da salvare)" : " (già caricato)"}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="text-xs underline text-primary hover:no-underline"
        >
          📷 Usa fotocamera
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs underline text-primary hover:no-underline"
        >
          🖼️ Scegli dalla galleria/file
        </button>
      </div>
      {preview && (
        <img
          src={preview}
          alt={`Anteprima ${side} documento`}
          className="max-h-40 rounded-lg border object-contain bg-background"
        />
      )}
    </div>
  );
}
