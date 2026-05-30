/**
 * Shared formatters used both by the worker cards (Mappa / Cerca lavoratori)
 * and by the worker detail page seen by restaurants. Keeping this logic in
 * one place avoids the "card shows Torino · Tutte le zone but the profile
 * shows —" inconsistency.
 */

export type WorkerLocationInput = {
  city?: string | null;
  neighborhood?: string | null;
  province?: string | null;
  service_area_city?: string | null;
  service_area_district?: string | null;
  location_city?: string | null;
  location_zone?: string | null;
  location_province?: string | null;
  residence_city?: string | null;
  residence_province?: string | null;
  selected_zones?: string[] | null;
  all_zones?: boolean | null;
};

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Same precedence the Mappa list uses. */
export function resolveWorkerCity(p: WorkerLocationInput): string {
  return (
    clean(p.location_city) ||
    clean(p.service_area_city) ||
    clean(p.city) ||
    clean(p.residence_city) ||
    ""
  );
}

/** Returns a zone label; falls back to "Tutte le zone" when all_zones is set. */
export function resolveWorkerZone(p: WorkerLocationInput): string {
  if (p.all_zones === true) return "Tutte le zone";
  const explicit =
    clean(p.location_zone) ||
    clean(p.service_area_district) ||
    clean(p.neighborhood);
  if (explicit) return explicit;
  const sel = Array.isArray(p.selected_zones)
    ? p.selected_zones.map(clean).filter(Boolean)
    : [];
  if (sel.length > 0) return sel.join(", ");
  return "";
}

/**
 * Single source of truth used in cards AND in the worker detail page.
 * Examples:
 *   "Torino · Tutte le zone"
 *   "Torino · Centro"
 *   "Torino"
 *   "Zona: Centro"
 *   "—" (only when nothing at all is set)
 */
export function formatWorkerLocation(p: WorkerLocationInput): string {
  const city = resolveWorkerCity(p);
  const zone = resolveWorkerZone(p);
  const province =
    clean(p.location_province) ||
    clean(p.province) ||
    clean(p.residence_province);
  if (city && zone) return `${city} · ${zone}`;
  if (city && province) return `${city} · ${province}`;
  if (city) return city;
  if (zone) return `Zona: ${zone}`;
  if (province) return province;
  return "—";
}