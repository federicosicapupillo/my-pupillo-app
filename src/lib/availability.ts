export type TimeSlot =
  | "pranzo"
  | "aperitivo"
  | "cena"
  | "serale"
  | "intera_giornata"
  | "last_minute"
  | "flessibile";

export const SLOT_LABELS: Record<TimeSlot, string> = {
  pranzo: "Pranzo",
  aperitivo: "Aperitivo",
  cena: "Cena",
  serale: "Serale",
  intera_giornata: "Intera giornata",
  last_minute: "Last minute",
  flessibile: "Valuto in base alla proposta",
};

export const SLOT_DEFAULT_TIMES: Record<TimeSlot, { start: string | null; end: string | null }> = {
  pranzo: { start: "11:00", end: "15:00" },
  aperitivo: { start: "17:00", end: "21:00" },
  cena: { start: "18:00", end: "23:30" },
  serale: { start: "21:00", end: "02:00" },
  intera_giornata: { start: "09:00", end: "23:00" },
  last_minute: { start: null, end: null },
  flessibile: { start: null, end: null },
};

export const DAY_LABELS: string[] = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

// ISO day index: 1=Mon..7=Sun. We store 0..6 with 0=Mon for simplicity.
export function jsDayToDow(jsDay: number): number {
  // JS: 0=Sun..6=Sat → our: 0=Mon..6=Sun
  return (jsDay + 6) % 7;
}

export type AvailabilityRow = {
  id: string;
  worker_id: string;
  day_of_week: number;
  time_slot: TimeSlot;
  start_time: string | null;
  end_time: string | null;
  is_flexible: boolean;
  is_last_minute: boolean;
  notes: string | null;
};

export type AvailabilityExceptionRow = {
  id: string;
  worker_id: string;
  date: string;
  is_available: boolean;
  time_slot: TimeSlot | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

/**
 * Returns a compatibility level for a worker given target day-of-week (0..6) and optional time range.
 * Used by the restaurant search view.
 */
export type CompatibilityLevel = "disponibile" | "compatibile" | "parziale" | "non_disponibile";

export function computeCompatibility(
  rows: AvailabilityRow[],
  exceptions: AvailabilityExceptionRow[],
  targetDate: string, // YYYY-MM-DD
  targetStart?: string | null,
  targetEnd?: string | null,
): CompatibilityLevel {
  // Check exception override first
  const exc = exceptions.find((e) => e.date === targetDate);
  if (exc) {
    if (!exc.is_available) return "non_disponibile";
    if (!targetStart || !targetEnd) return "disponibile";
    if (exc.start_time && exc.end_time) {
      return overlapLevel(exc.start_time, exc.end_time, targetStart, targetEnd);
    }
    return "compatibile";
  }
  const d = new Date(targetDate + "T00:00:00");
  const dow = jsDayToDow(d.getDay());
  const slots = rows.filter((r) => r.day_of_week === dow);
  if (slots.length === 0) return "non_disponibile";
  if (slots.some((s) => s.is_last_minute)) return "disponibile";
  if (!targetStart || !targetEnd) return "compatibile";
  let best: CompatibilityLevel = "non_disponibile";
  for (const s of slots) {
    if (s.is_flexible) {
      best = bestOf(best, "compatibile");
      continue;
    }
    if (s.start_time && s.end_time) {
      best = bestOf(best, overlapLevel(s.start_time, s.end_time, targetStart, targetEnd));
    } else {
      // slot known but no times: treat as compatible
      best = bestOf(best, "compatibile");
    }
  }
  return best;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Compute overlap considering ranges that may cross midnight. */
export function overlapLevel(aStart: string, aEnd: string, bStart: string, bEnd: string): CompatibilityLevel {
  const a1 = toMinutes(aStart);
  let a2 = toMinutes(aEnd);
  if (a2 <= a1) a2 += 24 * 60;
  const b1 = toMinutes(bStart);
  let b2 = toMinutes(bEnd);
  if (b2 <= b1) b2 += 24 * 60;
  const overlap = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  const needed = b2 - b1;
  if (overlap <= 0) return "non_disponibile";
  if (overlap >= needed) return "disponibile";
  if (overlap >= needed * 0.5) return "compatibile";
  return "parziale";
}

function bestOf(a: CompatibilityLevel, b: CompatibilityLevel): CompatibilityLevel {
  const order: CompatibilityLevel[] = ["non_disponibile", "parziale", "compatibile", "disponibile"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export const COMPAT_LABEL: Record<CompatibilityLevel, string> = {
  disponibile: "Disponibile per questo turno",
  compatibile: "Disponibilità compatibile",
  parziale: "Disponibilità parziale",
  non_disponibile: "Non disponibile",
};