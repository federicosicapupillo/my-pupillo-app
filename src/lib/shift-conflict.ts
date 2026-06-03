import { supabase } from "@/integrations/supabase/client";
import { getShiftStartDate, getShiftEndDate, type AnnTimeInput } from "@/lib/announcement-time";

/**
 * REGOLA OCCUPAZIONE LAVORATORE (PUPILLO):
 * Quando un lavoratore ha un turno accettato, risulta OCCUPATO dall'inizio
 * del turno fino a `fine + BUFFER_HOURS`. Un nuovo turno è in conflitto se
 * le finestre [start, end+buffer) si sovrappongono.
 *
 * Centralizzato qui per riuso lato candidatura lavoratore, accettazione
 * proposta, invio proposta ristoratore, e assegnazione turno.
 */

export const BUFFER_HOURS = 1;
const BUFFER_MS = BUFFER_HOURS * 3_600_000;

export const CONFLICT_WORKER_APPLY_MESSAGE =
  "Non puoi candidarti a questo turno perché si sovrappone a un turno che hai già accettato.";
export const CONFLICT_WORKER_ACCEPT_MESSAGE =
  "Non puoi accettare questo turno perché hai già un altro turno confermato in questa fascia oraria.";
export const CONFLICT_RESTAURANT_REQUEST_MESSAGE =
  "Questo lavoratore risulta già occupato nella fascia oraria selezionata.";
export const CONFLICT_RESTAURANT_ASSIGN_MESSAGE =
  "Non puoi confermare questo lavoratore: ha già un altro turno confermato in questa fascia oraria.";

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
    .eq("status", "accepted");
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