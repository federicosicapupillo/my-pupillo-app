import * as React from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyPortraitLight, compositeOnStudioBackground, decontaminateEdges, guidedRefineAlpha, maskCoverage, refineAlpha, softenSkin } from "@/lib/portrait-light";
import { evaluateFaceGuide, GUIDE, GUIDE_MESSAGES, type FaceBox, type GuideStatus } from "@/lib/face-guide";

export type PortraitShot = { original: File; final: File; preview: string };
type Props = { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (shot: PortraitShot) => void };

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

type Mask = { getAsFloat32Array: () => Float32Array; width: number; height: number };
type Segmenter = { segment: (img: HTMLCanvasElement) => { confidenceMasks?: Mask[]; close: () => void }; close: () => void };
type LoadedSegmenter = { seg: Segmenter; multiclass: boolean };
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
let segmenterPromise: Promise<LoadedSegmenter> | null = null;
/** Segmentazione multiclasse (capelli, pelle, vestiti, accessori); ripiego sul selfie classico. */
function loadSegmenter(): Promise<LoadedSegmenter> {
  segmenterPromise ??= (async () => {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (url: string) => ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: url }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false,
    }) as unknown as Promise<Segmenter>;
    try {
      return { seg: await make("https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"), multiclass: true };
    } catch {
      return { seg: await make("https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"), multiclass: false };
    }
  })();
  segmenterPromise.catch(() => { segmenterPromise = null; });
  return segmenterPromise;
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.92));

/** Scontorna la persona, applica «Luce ritratto» e mette lo sfondo albicocca. */
async function buildPortrait(frame: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const { seg, multiclass } = await loadSegmenter();
  const res = seg.segment(frame);
  try {
    const m = res.confidenceMasks?.[0];
    if (!m) throw new Error("mask");
    const data = m.getAsFloat32Array();
    const mc = document.createElement("canvas"); mc.width = m.width; mc.height = m.height;
    const mctx = mc.getContext("2d")!;
    const im = mctx.createImageData(m.width, m.height);
    for (let i = 0; i < data.length; i++) {
      const v = Math.min(1, Math.max(0, data[i] ?? 0));
      im.data[i * 4 + 3] = Math.round((multiclass ? 1 - v : v) * 255); // multiclasse: indice 0 = sfondo
    }
    mctx.putImageData(im, 0, 0);
    const out = frame.width;
    const up = document.createElement("canvas"); up.width = out; up.height = out;
    const uctx = up.getContext("2d")!;
    uctx.imageSmoothingQuality = "high";
    uctx.drawImage(mc, 0, 0, out, out);
    const ad = uctx.getImageData(0, 0, out, out).data;
    const coarse = new Float32Array(out * out);
    for (let p = 0; p < coarse.length; p++) coarse[p] = (ad[p * 4 + 3] ?? 0) / 255;
    const final = document.createElement("canvas"); final.width = out; final.height = out;
    const fctx = final.getContext("2d")!;
    fctx.drawImage(frame, 0, 0);
    const img = fctx.getImageData(0, 0, out, out);
    // Bordi agganciati ai contorni reali della foto, poi resi netti con una sfumatura sottile.
    const alpha = guidedRefineAlpha(img.data, coarse, out, out, Math.max(2, Math.round(out / 200)), 1e-5);
    refineAlpha(alpha, 0.42, 0.58);
    if (maskCoverage(alpha) < 0.08) throw new Error("coverage");
    decontaminateEdges(img.data, alpha, out, out);
    softenSkin(img.data, alpha, out, out);
    applyPortraitLight(img.data, alpha);
    compositeOnStudioBackground(img.data, alpha, out, out);
    fctx.putImageData(img, 0, 0);
    return final;
  } finally { res.close?.(); }
}

