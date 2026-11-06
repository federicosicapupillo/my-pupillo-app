/**
 * Configurazione territoriale centralizzata delle AREE DI LANCIO Pupillo.
 *
 * Unica sorgente di verità lato frontend per province/comuni utilizzabili.
 * Rispecchia le tabelle `public.launch_areas` / `public.launch_area_comuni`
 * (enforcement lato database tramite `public.is_in_launch_area`).
 *
 * Per aprire una nuova provincia in futuro basta aggiungere un'area qui
 * (e la riga corrispondente a database): nessuna pagina va modificata.
 */

import { TORINO_COMUNI } from "@/lib/torino-comuni";

export type LaunchAreaComune = { name: string; caps: string[] };

export type LaunchArea = {
  /** Codice provincia (es. "BO") */
  code: string;
  /** Nome esteso dell'area */
  name: string;
  region: string;
  province: string;
  province_code: string;
  /** Centro geografico approssimato */
  center: [number, number];
  /** Raggio massimo dell'area, in km */
  radius_km: number;
  active: boolean;
  comuni: LaunchAreaComune[];
};

export const LAUNCH_AREAS: LaunchArea[] = [
  {
    code: "TO",
    name: "Città metropolitana di Torino",
    region: "Piemonte",
    province: "Torino",
    province_code: "TO",
    center: [45.0703, 7.6869],
    radius_km: 120,
    active: true,
    comuni: TORINO_COMUNI,
  },
];

export const ACTIVE_LAUNCH_AREAS = LAUNCH_AREAS.filter((a) => a.active);

/**
 * CONFIGURAZIONE CENTRALIZZATA DELL'AREA OPERATIVA.
 *
 * Unico punto in cui è definita la/le provincia/e in cui Pupillo è operativo.
 * Vale per: creazione/pubblicazione annunci, luogo del turno, "Trova offerte",
 * mappa, suggerimenti e notifiche di nuove offerte.
 *
 * NON vale per la residenza del lavoratore, che è un dato anagrafico e può
 * essere qualsiasi comune (vedi `@/lib/italian-comuni`).
 *
 * Per aprire una nuova provincia basta aggiungere un'area in `LAUNCH_AREAS`
 * (e la riga corrispondente a database): nessuna pagina va modificata.
 */
export const OPERATIONAL_PROVINCE_CODES: string[] = ACTIVE_LAUNCH_AREAS.map(
  (a) => a.province_code,
);

/** Sigla della provincia operativa principale (es. "BO"). */
export const OPERATIONAL_PROVINCE_CODE: string | null =
  OPERATIONAL_PROVINCE_CODES[0] ?? null;

/** True se è in corso una fase di lancio con restrizione territoriale. */
export const LAUNCH_AREA_RESTRICTED = ACTIVE_LAUNCH_AREAS.length > 0;

/** Messaggio di errore per località non consentita. */
export const LAUNCH_AREA_ERROR_MESSAGE =
  "Pupillo è attualmente disponibile esclusivamente a Torino e nei comuni della Città metropolitana di Torino.";

/** Comunicazione informativa mostrata dove si sceglie la località. */
export const LAUNCH_AREA_NOTICE =
  "Pupillo parte da Torino. In questa fase puoi cercare o pubblicare turni esclusivamente a Torino e provincia.";

/**
 * Comunicazione mostrata al lavoratore nelle sezioni offerte/disponibilità:
 * chiarisce che la limitazione riguarda il LUOGO DI LAVORO, non la residenza.
 */
export const LAUNCH_AREA_WORKER_NOTICE =
  "In questa fase Pupillo è operativo esclusivamente a Torino e provincia. Potrai visualizzare opportunità lavorative presenti in quest'area.";

export function normalizePlaceName(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Elenco (ordinato) di tutti i comuni consentiti nelle aree attive. */
export const ALLOWED_COMUNI: string[] = ACTIVE_LAUNCH_AREAS.flatMap((a) =>
  a.comuni.map((c) => c.name),
).sort((a, b) => a.localeCompare(b, "it"));

/** Province consentite (nomi) nelle aree attive. */
export const ALLOWED_PROVINCES: string[] = ACTIVE_LAUNCH_AREAS.map((a) => a.province);

/** Sigle provincia consentite nelle aree attive. */
export const ALLOWED_PROVINCE_CODES: string[] = ACTIVE_LAUNCH_AREAS.map((a) => a.province_code);

/** Area attiva di default (usata come preselezione nei filtri). */
export const DEFAULT_LAUNCH_AREA: LaunchArea | null = ACTIVE_LAUNCH_AREAS[0] ?? null;

export function isComuneAllowed(city: string | null | undefined): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  const n = normalizePlaceName(city);
  if (!n) return false;
  return ACTIVE_LAUNCH_AREAS.some((a) =>
    a.comuni.some((c) => normalizePlaceName(c.name) === n),
  );
}

export function isProvinceAllowed(province: string | null | undefined): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  const n = normalizePlaceName(province);
  if (!n) return false;
  return ACTIVE_LAUNCH_AREAS.some(
    (a) => normalizePlaceName(a.province) === n || normalizePlaceName(a.province_code) === n,
  );
}

/**
 * Validazione completa di una località: comune (obbligatorio se indicato) e,
 * quando presente, provincia. Usata da form ristoratore/lavoratore.
 */
export function isLocationAllowed(input: {
  city?: string | null;
  province?: string | null;
}): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  const { city, province } = input;
  if (city) return isComuneAllowed(city);
  if (province) return isProvinceAllowed(province);
  return true;
}

/** Verifica che delle coordinate ricadano nell'area attiva (anti-geocoding fuori zona). */
export function areCoordsInLaunchArea(lat?: number | null, lng?: number | null): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  if (lat == null && lng == null) return true;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return ACTIVE_LAUNCH_AREAS.some((a) => {
    const dLat = (lat - a.center[0]) * 111;
    const dLng = (lng - a.center[1]) * 111 * Math.cos((a.center[0] * Math.PI) / 180);
    // stessa tolleranza di confine usata dal database (+5 km)
    return Math.sqrt(dLat * dLat + dLng * dLng) <= a.radius_km + 5;
  });
}

/**
 * Validazione combinata comune + provincia + coordinate.
 * Rispecchia `public.validate_launch_location` a database: usare questa
 * funzione (e non i singoli controlli) prima di ogni scrittura.
 */
export function validateLaunchLocation(input: {
  city?: string | null;
  province?: string | null;
  lat?: number | null;
  lng?: number | null;
}): boolean {
  if (!LAUNCH_AREA_RESTRICTED) return true;
  const { city, province, lat, lng } = input;
  if (city) {
    if (!isComuneAllowed(city)) return false;
    if (province && !isProvinceAllowed(province)) return false;
  } else if (province && !isProvinceAllowed(province)) {
    return false;
  }
  return areCoordsInLaunchArea(lat, lng);
}

/** CAP consentiti per un comune dell'area attiva. */
export function capsForAllowedComune(city: string | null | undefined): string[] {
  const n = normalizePlaceName(city);
  for (const a of ACTIVE_LAUNCH_AREAS) {
    const c = a.comuni.find((x) => normalizePlaceName(x.name) === n);
    if (c) return c.caps;
  }
  return [];
}
