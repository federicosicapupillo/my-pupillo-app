import type { AvailabilityRow, TimeSlot } from "./availability";
import { SLOT_LABELS } from "./availability";

const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export type WorkerAvailabilitySummary =
  | { kind: "none" }
  | { kind: "today"; slotLabels: string[] }
  | { kind: "all_week"; slotLabel: string }
  | { kind: "lines"; lines: string[]; totalDays: number; truncated: boolean }
  | { kind: "wide"; totalDays: number };

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

/**
 * Summarise real availability rows (table `worker_availability`) into the
 * short blurb shown on the worker card. Returns `{ kind: "none" }` only when
 * the worker has saved nothing at all.
 */
export function summarizeWorkerAvailability(
  rows: AvailabilityRow[] | null | undefined,
  now: Date = new Date(),
): WorkerAvailabilitySummary {
  if (!rows || rows.length === 0) return { kind: "none" };

  const today = todayDow(now);
  const todaySlots = rows
    .filter((r) => r.day_of_week === today)
    .map((r) => SLOT_LABELS[r.time_slot]);
  if (todaySlots.length > 0) {
    return { kind: "today", slotLabels: [...new Set(todaySlots)] };
  }

  const bySlot = new Map<TimeSlot, Set<number>>();
  for (const r of rows) {
    const s = bySlot.get(r.time_slot) ?? new Set<number>();
    s.add(r.day_of_week);
    bySlot.set(r.time_slot, s);
  }
  const uniqueDays = new Set(rows.map((r) => r.day_of_week));

  for (const [slot, days] of bySlot) {
    if (days.size === 7) return { kind: "all_week", slotLabel: SLOT_LABELS[slot] };
  }
  if (bySlot.size > 3 || uniqueDays.size >= 6) {
    return { kind: "wide", totalDays: uniqueDays.size };
  }

  const lines: string[] = [];
  let count = 0;
  for (const [slot, days] of bySlot) {
    lines.push(`${compressDays([...days])} · ${SLOT_LABELS[slot]}`);
    count++;
    if (count >= 3) break;
  }
  return {
    kind: "lines",
    lines,
    totalDays: uniqueDays.size,
    truncated: bySlot.size > lines.length,
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