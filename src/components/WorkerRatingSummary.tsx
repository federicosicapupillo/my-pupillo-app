import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sintesi compatta di rating + numero recensioni RICEVUTE dal lavoratore.
 * Usato in tutte le card lato ristoratore (Mappa, Cerca lavoratori,
 * eventuali altre liste candidati) per garantire coerenza visiva.
 *
 * Regole:
 * - Sorgente dati: `profiles.rating_avg` + `profiles.reviews_count`
 *   (campi aggregati già calcolati dai trigger sui turni/recensioni).
 *   Sono le recensioni RICEVUTE dal lavoratore — non quelle che lui
 *   ha lasciato ad altri.
 * - Se ci sono recensioni: "⭐ 4,8 · 12 recensioni".
 * - Se non ce ne sono: "⭐ Nessuna recensione ancora".
 * - Non inventiamo né dati né stelle.
 */
export interface WorkerRatingSummaryProps {
  ratingAvg?: number | null;
  reviewsCount?: number | null;
  className?: string;
  /** Se true (default), mostra il fallback "Nessuna recensione ancora". */
  showEmpty?: boolean;
  /** Variante compatta usata nelle righe meta della card. */
  size?: "sm" | "md";
}

function formatRatingIT(value: number): string {
  // 4.8 → "4,8" (locale italiana, una sola cifra decimale).
  return value.toFixed(1).replace(".", ",");
}

function formatReviewsCount(count: number): string {
  return `${count} ${count === 1 ? "recensione" : "recensioni"}`;
}

export function WorkerRatingSummary({
  ratingAvg,
  reviewsCount,
  className,
  showEmpty = true,
  size = "sm",
}: WorkerRatingSummaryProps) {
  const count = Number(reviewsCount ?? 0);
  const rating = ratingAvg == null ? null : Number(ratingAvg);
  const hasReviews = count > 0 && rating != null && rating > 0;

  if (!hasReviews) {
    if (!showEmpty) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-muted-foreground",
          size === "md" ? "text-sm" : "text-xs",
          className,
        )}
        aria-label="Nessuna recensione ancora"
      >
        <Star className={size === "md" ? "h-4 w-4" : "h-3 w-3"} aria-hidden />
        <span>Nessuna recensione ancora</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        size === "md" ? "text-sm" : "text-xs",
        className,
      )}
      aria-label={`Valutazione media ${formatRatingIT(rating!)} su 5, ${formatReviewsCount(count)}`}
    >
      <Star
        className={cn(
          size === "md" ? "h-4 w-4" : "h-3 w-3",
          "fill-yellow-400 text-yellow-400",
        )}
        aria-hidden
      />
      <span className="tabular-nums font-medium text-foreground">
        {formatRatingIT(rating!)}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{formatReviewsCount(count)}</span>
    </span>
  );
}

export default WorkerRatingSummary;