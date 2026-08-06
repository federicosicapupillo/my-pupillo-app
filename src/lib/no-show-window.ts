/**
 * Finestra temporale in cui il ristoratore può segnalare il No-show.
 *
 * Regola di prodotto: il pulsante è disponibile da inizio turno + 15 minuti
 * e FINO a inizio + 30 minuti (inclusi). Oltre quel termine il ristoratore
 * non può più segnalare il no-show né annullare unilateralmente il turno:
 * il turno prosegue secondo il normale flusso di completamento.
 *
 * L'orario di inizio è wall time nel fuso operativo (Europe/Rome) e viene
 * convertito in istante assoluto (UTC) da `getShiftStartDate`, così il
 * calcolo non dipende dal fuso del dispositivo. Il controllo definitivo
 * resta comunque server-side (trigger `enforce_restaurant_no_show_window`).
 */
import { getShiftStartDate } from "./announcement-time";

export const NO_SHOW_WINDOW_MINUTES = 30;
/** Minuti di attesa obbligatoria dopo l'inizio del turno. */
export const NO_SHOW_DELAY_MINUTES = 15;

export const NO_SHOW_EXPIRED_MESSAGE =
  "Il termine per segnalare il no-show è scaduto. Dopo 30 minuti dall'inizio non è più possibile annullare il turno.";

export const NO_SHOW_TOO_EARLY_MESSAGE =
  "Potrai segnalare il No-show 15 minuti dopo l'inizio previsto del turno.";

export type NoShowPhase =
  | "not_applicable"
  | "unknown_start"
  | "before_start"
  | "waiting"
  | "in_window"
  | "expired";

export type NoShowWindow = {
  phase: NoShowPhase;
  start: Date | null;
  /** Istante a partire dal quale il no-show è segnalabile (inizio + 15 min). */
  availableFrom: Date | null;
  deadline: Date | null;
  /** Il ristoratore può segnalare il no-show adesso. */
  canMarkNoShow: boolean;
  /** Il ristoratore può ancora annullare unilateralmente il turno. */
  canRestaurantCancel: boolean;
  /** Messaggio da mostrare quando il no-show non è disponibile. */
  message: string | null;
};

export function computeShiftStart(
  shiftDate: string | null | undefined,
  serviceTime: string | null | undefined,
): Date | null {
  if (!shiftDate) return null;
  return getShiftStartDate({ service_date: shiftDate, service_time: serviceTime ?? "00:00" });
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

export function getNoShowWindow(input: {
  status: string | null | undefined;
  shiftDate: string | null | undefined;
  serviceTime: string | null | undefined;
  now?: Date;
}): NoShowWindow {
  const now = input.now ?? new Date();

  if (input.status !== "scheduled") {
    return {
      phase: "not_applicable",
      start: null,
      availableFrom: null,
      deadline: null,
      canMarkNoShow: false,
      canRestaurantCancel: false,
      message: "Il No show può essere segnalato solo su turni confermati.",
    };
  }

  const start = computeShiftStart(input.shiftDate, input.serviceTime);
  if (!start) {
    return {
      phase: "unknown_start",
      start: null,
      availableFrom: null,
      deadline: null,
      canMarkNoShow: false,
      canRestaurantCancel: true,
      message: "Orario di inizio turno non disponibile.",
    };
  }

  const deadline = new Date(start.getTime() + NO_SHOW_WINDOW_MINUTES * 60_000);
  const availableFrom = new Date(start.getTime() + NO_SHOW_DELAY_MINUTES * 60_000);

  if (now.getTime() < start.getTime()) {
    return {
      phase: "before_start",
      start,
      availableFrom,
      deadline,
      canMarkNoShow: false,
      canRestaurantCancel: true,
      message: `${NO_SHOW_TOO_EARLY_MESSAGE} Dalle ${hhmm(availableFrom)} alle ${hhmm(deadline)}.`,
    };
  }

  if (now.getTime() < availableFrom.getTime()) {
    const minutesLeft = Math.max(1, Math.ceil((availableFrom.getTime() - now.getTime()) / 60_000));
    return {
      phase: "waiting",
      start,
      availableFrom,
      deadline,
      canMarkNoShow: false,
      canRestaurantCancel: true,
      message: `Potrai segnalare il No-show tra ${minutesLeft} ${minutesLeft === 1 ? "minuto" : "minuti"}.`,
    };
  }

  if (now.getTime() <= deadline.getTime()) {
    return {
      phase: "in_window",
      start,
      availableFrom,
      deadline,
      canMarkNoShow: true,
      canRestaurantCancel: true,
      message: null,
    };
  }

  return {
    phase: "expired",
    start,
    availableFrom,
    deadline,
    canMarkNoShow: false,
    canRestaurantCancel: false,
    message: NO_SHOW_EXPIRED_MESSAGE,
  };
}

/** True quando l'errore server corrisponde alla scadenza della finestra no-show. */
export function isNoShowWindowServerError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /no-?show/i.test(message) && /scadut/i.test(message);
}

/** True quando l'errore server indica una segnalazione anticipata. */
export function isNoShowTooEarlyServerError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /no-?show/i.test(message) && /15 minuti/i.test(message);
}
