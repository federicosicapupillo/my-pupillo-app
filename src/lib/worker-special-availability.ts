import { supabase } from "@/integrations/supabase/client";
import {
  computeCompatibility,
  type AvailabilityExceptionRow,
} from "@/lib/availability";

export type SpecialAvailabilityBlock = {
  blocked: boolean;
  specials: AvailabilityExceptionRow[];
};

export type AnnouncementLike = {
  service_date: string | null | undefined;
  service_time?: string | null;
  end_time?: string | null;
  job_city?: string | null;
};

/**
 * Pure check: if the worker declared a "disponibilità speciale" for the
 * announcement date, that ALWAYS overrides the weekly schedule. We return
 * `blocked: true` when none of those special entries is compatible with the
 * announcement city / time (or when the date is marked "Non disponibile").
 *
 * If the worker has no special entries for that date we return `null` —
 * the caller can fall back to the regular weekly compatibility logic.
 */
export function computeSpecialAvailabilityBlock(
  exceptionsForWorker: AvailabilityExceptionRow[] | null | undefined,
  ann: AnnouncementLike | null | undefined,
): SpecialAvailabilityBlock | null {
  if (!ann?.service_date) return null;
  const dayExc = (exceptionsForWorker ?? []).filter((e) => e.date === ann.service_date);
  if (dayExc.length === 0) return null;
  const start = ann.service_time ? ann.service_time.slice(0, 5) : null;
  const end = ann.end_time ? ann.end_time.slice(0, 5) : null;
  const level = computeCompatibility(
    [],
    dayExc,
    ann.service_date,
    start,
    end,
    ann.job_city ?? null,
  );
  return { blocked: level === "non_disponibile", specials: dayExc };
}

/** Human-readable summary of a single special-availability entry. */
export function describeSpecialAvailability(e: AvailabilityExceptionRow): string {
  const where = [e.city, e.district].filter(Boolean).join(" · ");
  const when = e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : "";
  if (!e.is_available) return [where, "Non disponibile"].filter(Boolean).join(" · ");
  return [where, when].filter(Boolean).join(" · ");
}

/** Backend-safety re-check: refetch exceptions for the worker on that date
 *  and recompute the block. Use this right before insert/accept. */
export async function fetchSpecialAvailabilityBlock(
  workerId: string,
  ann: AnnouncementLike | null | undefined,
): Promise<SpecialAvailabilityBlock | null> {
  if (!ann?.service_date) return null;
  const { data, error } = await supabase
    .from("worker_availability_exceptions")
    .select("id, worker_id, date, is_available, time_slot, start_time, end_time, notes, city, province, district, latitude, longitude, radius_km")
    .eq("worker_id", workerId)
    .eq("date", ann.service_date);
  if (error) {
    console.warn("[special-availability] fetch failed", error);
    return null;
  }
  return computeSpecialAvailabilityBlock(
    (data as AvailabilityExceptionRow[] | null) ?? [],
    ann,
  );
}

export const SPECIAL_INCOMPATIBLE_MESSAGE =
  "Non puoi candidarti a questo turno perché non è compatibile con la tua disponibilità speciale.";
export const SPECIAL_ACCEPT_INCOMPATIBLE_MESSAGE =
  "Non puoi accettare questa proposta perché non è compatibile con la disponibilità speciale che hai impostato.";