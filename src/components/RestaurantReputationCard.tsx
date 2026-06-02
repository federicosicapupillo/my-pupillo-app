import { useEffect, useState } from "react";
import { Award, Star, MessageSquare, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  loadRestaurantReceivedReviews,
  RestaurantReceivedReviewsList,
} from "@/components/RestaurantReceivedReviews";
import {
  calculateRestaurantReputationScore,
  type RestaurantReputationResult,
} from "@/lib/restaurant-reputation";

/**
 * Dashboard summary block for the restaurant: Reputation Score + last
 * reviews received from workers. Full history lives on
 * /ristoratore/recensioni.
 */
export function RestaurantReputationCard({ restaurantId }: { restaurantId: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RestaurantReputationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { console.log("[PUPILLO_RESTAURANT_REPUTATION_SCORE_LOAD]", { restaurantId }); } catch { /* */ }
      setLoading(true);
      const [{ rows }, shiftsRes] = await Promise.all([
        loadRestaurantReceivedReviews(restaurantId),
        supabase
          .from("shifts")
          .select("status")
          .eq("restaurant_id", restaurantId),
      ]);
      if (cancelled) return;
      const shifts = (shiftsRes.data ?? []) as { status: string }[];
      const total = shifts.length;
      const completed = shifts.filter((s) => s.status === "completed").length;
      const cancelled_ = shifts.filter((s) => s.status === "cancelled").length;
      const r = calculateRestaurantReputationScore(rows, { total, completed, cancelled: cancelled_ });
      try { console.log("[PUPILLO_RESTAURANT_REPUTATION_SCORE_CALCULATED]", { score: r.score, reviews: r.reviewsCount, completionPct: r.completionPct }); } catch { /* */ }
      try { console.log("[PUPILLO_RESTAURANT_REVIEW_TAGS_SUMMARY]", { top: r.topPositiveTags, neg: r.topNegativeTags }); } catch { /* */ }
      setResult(r);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [restaurantId]);

  if (loading || !result) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  const scoreColor =
    result.score >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    result.score >= 60 ? "text-amber-600 dark:text-amber-400" :
    result.score > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Reputation Score
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Il tuo Reputation Score si basa sulle recensioni ricevute dai lavoratori dopo i turni conclusi.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${result.badgeClass}`}>
          {result.badgeLabel}
        </span>
      </div>

      {result.isInConstruction ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
          <div className="font-medium">Reputazione in fase di calcolo</div>
          <p className="text-xs text-muted-foreground mt-1">
            Il punteggio diventa stabile dopo almeno <strong>3 recensioni ricevute</strong>.
            Per ora hai <strong className="tabular-nums">{result.reviewsCount}</strong> recensioni.
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{result.score}</div>
          <div className="text-sm text-muted-foreground mb-1">/100</div>
          <div className="ml-auto text-xs text-muted-foreground">{result.description}</div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Metric icon={Star} label="Media recensioni" value={result.reviewsCount > 0 ? `${result.ratingAvg.toFixed(1)}/5` : "—"} />
        <Metric icon={MessageSquare} label="Recensioni" value={String(result.reviewsCount)} />
        <Metric icon={CheckCircle2} label="Turni conclusi" value={`${result.completionPct}%`} />
        <Metric icon={ThumbsUp} label="Tag positivo top" value={result.topPositiveTag ?? "—"} />
      </div>

      {(result.topPositiveTags.length > 0 || result.topNegativeTags.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.topPositiveTags.length > 0 && (
            <div className="rounded-lg border bg-emerald-500/5 p-3">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1.5 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> Punti di forza più segnalati
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.topPositiveTags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
                ))}
              </div>
            </div>
          )}
          {result.topNegativeTags.length > 0 && (
            <div className="rounded-lg border bg-rose-500/5 p-3">
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1.5 flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" /> Aree da migliorare
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.topNegativeTags.map((t) => (
                  <Badge key={t} variant="destructive" className="text-[11px]">{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Ultime recensioni ricevute</h3>
          <Link to="/ristoratore/recensioni">
            <Button size="sm" variant="ghost" className="gap-1 h-8">Vedi tutte le recensioni</Button>
          </Link>
        </div>
        <RestaurantReceivedReviewsList restaurantId={restaurantId} limit={3} />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}