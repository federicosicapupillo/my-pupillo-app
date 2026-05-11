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