import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequiredReviews } from "@/lib/required-reviews";

/**
 * Shown to restaurants. Non-blocking when only pending; visually stronger when overdue.
 * The actual contact-block enforcement happens in `canRestaurantContact()`.
 */
export function RequiredReviewsBanner() {
  const { items, overdueCount, pendingCount } = useRequiredReviews();
  if (items.length === 0) return null;

  const overdue = overdueCount > 0;

  return (
    <div
      className={`mb-4 rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
        overdue
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {overdue ? (
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="text-sm">
          <div className="font-semibold">
            {overdue
              ? `${overdueCount} recensione${overdueCount > 1 ? "i" : ""} scaduta${overdueCount > 1 ? "e" : ""}`
              : "Recensione da completare"}
          </div>
          <div className="text-muted-foreground">
            {overdue
              ? "Per contattare nuovi lavoratori devi prima completare le recensioni dei turni conclusi."
              : `Hai ${pendingCount} turn${pendingCount > 1 ? "i" : "o"} da recensire entro 3 giorni dalla fine del servizio.`}
          </div>
        </div>
      </div>
      <Link to="/shifts" search={{ tab: "to-review" } as never}>
        <Button size="sm" variant={overdue ? "destructive" : "default"} className="gap-2 whitespace-nowrap">
          <Star className="h-4 w-4" />
          {overdue ? "Lascia recensione ora" : "Vai ai turni da recensire"}
        </Button>
      </Link>
    </div>
  );
}