import { supabase } from "@/integrations/supabase/client";
import { getShiftStartDate, getShiftEndDate, type AnnTimeInput } from "@/lib/announcement-time";

/**
 * REGOLA BUFFER TRA TURNI (PUPILLO):
 * Un lavoratore con una candidatura ATTIVA (inviata, in valutazione,
 * controproposta, accettata) o un turno programmato può candidarsi a un altro
 * turno solo se tra i due c'è almeno UN'ORA piena:
 *
 *   nuovo.start >= esistente.end + 1h  OPPURE  esistente.start >= nuovo.end + 1h
 *
 * 60 minuti esatti sono consentiti, 59'59" no. La regola è simmetrica e
 * applicata come autorità finale dal database
 * (`assert_no_worker_shift_conflict` / `worker_shift_buffer_conflict`).
 * Questo modulo è solo anticipazione UX.
 */

export const BUFFER_HOURS = 1;
export const MINIMUM_BUFFER_MINUTES = BUFFER_HOURS * 60;
const BUFFER_MS = BUFFER_HOURS * 3_600_000;

/** Stati candidatura ancora operativi: bloccano nuove candidature vicine. */
export const ACTIVE_APPLICATION_STATUSES = [
  "pending",
  "interested",
  "counter_offer",
  "accepted",
] as const;

/** Stati chiusi: non generano mai conflitto. */
export const CLOSED_APPLICATION_STATUSES = [
  "not_interested",
  "rejected",
  "expired",
  "cancelled",
] as const;

export function isActiveApplicationStatus(status: string | null | undefined): boolean {
  return (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export const BUFFER_CONFLICT_CODE = "SHIFT_APPLICATION_BUFFER_CONFLICT";

export const CONFLICT_WORKER_APPLY_MESSAGE =
  "Non puoi candidarti a questo turno perché hai già una candidatura per un turno troppo vicino. Tra due turni deve esserci almeno un'ora.";
export const CONFLICT_WORKER_ACCEPT_MESSAGE =
  "Non puoi accettare questo turno: hai già una candidatura per un turno troppo vicino. Tra due turni deve esserci almeno un'ora.";
export const CONFLICT_WORKER_HINT_MESSAGE =
  "Hai già una candidatura per un turno troppo vicino. È richiesta almeno un'ora tra la fine di un turno e l'inizio del successivo.";
export const CONFLICT_RESTAURANT_REQUEST_MESSAGE =
  "Questo lavoratore risulta già occupato: serve almeno un'ora tra due turni.";
export const CONFLICT_RESTAURANT_ASSIGN_MESSAGE =
  "Non puoi confermare questo lavoratore: ha un altro turno a meno di un'ora di distanza.";
export const CONFLICT_MISSING_END_MESSAGE =
  "Questo annuncio non ha un orario di fine valido: impossibile verificare la compatibilità con i tuoi turni.";

/**
 * Traduce gli errori applicativi sollevati dai trigger del database
 * (`SHIFT_APPLICATION_BUFFER_CONFLICT`, legacy `WORKER_SHIFT_CONFLICT`,
 * `SHIFT_END_TIME_MISSING`) nel messaggio utente corretto per il contesto.
 * Restituisce `null` quando l'errore non riguarda la compatibilità turni.
 */
export function mapShiftConflictError(
  error: unknown,
  context: "worker_apply" | "worker_accept" | "restaurant_request" | "restaurant_assign",
): string | null {
  const raw = `${(error as any)?.message ?? ""} ${(error as any)?.details ?? ""} ${error ?? ""}`;
  const msg = raw.toUpperCase();
  if (msg.includes("SHIFT_END_TIME_MISSING")) return CONFLICT_MISSING_END_MESSAGE;
  if (!msg.includes(BUFFER_CONFLICT_CODE) && !msg.includes("WORKER_SHIFT_CONFLICT")) return null;
  switch (context) {
    case "worker_apply": return CONFLICT_WORKER_APPLY_MESSAGE;
    case "worker_accept": return CONFLICT_WORKER_ACCEPT_MESSAGE;
    case "restaurant_request": return CONFLICT_RESTAURANT_REQUEST_MESSAGE;
    default: return CONFLICT_RESTAURANT_ASSIGN_MESSAGE;
  }
}

export type BusyWindow = {
  applicationId: string;
  announcementId: string;
  start: Date;
  end: Date; // already includes buffer
};

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/**
 * Fetch every "busy" window for the worker: applications with status `accepted`
 * whose announcement end+buffer is still in the future.
 */
export async function fetchWorkerBusyWindows(
  workerId: string,
  now: Date = new Date(),
): Promise<BusyWindow[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, announcement_id, status, announcements:announcement_id (id, service_date, service_time, end_date, end_time, shift_duration_hours, duration_hours, status)",
    )
    .eq("worker_id", workerId)
    .in("status", [...ACTIVE_APPLICATION_STATUSES]);
  if (error) {
    console.warn("[PUPILLO_SHIFT_CONFLICT] fetch busy windows failed", error);
    return [];
  }
  const out: BusyWindow[] = [];
  for (const row of (data as any[] | null) ?? []) {
    const ann = row.announcements as AnnTimeInput | null;
    if (!ann || !ann.service_date) continue;
    // Ignore announcements explicitly cancelled.
    if ((ann as any).status === "cancelled") continue;
    const start = getShiftStartDate(ann);
    const end = getShiftEndDate(ann);
    if (!start || !end) continue;
    const endWithBuffer = new Date(end.getTime() + BUFFER_MS);
    if (endWithBuffer.getTime() <= now.getTime()) continue; // turno già finito + buffer trascorso
    out.push({
      applicationId: row.id,
      announcementId: row.announcement_id,
      start,
      end: endWithBuffer,
    });
  }
  return out;
}

/**
 * Pure overlap check between an announcement's time window (with buffer applied
 * to its end) and a list of busy windows already owned by the worker.
 */
export function conflictsWithBusyWindows(
  ann: AnnTimeInput | null | undefined,
  busy: BusyWindow[],
): BusyWindow | null {
  if (!ann) return null;
  const start = getShiftStartDate(ann);
  const end = getShiftEndDate(ann);
  if (!start || !end) return null;
  const endWithBuffer = new Date(end.getTime() + BUFFER_MS);
  for (const b of busy) {
    if (rangesOverlap(start, endWithBuffer, b.start, b.end)) return b;
  }
  return null;
}

/**
 * Backend-safety check: refetch the worker's accepted shifts and verify the
 * given announcement doesn't conflict. Use this RIGHT BEFORE inserting an
 * application / accepting a proposal / sending a request / confirming a shift.
 */
export async function checkWorkerShiftConflict(
  workerId: string,
  ann: AnnTimeInput | null | undefined,
  options: { ignoreApplicationId?: string } = {},
): Promise<BusyWindow | null> {
  if (!ann) return null;
  const busy = await fetchWorkerBusyWindows(workerId);
  const filtered = options.ignoreApplicationId
    ? busy.filter((b) => b.applicationId !== options.ignoreApplicationId)
    : busy;
  const conflict = conflictsWithBusyWindows(ann, filtered);
  if (conflict) {
    console.warn("[PUPILLO_SHIFT_CONFLICT] worker busy", {
      workerId,
      conflictingApplicationId: conflict.applicationId,
      conflictStart: conflict.start.toISOString(),
      conflictEnd: conflict.end.toISOString(),
    });
  }
  return conflict;
}