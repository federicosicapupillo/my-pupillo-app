// Regole pure per il promemoria del turno del giorno dopo.
export const SHIFT_REMINDER_TITLE = "Promemoria: domani hai un turno";

/** Data di domani (YYYY-MM-DD) secondo l'ora italiana. */
export function tomorrowInRome(now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function shiftReminderBody(shiftDate: string, title?: string | null): string {
  const d = new Date(shiftDate + "T12:00:00Z");
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return `Domani, ${day}, hai un turno${title ? ` · ${title}` : ""}. Ricontrolla orario, indirizzo e istruzioni del ristoratore.`;
}
