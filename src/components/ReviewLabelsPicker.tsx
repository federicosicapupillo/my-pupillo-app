import {
  POSITIVE_REVIEW_LABELS,
  NEGATIVE_REVIEW_LABELS,
  MAX_REVIEW_LABELS,
  isPositiveLabel,
} from "@/lib/review-labels";

type Props = {
  positive: string[];
  negative: string[];
  onChange: (next: { positive: string[]; negative: string[] }) => void;
  disabled?: boolean;
};

/**
 * Chip-based picker for the behavioural labels attached to a review.
 * Mirrors the spec: "Comportamenti osservati" section, max 5 selections total,
 * positives green-soft, negatives amber/red-soft.
 */
export function ReviewLabelsPicker({ positive, negative, onChange, disabled }: Props) {
  const total = positive.length + negative.length;

  const toggle = (label: string) => {
    if (disabled) return;
    const isPos = isPositiveLabel(label);
    const list = isPos ? positive : negative;
    const has = list.includes(label);
    if (!has && total >= MAX_REVIEW_LABELS) return;
    const nextList = has ? list.filter((l) => l !== label) : [...list, label];
    onChange({
      positive: isPos ? nextList : positive,
      negative: isPos ? negative : nextList,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium">Comportamenti osservati</div>
        <p className="text-xs text-muted-foreground">
          Seleziona le caratteristiche che descrivono il servizio svolto. Massimo {MAX_REVIEW_LABELS} etichette.
        </p>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Selezionate: <span className="font-medium text-foreground">{total}</span>/{MAX_REVIEW_LABELS}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Punti di forza
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIVE_REVIEW_LABELS.map((label) => {
            const active = positive.includes(label);
            const atCap = !active && total >= MAX_REVIEW_LABELS;
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                disabled={disabled || atCap}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-secondary hover:bg-secondary/70"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Aree di attenzione
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NEGATIVE_REVIEW_LABELS.map((label) => {
            const active = negative.includes(label);
            const atCap = !active && total >= MAX_REVIEW_LABELS;
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggle(label)}
                disabled={disabled || atCap}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "border-border bg-secondary hover:bg-secondary/70"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only display of selected labels for a review card.
 * Returns null when no labels are present so callers don't render empty sections.
 */
export function ReviewLabelsDisplay({
  positive,
  negative,
  className = "",
}: {
  positive?: string[] | null;
  negative?: string[] | null;
  className?: string;
}) {
  const pos = positive ?? [];
  const neg = negative ?? [];
  if (pos.length === 0 && neg.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {pos.map((t) => (
        <span
          key={`p-${t}`}
          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300"
        >
          {t}
        </span>
      ))}
      {neg.map((t) => (
        <span
          key={`n-${t}`}
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"
        >
          {t}
        </span>
      ))}
    </div>
  );
}