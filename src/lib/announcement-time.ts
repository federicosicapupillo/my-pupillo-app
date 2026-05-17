/**
 * Time helpers per gli annunci.
 *
 * Le colonne `service_date` (date) e `service_time` / `end_time`
 * (time WITHOUT time zone) sul database rappresentano un orario "da parete"
 * inteso nel fuso orario operativo dell'app (Europa/Roma). `new Date("YYYY-MM-DDTHH:mm:ss")`
 * lo interpreterebbe nel fuso del browser: per un ristoratore in viaggio
 * (o per un test in CI/UTC) il timer di scadenza risulterebbe sfasato di 1‑2 ore.
 * Per evitarlo agganciamo sempre il calcolo a `Europe/Rome`.
 */
const APP_TZ = "Europe/Rome";

/** Returns the UTC instant for `dateStr`+`timeStr` interpreted as wall time in `tz`. */
function zonedWallTimeToDate(dateStr: string, timeStr: string, tz: string = APP_TZ): Date | null {
  if (!dateStr) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!dm) return null;
  const Y = Number(dm[1]), M = Number(dm[2]), D = Number(dm[3]);
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr || "00:00");
  if (!tm) return null;
  const h = Number(tm[1]), m = Number(tm[2]), s = Number(tm[3] ?? "0");
  // Build a UTC guess for the same wall-clock numbers.
  const utcGuess = Date.UTC(Y, M - 1, D, h, m, s);
  // Compute the offset of `tz` at that instant by formatting both sides.
  const tzWall = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: tz }));
  const localWall = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = tzWall.getTime() - localWall.getTime();
  const result = new Date(utcGuess - offsetMs);
  return isNaN(result.getTime()) ? null : result;
}

export type AnnTimeInput = {
  service_date?: string | null;
  service_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  duration_hours?: number | null;
  shift_duration_hours?: number | null;
  expires_at?: string | null;
};

/**
 * Inizio del turno nel fuso Europa/Roma.
 * Fallback: se manca `service_time` usa le 00:00 della `service_date`.
 */
export function getShiftStartDate(a: AnnTimeInput): Date | null {
  if (!a.service_date) return null;
  return zonedWallTimeToDate(a.service_date, a.service_time || "00:00");
}

/**
 * Fine del turno nel fuso Europa/Roma.
 * Fallback in cascata:
 *  1. `end_date` + `end_time`
 *  2. `service_date` + `end_time`
 *  3. start + `shift_duration_hours` / `duration_hours`
 *  4. fine giornata della `service_date` (23:59 Europa/Roma)
 */
export function getShiftEndDate(a: AnnTimeInput): Date | null {
  if (!a.service_date) return null;
  const endDate = a.end_date || a.service_date;
  if (a.end_time) {
    const d = zonedWallTimeToDate(endDate, a.end_time);
    if (d) return d;
  }
  const start = getShiftStartDate(a);
  const hours = a.shift_duration_hours ?? a.duration_hours ?? null;
  if (start && typeof hours === "number" && hours > 0) {
    return new Date(start.getTime() + hours * 3_600_000);
  }
  return zonedWallTimeToDate(a.service_date, "23:59");
}

/**
 * `expires_at` (timestamp UTC sul DB) come Date.
 * Fallback: l'inizio del turno se la colonna è vuota o non parsabile.
 */
export function getExpiresAtDate(a: AnnTimeInput): Date | null {
  if (a.expires_at) {
    const d = new Date(a.expires_at);
    if (!isNaN(d.getTime())) return d;
  }
  return getShiftStartDate(a);
}

/**
 * Vero quando il turno è oltre la fine effettiva, oppure (per stati non assegnati)
 * la deadline `expires_at` è passata. Usa il fuso Europa/Roma per i confronti.
 */
export function isPastEffectiveEnd(a: AnnTimeInput, now: Date = new Date()): boolean {
  const end = getShiftEndDate(a);
  if (end && end.getTime() < now.getTime()) return true;
  return false;
}
