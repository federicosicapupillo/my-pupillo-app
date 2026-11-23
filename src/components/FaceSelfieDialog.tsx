import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evaluateFaceGuide, GUIDE, GUIDE_MESSAGES, type FaceBox, type GuideStatus } from "@/lib/face-guide";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; onCapture: (file: File) => void };

type Detector = { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] }; close: () => void };

let detectorPromise: Promise<Detector> | null = null;
function loadDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    return (await FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.6,
    })) as unknown as Detector;
  })();
  detectorPromise.catch(() => { detectorPromise = null; });
  return detectorPromise;
}

type Segmenter = { segment: (img: HTMLCanvasElement) => { confidenceMasks?: { getAsFloat32Array: () => Float32Array; width: number; height: number }[]; close: () => void }; close: () => void };
let segmenterPromise: Promise<Segmenter> | null = null;
function loadSegmenter(): Promise<Segmenter> {
  segmenterPromise ??= (async () => {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    return (await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })) as unknown as Segmenter;
  })();
  segmenterPromise.catch(() => { segmenterPromise = null; });
  return segmenterPromise;
}

/** Sfondo grigio uniforme per tutte le foto dei lavoratori. */
const BACKGROUND_GREY = "#bfc1c4";
type Beauty = "off" | "medio" | "alto";
const BEAUTY: Record<Beauty, { label: string; blur: number; alpha: number; bright: number }> = {
  off: { label: "Nessuno", blur: 0, alpha: 0, bright: 1 },
  medio: { label: "Bellezza medio", blur: 3, alpha: 0.45, bright: 1.04 },
  alto: { label: "Bellezza alto", blur: 5, alpha: 0.7, bright: 1.08 },
};

/** Selfie guidato: cerchio che diventa verde quando c'è un solo viso centrato. */
export function FaceSelfieDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [status, setStatus] = React.useState<GuideStatus | "loading">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [noDetector, setNoDetector] = React.useState(false);
  const [beauty, setBeauty] = React.useState<Beauty>("off");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) loadSegmenter().catch(() => {}); }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    setStatus("loading"); setError(null); setBusy(false); setNoDetector(false);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      } catch {
        setError("Non riesco ad aprire la fotocamera. Consenti l'accesso alla fotocamera nelle impostazioni del browser e riprova.");
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => {});
      let detector: Detector | null = null;
      try { detector = await loadDetector(); } catch { setNoDetector(true); setStatus("ok"); return; }
      let last = -1;
      const tick = () => {
        if (stopped || !detector) return;
        if (v.readyState >= 2 && v.currentTime !== last) {
          last = v.currentTime;
          try {
            const res = detector.detectForVideo(v, performance.now());
            const boxes: FaceBox[] = res.detections.flatMap((d) => d.boundingBox ? [{ x: d.boundingBox.originX, y: d.boundingBox.originY, width: d.boundingBox.width, height: d.boundingBox.height }] : []);
            setStatus(evaluateFaceGuide(boxes, v.videoWidth, v.videoHeight));
          } catch { /* frame saltato */ }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [open]);

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    try {
      const side = Math.min(v.videoWidth, v.videoHeight);
      const out = Math.min(side, 1024);
      const frame = document.createElement("canvas");
      frame.width = out; frame.height = out;
      const fx = frame.getContext("2d")!;
      fx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, out, out);
      const b = BEAUTY[beauty];
      if (b.alpha > 0) {
        const copy = document.createElement("canvas"); copy.width = out; copy.height = out;
        copy.getContext("2d")!.drawImage(frame, 0, 0);
        fx.globalAlpha = b.alpha;
        fx.filter = `blur(${b.blur}px) brightness(${b.bright})`;
        fx.drawImage(copy, 0, 0);
        fx.globalAlpha = 1; fx.filter = "none";
      }
      // Persona su sfondo grigio uniforme.
      const final = document.createElement("canvas"); final.width = out; final.height = out;
      const ctx = final.getContext("2d")!;
      ctx.fillStyle = BACKGROUND_GREY; ctx.fillRect(0, 0, out, out);
      let composed = false;
      try {
        const seg = await loadSegmenter();
        const res = seg.segment(frame);
        const m = res.confidenceMasks?.[0];
        if (m) {
          const data = m.getAsFloat32Array();
          const mc = document.createElement("canvas"); mc.width = m.width; mc.height = m.height;
          const mctx = mc.getContext("2d")!;
          const img = mctx.createImageData(m.width, m.height);
          for (let i = 0; i < data.length; i++) { img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, data[i] ?? 0)) * 255); }
          mctx.putImageData(img, 0, 0);
          const person = document.createElement("canvas"); person.width = out; person.height = out;
          const pctx = person.getContext("2d")!;
          pctx.filter = "blur(2px)"; pctx.drawImage(mc, 0, 0, out, out); pctx.filter = "none";
          pctx.globalCompositeOperation = "source-in"; pctx.drawImage(frame, 0, 0);
          ctx.drawImage(person, 0, 0);
          composed = true;
        }
        res.close?.();
      } catch { /* segmentazione non disponibile */ }
      if (!composed) {
        setError("Non riesco a preparare lo sfondo grigio. Controlla la connessione e riprova.");
        return;
      }
      await new Promise<void>((resolve) => final.toBlob((blob) => { if (blob) onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" })); resolve(); }, "image/jpeg", 0.92));
    } finally { setBusy(false); }
  };

  const ok = status === "ok";
  const message = error ?? (status === "loading" ? "Avvio della fotocamera…" : noDetector ? "Inquadra il viso nel cerchio e scatta." : GUIDE_MESSAGES[status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scatta la foto del viso</DialogTitle>
          <DialogDescription>Metti la testa dentro il cerchio. Quando diventa verde, premi «Scatta».</DialogDescription>
        </DialogHeader>
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-muted">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
          <div aria-hidden
            className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 transition-colors shadow-[0_0_0_9999px_color-mix(in_oklab,var(--background)_55%,transparent)] ${ok ? "border-compensation-positive" : "border-destructive"}`}
            style={{ width: `${GUIDE.widthRatio * 100}%`, height: `${GUIDE.widthRatio * GUIDE.aspect * 100}%` }} />
          {status === "loading" && !error && <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin" aria-hidden />}
        </div>
        <p role="status" aria-live="polite" className={`text-center text-sm font-medium ${error ? "text-destructive" : ok ? "text-compensation-positive" : "text-foreground"}`}>{message}</p>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Filtro bellezza</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(BEAUTY) as Beauty[]).map((k) => (
              <Button key={k} type="button" size="sm" variant={beauty === k ? "default" : "outline"} aria-pressed={beauty === k} onClick={() => setBeauty(k)}>
                {k === "off" ? "Nessuno" : k === "medio" ? "Medio" : "Alto"}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Lo sfondo viene sostituito con un grigio uniforme, uguale per tutti.</p>
        </fieldset>
        <Button type="button" disabled={!ok || !!error || busy} onClick={capture} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden /> : <Camera className="h-4 w-4 mr-1" aria-hidden />} Scatta
        </Button>
      </DialogContent>
    </Dialog>
  );
}
