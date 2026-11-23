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

/** Selfie guidato: cerchio che diventa verde quando c'è un solo viso centrato. */
export function FaceSelfieDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [status, setStatus] = React.useState<GuideStatus | "loading">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [noDetector, setNoDetector] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    setStatus("loading"); setError(null); setNoDetector(false);
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

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = side; c.height = side;
    c.getContext("2d")?.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, side, side);
    c.toBlob((b) => { if (b) onCapture(new File([b], "selfie.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.92);
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
        <Button type="button" disabled={!ok || !!error} onClick={capture} className="w-full">
          <Camera className="h-4 w-4 mr-1" aria-hidden /> Scatta
        </Button>
      </DialogContent>
    </Dialog>
  );
}
