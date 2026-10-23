/**
 * Video esplicativi della homepage, uno per pubblico.
 * Finché `src` è null il riquadro mostra un'anteprima con «Video in arrivo»
 * (nessun pulsante play finto). Inserire qui l'URL reale quando disponibile.
 */
import workerVideo from "@/assets/pupillo-lavoratori-v2.mp4.asset.json";
import workerPoster from "@/assets/pupillo-lavoratori-v4-poster.png.asset.json";
import restaurantVideo from "@/assets/pupillo-ristoratori-stream.mp4.asset.json";
import restaurantPoster from "@/assets/pupillo-ristoratori-poster.jpg.asset.json";

export type HomeVideo = {
  src: string | null;
  poster: string | null;
  title: string;
  vertical?: boolean;
  preload?: "none" | "metadata";
};

export const HOME_VIDEOS: Record<"worker" | "restaurant", HomeVideo> = {
  worker: {
    src: workerVideo.url,
    poster: workerPoster.url,
    title: "Come funziona Pupillo per i lavoratori",
    vertical: true,
  },
  restaurant: {
    src: restaurantVideo.url,
    poster: restaurantPoster.url,
    title: "Come funziona Pupillo per ristoranti, bar e locali",
    vertical: true,
    preload: "metadata",
  },
};
