/**
 * AREA OPERATIVA — regola unica lato frontend per il LUOGO DI LAVORO.
 *
 * Rispecchia 1:1 le funzioni server-side
 * `public.location_is_in_operational_area(city, province, lat, lng)` e
 * `public.announcement_is_in_operational_area(announcement_id)`.
 *
 * NON riguarda la residenza del lavoratore (dato anagrafico, vedi
 * `@/lib/italian-comuni`): limita solo annunci, offerte, mappa e proposte.
 *
 * Nessun confronto su stringhe libere: si usano comune strutturato +
 * provincia dalla configurazione `@/lib/launch-area`, con le coordinate
 * come solo controllo aggiuntivo.
 */
import { LAUNCH_AREA_RESTRICTED, validateLaunchLocation } from "@/lib/launch-area";

export const OUTSIDE_OPERATIONAL_AREA_MESSAGE =
  "Questa offerta non è disponibile nell'attuale area operativa di Pupillo.";

/** Codice errore applicativo sollevato dal database. */
export const OUTSIDE_OPERATIONAL_AREA_CODE = "ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA";

export type OperationalAreaInput = {
  job_city?: string | null;
  job_province?: string | null;
  job_latitude?: number | null;
  job_longitude?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

/** True se il luogo del turno rientra nell'area operativa attiva. */
export function isInOperationalArea(ann: OperationalAreaInput | null | undefined): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  if (!ann) return true;
  return validateLaunchLocation({
    city: ann.job_city ?? null,
    province: ann.job_province ?? null,
    lat: ann.job_latitude ?? ann.location_lat ?? null,
    lng: ann.job_longitude ?? ann.location_lng ?? null,
  });
}

/** True quando l'annuncio è FUORI area operativa (nessun flusso operativo). */
export function isOutsideOperationalArea(
  ann: OperationalAreaInput | null | undefined,
): boolean {
  return !isInOperationalArea(ann);
}

/** Riconosce l'errore applicativo del database (REST diretta inclusa). */
export function isOutsideOperationalAreaError(err: unknown): boolean {
  const msg =
    typeof err === "string"
      ? err
      : ((err as { message?: string } | null)?.message ?? "");
  return msg.toUpperCase().includes(OUTSIDE_OPERATIONAL_AREA_CODE);
}
