// Shared formatting helpers for tariffs and dates (Italian locale).

/** Format an announcement tariff for display: "12 EUR/h" or "12 EUR (a servizio)". */
export function formatTariff(
  amount: number | string | null | undefined,
  type?: string | null,
): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  if (type === "hourly" || type == null) return `${pretty} EUR/h`;
  return `${pretty} EUR (a servizio)`;
}

/** Format an ISO yyyy-mm-dd (or Date) as dd/MM/yyyy (it-IT). */
export function formatDateIT(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T00:00:00" : value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Convert a Date to ISO yyyy-mm-dd (local time). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse yyyy-mm-dd into a local Date (no TZ shift). */
export function fromISODate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Compute duration in hours from start/end time strings (HH:MM).
    Handles overnight shifts. Returns null if inputs invalid. */
export function computeDurationHours(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  const diff = endMin - startMin;
  if (diff <= 1) return null;
  return diff / 60;
}

/** Compute total service amount given tariff, type and duration.
    For flat-rate returns amount as-is; for hourly multiplies by duration.
    Falls back to start/end times if duration is missing.
    Returns null if unable to compute. */
export function computeServiceTotal(
  amount: number,
  type: string,
  durationHours?: number | null,
  start?: string | null,
  end?: string | null,
): number | null {
  if (type === "flat") return amount;
  if (type !== "hourly") return null;
  let dur = durationHours;
  if (dur == null && start && end) {
    dur = computeDurationHours(start, end);
  }
  if (dur == null || dur <= 1) return null;
  return Math.round(amount * dur * 100) / 100;
}

/** Format total service for display: e.g. "€60". */
export function formatTotalService(
  amount: number,
  type: string,
  durationHours?: number | null,
  start?: string | null,
  end?: string | null,
): string | null {
  const total = computeServiceTotal(amount, type, durationHours, start, end);
  if (total == null) return null;
  const pretty = Number.isInteger(total) ? String(total) : total.toFixed(2).replace(/\.?0+$/, "");
  return `€${pretty}`;
}