import type { AvailabilityRow, TimeSlot } from "./availability";
import { SLOT_LABELS } from "./availability";

const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export type WorkerAvailabilityLine = {
  /** Compressed day label, e.g. "Lun - Ven", "Sab, Dom", "Mer". */
  days: string;
  /** Hours blurb, e.g. "09:00 - 23:00" or "Cena" / "Valuto in base alla proposta". */
  hours: string;
  /** True when today's weekday is part of this line. */
  includesToday: boolean;
  /** Internal: ordered day indices (0=Mon..6=Sun) for highlighting. */
  dayIndices: number[];
};

export type WorkerAvailabilitySummary =
  | { kind: "none" }
  | {
      kind: "lines";
      lines: WorkerAvailabilityLine[];
      truncated: boolean;
      extraCount: number;
      todayInList: boolean;
    };

function todayDow(now = new Date()): number {
  // JS: 0=Sun..6=Sat → our: 0=Mon..6=Sun
  return (now.getDay() + 6) % 7;
}

function compressDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Tutta la settimana";
  const contig = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (contig && sorted.length >= 3) {
    return `${DAY_SHORT[sorted[0]]} - ${DAY_SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

function hoursKey(r: AvailabilityRow): string {
  if (r.start_time && r.end_time) {
    return `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`;
  }
  // Fall back to a stable slot-based key when explicit hours are missing.
  return `slot:${r.time_slot}`;
}

function hoursLabel(key: string, slot: TimeSlot): string {
  if (key.startsWith("slot:")) {
    return SLOT_LABELS[slot] ?? slot;
  }
  // "HH:mm-HH:mm" → "HH:mm - HH:mm"
  const [a, b] = key.split("-");
  return `${a} - ${b}`;
}

/**
 * Compact summary for the restaurant-side worker card.
 *
 * Rows are grouped by hour range ("HH:mm-HH:mm") so that days sharing the
 * same time window collapse into one line like "Lun - Ven · 09:00 - 23:00".
 * If explicit hours are missing the slot label is used instead (e.g.
 * "Sab - Dom · Cena").
 */
export function summarizeWorkerAvailability(
  rows: AvailabilityRow[] | null | undefined,
  now: Date = new Date(),
): WorkerAvailabilitySummary {
  if (!rows || rows.length === 0) return { kind: "none" };

  const today = todayDow(now);

  // Bucket by (hour-range or slot-fallback); track contributing slot for label.
  const buckets = new Map<string, { slot: TimeSlot; days: Set<number> }>();
  for (const r of rows) {
    const key = hoursKey(r);
    const b = buckets.get(key) ?? { slot: r.time_slot, days: new Set<number>() };
    b.days.add(r.day_of_week);
    buckets.set(key, b);
  }

  const all: WorkerAvailabilityLine[] = [];
  for (const [key, b] of buckets) {
    const dayIndices = [...b.days].sort((a, c) => a - c);
    all.push({
      days: compressDays(dayIndices),
      hours: hoursLabel(key, b.slot),
      includesToday: b.days.has(today),
      dayIndices,
    });
  }

  // Sort: lines that include today first, then by earliest day, then by hours.
  all.sort((x, y) => {
    if (x.includesToday !== y.includesToday) return x.includesToday ? -1 : 1;
    const dx = x.dayIndices[0] ?? 99;
    const dy = y.dayIndices[0] ?? 99;
    if (dx !== dy) return dx - dy;
    return x.hours.localeCompare(y.hours);
  });

  const MAX = 3;
  const visible = all.slice(0, MAX);
  return {
    kind: "lines",
    lines: visible,
    truncated: all.length > MAX,
    extraCount: Math.max(0, all.length - MAX),
    todayInList: all.some((l) => l.includesToday),
  };
}

/** Per-day breakdown for the "Vedi dettagli" dialog. */
export function formatWorkerAvailabilityByDay(
  rows: AvailabilityRow[] | null | undefined,
): Array<{ day: string; slots: Array<{ label: string; hours: string }> }> {
  if (!rows || rows.length === 0) return [];
  const byDay = new Map<number, AvailabilityRow[]>();
  for (const r of rows) {
    const arr = byDay.get(r.day_of_week) ?? [];
    arr.push(r);
    byDay.set(r.day_of_week, arr);
  }
  const out: Array<{ day: string; slots: Array<{ label: string; hours: string }> }> = [];
  for (let d = 0; d < 7; d++) {
    const arr = byDay.get(d);
    if (!arr) continue;
    out.push({
      day: DAY_SHORT[d],
      slots: arr.map((r) => ({
        label: SLOT_LABELS[r.time_slot],
        hours:
          r.start_time && r.end_time
            ? `${r.start_time.slice(0, 5)} - ${r.end_time.slice(0, 5)}`
            : "",
      })),
    });
  }
  return out;
}

/** Lowercase searchable text for the free-text "availability" filter. */
export function availabilitySearchText(
  rows: AvailabilityRow[] | null | undefined,
): string {
  if (!rows || rows.length === 0) return "";
  const parts: string[] = [];
  for (const r of rows) {
    parts.push(SLOT_LABELS[r.time_slot] ?? r.time_slot);
    parts.push(DAY_SHORT[r.day_of_week] ?? "");
    if (r.is_last_minute) parts.push("last minute urgente");
    if (r.is_flexible) parts.push("flessibile");
  }
  return parts.join(" ").toLowerCase();
}