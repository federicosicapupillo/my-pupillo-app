/**
 * Video esplicativi della homepage, uno per pubblico.
 * Finché `src` è null il riquadro mostra un'anteprima con «Video in arrivo»
 * (nessun pulsante play finto). Inserire qui l'URL reale quando disponibile.
 */
export type HomeVideo = { src: string | null; poster: string | null; title: string };

export const HOME_VIDEOS: Record<"worker" | "restaurant", HomeVideo> = {
  worker: { src: null, poster: null, title: "Come funziona Pupillo per i lavoratori" },
  restaurant: { src: null, poster: null, title: "Come funziona Pupillo per ristoranti, bar e locali" },
};
