import { useEffect, useState } from "react";
import { Award, Star, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Worker dashboard "Reputation Score" box.
 *
 * Source of truth = the reviews the worker actually RECEIVED and that are
 * unlocked by the blind reciprocal flow. RLS (`is_review_visible_to`) already
 * hides locked rows from the target, so selecting `target_id = me` returns
 * exactly the reviews that must count. Reviews written BY the worker are
 * excluded by the `target_id` filter.
 */
export function WorkerReputationSummary({ workerId }: { workerId: string }) {
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating, shift_id, is_visible_to_worker")
        .eq("target_id", workerId)
        .not("shift_id", "is", null);
      if (cancelled) return;
      if (error) {
        if (import.meta.env.DEV) console.error("[worker-reputation] load failed", error);
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as { rating: number; is_visible_to_worker: boolean | null }[]).filter(
        (r) => r.is_visible_to_worker !== false,
      );
      setCount(rows.length);
      setAvg(rows.length ? rows.reduce((s, r) => s + Number(r.rating || 0), 0) / rows.length : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workerId]);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <Award className="h-4 w-4 text-primary" />
            Reputation Score
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Basato sulle recensioni ricevute dai ristoratori.
          </p>
        </div>
        <Link to="/profile">
          <Button variant="ghost" size="sm" className="gap-1">
            Vedi recensioni <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Caricamento…</p>
      ) : count === 0 || avg === null ? (
        <div className="mt-4 space-y-1">
          <div className="text-sm font-medium">Non hai ancora recensioni visibili</div>
          <p className="text-xs text-muted-foreground">
            Completa i turni e le valutazioni reciproche per costruire la tua reputazione.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-end gap-3">
          <div className="text-4xl font-bold tabular-nums">{avg.toFixed(1).replace(".", ",")}</div>
          <div className="mb-1 text-sm text-muted-foreground">su 5</div>
          <div className="mb-1 ml-auto text-right">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${n <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {count} {count === 1 ? "recensione" : "recensioni"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}