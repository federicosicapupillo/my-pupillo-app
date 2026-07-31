import { ALLOWED_COMUNI, ACTIVE_LAUNCH_AREAS, normalizePlaceName } from "@/lib/launch-area";

/**
 * Comuni selezionabili dal lavoratore per la zona di lavoro.
 * Derivano ESCLUSIVAMENTE dalla configurazione delle aree di lancio attive
 * (`@/lib/launch-area`): nessuna lista hardcoded per pagina.
 */
export const WORKER_CITIES: string[] = ALLOWED_COMUNI;

export const ALL_ZONES_OPTION = "Tutte le zone";

/** Sigla provincia del comune, dalla configurazione territoriale. */
export function provinceCodeForCity(city: string | null | undefined): string {
  const n = normalizePlaceName(city);
  for (const a of ACTIVE_LAUNCH_AREAS) {
    if (a.comuni.some((c) => normalizePlaceName(c.name) === n)) return a.province_code;
  }
  return "";
}

/** Quartieri/zone note (solo per i comuni capoluogo con zone mappate). */
export const CITY_ZONES: Record<string, string[]> = {
  Bologna: ["Centro Storico", "Bolognina", "San Donato", "Santo Stefano", "Saragozza", "Murri", "Navile", "Borgo Panigale", "Savena"],
};

export function zonesForCity(city: string): string[] {
  return CITY_ZONES[city] ?? [];
}
