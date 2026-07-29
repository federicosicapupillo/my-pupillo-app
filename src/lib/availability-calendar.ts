/**
 * Pure helpers for the monthly calendar view of the worker availability page.
 *
 * IMPORTANT: the underlying data model is the RECURRING weekly schedule
 * (`worker_availability.day_of_week`, 0 = Monday … 6 = Sunday). The calendar is
 * only a *view* over that model: touching a date edits the pattern of that
 * date's weekday. No per-date rows are created here.
 */

export type MonthCell = {
  /** yyyy-MM-dd */
  iso: string;
  /** Day of month (1..31). */
  day: number;
  /** 0 = Monday … 6 = Sunday. */
  dow: number;
  /** False for leading/trailing days belonging to the adjacent months. */
  inMonth: boolean;
  isPast: boolean;
  isToday: boolean;
};

export function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** 0 = Monday … 6 = Sunday. */
export function dowOfIso(iso: string): number {
  return (fromIso(iso).getDay() + 6) % 7;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function formatMonthLabel(d: Date): string {
  const s = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateLong(iso: string): string {
  const s = fromIso(iso).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Builds the classic 6x7 month grid, Monday first. */
export function buildMonthGrid(month: Date, now: Date = new Date()): MonthCell[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const first = startOfMonth(month);
  const lead = (first.getDay() + 6) % 7;
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), 1 - lead + i);
    cells.push({
      iso: toIso(d),
      day: d.getDate(),
      dow: (d.getDay() + 6) % 7,
      inMonth: d.getMonth() === first.getMonth(),
      isPast: d.getTime() < today.getTime(),
      isToday: d.getTime() === today.getTime(),
    });
  }
  // Drop a fully-trailing last row when the month fits in 5 weeks.
  const lastRow = cells.slice(35);
  return lastRow.every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Normalised [start, end) in minutes, extending past midnight when needed. */
function normalise(start: string, end: string): [number, number] {
  const a = toMinutes(start);
  let b = toMinutes(end);
  if (b <= a) b += 24 * 60;
  return [a, b];
}

/** True when two time ranges of the same day overlap (midnight-aware). */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const [a1, a2] = normalise(aStart, aEnd);
  const [b1, b2] = normalise(bStart, bEnd);
  // Compare on a 48h line so ranges crossing midnight are handled correctly.
  const overlaps = (x1: number, x2: number, y1: number, y2: number) =>
    Math.min(x2, y2) - Math.max(x1, y1) > 0;
  return (
    overlaps(a1, a2, b1, b2) ||
    overlaps(a1, a2, b1 + 24 * 60, b2 + 24 * 60) ||
    overlaps(a1 + 24 * 60, a2 + 24 * 60, b1, b2)
  );
}