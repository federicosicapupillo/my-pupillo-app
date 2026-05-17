import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequiredReviews } from "@/lib/required-reviews";

function formatDeadline(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ore ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Shown to restaurants. Non-blocking when only pending; visually stronger when overdue.
 * The actual contact-block enforcement happens in `canRestaurantContact()`.
 */
export function RequiredReviewsBanner() {
  const { actionShifts, overdueShifts, warningShifts, isBlocked, nearestDeadline } = useRequiredReviews();
  if (actionShifts.length === 0) return null;

  const overdue = isBlocked;
  const overdueCount = overdueShifts.length;
  const warningCount = warningShifts.length;

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
              ? `${overdueCount} recensione${overdueCount > 1 ? "i" : ""} obbligatoria${overdueCount > 1 ? "e" : ""} scaduta${overdueCount > 1 ? "e" : ""}`
              : `Hai ${warningCount} turn${warningCount > 1 ? "i" : "o"} concluso${warningCount > 1 ? "i" : ""} da recensire`}
          </div>
          <div className="text-muted-foreground">
            {overdue
              ? "Per continuare a usare l'app devi chiudere i turni completati e lasciare la recensione ai lavoratori."
              : `Scadenza recensione: ${formatDeadline(nearestDeadline)}.`}
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