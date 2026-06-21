// Centralised rules for the worker "Affidabilità" stat.
//
// The DB column `reliability_pct` defaults to 100 for brand-new profiles
// (no completed shifts yet), which is misleading for restaurants. This
// helper hides that raw value until there are enough real services to
// compute a credible score.
//
// Thresholds:
//   - 0 completed shifts  → "Nuovo profilo" (no percentage)
//   - 1–2 completed shifts → "In valutazione" (no percentage)
//   - >= 3 completed shifts → real percentage

export const RELIABILITY_MIN_SHIFTS = 3;

export type ReliabilityStatus =
  | { kind: "new"; label: string; sub: string; pct: null; completed: 0 }
  | { kind: "evaluating"; label: string; sub: string; pct: null; completed: number }
  | { kind: "scored"; label: string; sub: string; pct: number; completed: number };

export function getReliabilityStatus(
  reliabilityPct: number | null | undefined,
  completedShifts: number | null | undefined,
): ReliabilityStatus {
  const completed = Math.max(0, Number(completedShifts ?? 0) || 0);
  if (completed <= 0) {
    return {
      kind: "new",
      label: "Nuovo profilo",
      sub: "Nessun servizio completato su Pupillo",
      pct: null,
      completed: 0,
    };
  }
  if (completed < RELIABILITY_MIN_SHIFTS) {
    return {
      kind: "evaluating",
      label: "In valutazione",
      sub: `${completed} ${completed === 1 ? "servizio completato" : "servizi completati"}`,
      pct: null,
      completed,
    };
  }
  const raw = Number(reliabilityPct ?? 0);
  const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
  return {
    kind: "scored",
    label: `${pct}%`,
    sub: `Basata su ${completed} servizi completati`,
    pct,
    completed,
  };
}

// Short value to render inside compact stat boxes (1–2 lines max).
export function reliabilityDisplayValue(
  reliabilityPct: number | null | undefined,
  completedShifts: number | null | undefined,
): string {
  return getReliabilityStatus(reliabilityPct, completedShifts).label;
}

// Returns the percentage ONLY when it's credible (>= RELIABILITY_MIN_SHIFTS
// completed shifts). Use for sorting/filtering so brand-new profiles don't
// rank as if they had perfect reliability.
export function effectiveReliabilityPct(
  reliabilityPct: number | null | undefined,
  completedShifts: number | null | undefined,
): number | null {
  const status = getReliabilityStatus(reliabilityPct, completedShifts);
  return status.kind === "scored" ? status.pct : null;
}