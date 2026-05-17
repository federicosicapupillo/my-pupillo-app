import { Award, Star } from "lucide-react";
import {
  summarizeReputation,
  levelChipClass,
  scoreColorClass,
  type WorkerReputationInput,
} from "@/lib/reputation";

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
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${levelChipClass(s.level)} ${className}`}
    >
      <Award className="h-3 w-3" />
      <span>{s.levelLabel}</span>
      {s.showScore && (
        <span className={`tabular-nums font-semibold ${scoreColorClass(s.score)}`}>
          {s.score}
        </span>
      )}
      {s.showScore && s.rating > 0 && (
        <span className="inline-flex items-center gap-0.5 text-amber-600">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="tabular-nums">{s.rating.toFixed(1)}</span>
        </span>
      )}
    </span>
  );
}