import { Award, Star } from "lucide-react";
import {
  summarizeReputation,
  levelChipClass,
  scoreColorClass,
  type WorkerReputationInput,
} from "@/lib/reputation";
import type { ReputationSummary } from "@/lib/reputation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Tooltip body for the reputation badge. Exported so it can be tested in
 * isolation without rendering the Radix Portal (which is hidden by default).
 */
export function ReputationBadgeTooltipContent({ s }: { s: ReputationSummary }) {
  const hasEnoughReviews = s.reviewsCount >= 3;
  return (
    <div className="space-y-1.5 text-[11px] leading-snug">
      <div className="font-semibold text-xs">Reputation Score</div>
      {s.showScore ? (
        <p>
          Punteggio da 0 a 100 calcolato su servizi completati, puntualità,
          recensioni e ricontatti dei ristoratori.
        </p>
      ) : (
        <p>
          Profilo nuovo: il punteggio viene mostrato dopo almeno{" "}
          <strong>3 servizi completati</strong>. Per ora la reputazione è in costruzione.
        </p>
      )}
      <div className="pt-1 border-t border-border/60 grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground">Servizi completati</span>
        <span className="tabular-nums text-right">{s.completedShifts}</span>
        <span className="text-muted-foreground">Recensioni</span>
        <span className="tabular-nums text-right">{s.reviewsCount}</span>
        {s.rating > 0 && hasEnoughReviews ? (
          <>
            <span className="text-muted-foreground">Valutazione media</span>
            <span className="tabular-nums text-right">{s.rating.toFixed(1)}/5</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Valutazione media</span>
            <span className="text-right text-muted-foreground">
              {s.reviewsCount === 0 ? "non disponibile" : "in costruzione"}
            </span>
          </>
        )}
      </div>
      <div className="pt-1 text-[10px] text-muted-foreground">
        Livelli: Nuovo → Nuovo verificato → Basic → Pro → Elite
      </div>
    </div>
  );
}

/**
 * Compact reputation chip for worker cards in lists / map popups.
 * Hides the numeric score for workers with fewer than 3 completed shifts
 * so a "new" profile doesn't look bad just because of missing data.
 */
export function WorkerReputationBadge({
  profile,
  className = "",
}: {
  profile: WorkerReputationInput;
  className?: string;
}) {
  const s = summarizeReputation(profile);
  const hasEnoughReviews = s.reviewsCount >= 3;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-help ${levelChipClass(s.level)} ${className}`}
          >
            <Award className="h-3 w-3" />
            <span>{s.levelLabel}</span>
            {s.showScore && (
              <span className={`tabular-nums font-semibold ${scoreColorClass(s.score)}`}>
                {s.score}/100
              </span>
            )}
            {s.showScore && s.rating > 0 && hasEnoughReviews && (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="tabular-nums">{s.rating.toFixed(1)}</span>
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] bg-popover text-popover-foreground border shadow-md p-3">
          <ReputationBadgeTooltipContent s={s} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}