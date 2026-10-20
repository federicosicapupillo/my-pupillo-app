/**
 * Video esplicativi della homepage, uno per pubblico.
 * Finché `src` è null il riquadro mostra un'anteprima con «Video in arrivo»
 * (nessun pulsante play finto). Inserire qui l'URL reale quando disponibile.
 */
import workerVideo from "@/assets/pupillo-lavoratori.mp4.asset.json";
import workerPoster from "@/assets/pupillo-lavoratori-poster.jpg.asset.json";

export type HomeVideo = {
  src: string | null;
  poster: string | null;
  title: string;
  vertical?: boolean;
};

export const HOME_VIDEOS: Record<"worker" | "restaurant", HomeVideo> = {
  worker: {
    src: workerVideo.url,
    poster: workerPoster.url,
    title: "Come funziona Pupillo per i lavoratori",
    vertical: true,
  },
  restaurant: { src: null, poster: null, title: "Come funziona Pupillo per ristoranti, bar e locali" },
};