/** Selfie guidato: cerchio che diventa verde quando c'è un solo viso centrato. */
export function FaceSelfieDialog({ open, onOpenChange, onConfirm }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [status, setStatus] = React.useState<GuideStatus | "loading">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [noDetector, setNoDetector] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [shot, setShot] = React.useState<PortraitShot | null>(null);
  // Ogni apertura/chiusura è una sessione nuova: i risultati di scatti vecchi vengono ignorati.
  const sessionRef = React.useRef(0);
  const shotRef = React.useRef<PortraitShot | null>(null);
  shotRef.current = shot;
  React.useEffect(() => {
    sessionRef.current += 1;
    if (!open && shotRef.current) { URL.revokeObjectURL(shotRef.current.preview); setShot(null); }
  }, [open]);
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
    const sid = sessionRef.current;
    const live = () => sessionRef.current === sid;
    setBusy(true); setError(null);
    try {
      const side = Math.min(v.videoWidth, v.videoHeight);
      const out = Math.min(side, 1024);
      const frame = document.createElement("canvas");
      frame.width = out; frame.height = out;
      frame.getContext("2d")!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, out, out);
      let final: HTMLCanvasElement;
      try { final = await buildPortrait(frame); } catch {
        if (live()) setError("Non riesco a preparare lo sfondo della foto: il servizio di elaborazione non è disponibile. Controlla la connessione e riprova lo scatto.");
        return;
      }
      const [ob, fb] = await Promise.all([toBlob(frame), toBlob(final)]);
      if (!live()) return;
      setShot({ original: new File([ob], "originale.jpg", { type: "image/jpeg" }), final: new File([fb], "ritratto.jpg", { type: "image/jpeg" }), preview: URL.createObjectURL(fb) });
    } catch {
      if (live()) setError("Scatto non riuscito. Riprova.");
    } finally { if (live()) setBusy(false); }
  };

  const ok = status === "ok";
  const message = error ?? (shot ? "Controlla l'anteprima: se ti piace premi «Usa questa foto», altrimenti «Riscatta»." : status === "loading" ? "Avvio della fotocamera…" : noDetector ? "Inquadra il viso nel cerchio e scatta." : GUIDE_MESSAGES[status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scatta la foto del viso</DialogTitle>
          <DialogDescription>Metti la testa dentro il cerchio. Quando diventa verde, premi «Scatta».</DialogDescription>
        </DialogHeader>
        <div role="note" className="rounded-lg border-2 border-primary bg-primary/20 px-4 py-3 text-center text-foreground"><p className="text-2xl font-extrabold">😊 SORRIDI!</p><p className="mt-1 text-base font-semibold">La foto va fatta sorridendo: un bel sorriso fa la differenza con i ristoratori.</p><p className="mt-1 text-base font-bold text-destructive">Senza sorriso la foto non va bene.</p></div>
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-muted">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
          <div aria-hidden
            className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 transition-colors shadow-[0_0_0_9999px_color-mix(in_oklab,var(--background)_55%,transparent)] ${ok ? "border-compensation-positive" : "border-destructive"}`}
            style={{ width: `${GUIDE.widthRatio * 100}%`, height: `${GUIDE.widthRatio * GUIDE.aspect * 100}%` }} />
          {shot && <img src={shot.preview} alt="Anteprima della foto con sfondo albicocca e Luce ritratto" className="absolute inset-0 h-full w-full object-cover" />}
          {status === "loading" && !error && <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin" aria-hidden />}
        </div>
        <p role="status" aria-live="polite" className={`text-center text-sm font-medium ${error ? "text-destructive" : ok ? "text-compensation-positive" : "text-foreground"}`}>{message}</p>
        <p className="text-xs text-muted-foreground">Lo sfondo diventa albicocca, uguale per tutti, e la luce viene corretta in modo leggero («Luce ritratto»).</p>
        {shot ? (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => { URL.revokeObjectURL(shot.preview); setShot(null); }}>
              <RotateCcw className="h-4 w-4 mr-1" aria-hidden /> Riscatta
            </Button>
            <Button type="button" onClick={() => { const s2 = shot; setShot(null); onConfirm(s2); }}>
              <Check className="h-4 w-4 mr-1" aria-hidden /> Usa questa foto
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={!ok || busy} onClick={capture} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden /> : <Camera className="h-4 w-4 mr-1" aria-hidden />} {busy ? "Preparo la foto…" : "Scatta"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
