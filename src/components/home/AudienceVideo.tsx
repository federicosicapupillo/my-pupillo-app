import { Clock } from "lucide-react";
import mascot from "@/assets/pupillo-mascot.png";
import type { HomeVideo } from "@/lib/home-videos";

/** Video nativo (no autoplay, preload none) oppure anteprima onesta «Video in arrivo». */
export function AudienceVideo({ video, accent }: { video: HomeVideo; accent: string }) {
  if (video.src) {
    return (
      <video
        className="aspect-video w-full rounded-2xl border border-border bg-muted"
        controls
        preload="none"
        playsInline
        poster={video.poster ?? undefined}
        aria-label={video.title}
      >
        <source src={video.src} />
      </video>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${video.title}: video in arrivo`}
      className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(60% 70% at 50% 40%, ${accent}, transparent 70%)` }}
      />
      <img src={mascot} alt="" loading="lazy" className="relative h-2/3 w-auto object-contain" />
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden /> Video in arrivo
      </span>
    </div>
  );
}
