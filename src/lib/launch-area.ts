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

const BOLOGNA_COMUNI: LaunchAreaComune[] = [
  { name: "Alto Reno Terme", caps: ["40046"] },
  { name: "Anzola dell'Emilia", caps: ["40011"] },
  { name: "Argelato", caps: ["40050"] },
  { name: "Baricella", caps: ["40052"] },
  { name: "Bentivoglio", caps: ["40010"] },
  { name: "Bologna", caps: ["40121","40122","40123","40124","40125","40126","40127","40128","40129","40131","40132","40133","40134","40135","40136","40137","40138","40139","40141"] },
  { name: "Borgo Tossignano", caps: ["40021"] },
  { name: "Budrio", caps: ["40054"] },
  { name: "Calderara di Reno", caps: ["40012"] },
  { name: "Camugnano", caps: ["40032"] },
  { name: "Casalecchio di Reno", caps: ["40033"] },
  { name: "Casalfiumanese", caps: ["40020"] },
  { name: "Castel d'Aiano", caps: ["40034"] },
  { name: "Castel del Rio", caps: ["40022"] },
  { name: "Castel di Casio", caps: ["40030"] },
  { name: "Castel Guelfo di Bologna", caps: ["40023"] },
  { name: "Castel Maggiore", caps: ["40013"] },
  { name: "Castel San Pietro Terme", caps: ["40024"] },
  { name: "Castello d'Argile", caps: ["40050"] },
  { name: "Castenaso", caps: ["40055"] },
  { name: "Castiglione dei Pepoli", caps: ["40035"] },
  { name: "Crevalcore", caps: ["40014"] },
  { name: "Dozza", caps: ["40060"] },
  { name: "Fontanelice", caps: ["40025"] },
  { name: "Gaggio Montano", caps: ["40041"] },
  { name: "Galliera", caps: ["40015"] },
  { name: "Granarolo dell'Emilia", caps: ["40057"] },
  { name: "Grizzana Morandi", caps: ["40030"] },
  { name: "Imola", caps: ["40026"] },
  { name: "Lizzano in Belvedere", caps: ["40042"] },
  { name: "Loiano", caps: ["40050"] },
  { name: "Malalbergo", caps: ["40051"] },
  { name: "Marzabotto", caps: ["40043"] },
  { name: "Medicina", caps: ["40059"] },
  { name: "Minerbio", caps: ["40061"] },
  { name: "Molinella", caps: ["40062"] },
  { name: "Monghidoro", caps: ["40063"] },
  { name: "Monte San Pietro", caps: ["40050"] },
  { name: "Monterenzio", caps: ["40050"] },
  { name: "Monzuno", caps: ["40036"] },
  { name: "Mordano", caps: ["40027"] },
  { name: "Ozzano dell'Emilia", caps: ["40064"] },
  { name: "Pianoro", caps: ["40065"] },
  { name: "Pieve di Cento", caps: ["40066"] },
  { name: "Sala Bolognese", caps: ["40010"] },
  { name: "San Benedetto Val di Sambro", caps: ["40048"] },
  { name: "San Giorgio di Piano", caps: ["40016"] },
  { name: "San Giovanni in Persiceto", caps: ["40017"] },
  { name: "San Lazzaro di Savena", caps: ["40068"] },
  { name: "San Pietro in Casale", caps: ["40018"] },
  { name: "Sant'Agata Bolognese", caps: ["40019"] },
  { name: "Sasso Marconi", caps: ["40037"] },
  { name: "Valsamoggia", caps: ["40053"] },
  { name: "Vergato", caps: ["40038"] },
  { name: "Zola Predosa", caps: ["40069"] },
];

export const LAUNCH_AREAS: LaunchArea[] = [
  {
    code: "BO",
    name: "Città metropolitana di Bologna",
    region: "Emilia-Romagna",
    province: "Bologna",
    province_code: "BO",
    center: [44.4949, 11.3426],
    radius_km: 60,
    active: true,
    comuni: BOLOGNA_COMUNI,
  },
];

export const ACTIVE_LAUNCH_AREAS = LAUNCH_AREAS.filter((a) => a.active);

/** True se è in corso una fase di lancio con restrizione territoriale. */
export const LAUNCH_AREA_RESTRICTED = ACTIVE_LAUNCH_AREAS.length > 0;

/** Messaggio di errore per località non consentita. */
export const LAUNCH_AREA_ERROR_MESSAGE =
  "Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.";

/** Comunicazione informativa mostrata dove si sceglie la località. */
export const LAUNCH_AREA_NOTICE =
  "Pupillo parte da Bologna. In questa fase puoi cercare o pubblicare turni esclusivamente a Bologna e provincia.";

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
  if (typeof lat !== "number" || typeof lng !== "number") return true;
  return ACTIVE_LAUNCH_AREAS.some((a) => {
    const dLat = (lat - a.center[0]) * 111;
    const dLng = (lng - a.center[1]) * 111 * Math.cos((a.center[0] * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng) <= a.radius_km;
  });
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
