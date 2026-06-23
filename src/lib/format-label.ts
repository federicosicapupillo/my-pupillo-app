/**
 * Centralized helper to render technical slugs (e.g. `saper_portare_tre_piatti`,
 * `patente_a`, `italiano_intermedio`) as human-readable labels for the UI.
 *
 * Display-only: never use to transform values before saving them to the DB,
 * filtering, matching or any business logic.
 */

const EXPLICIT_LABELS: Record<string, string> = {
  saper_portare_tre_piatti: "Saper portare tre piatti",
  servizio_al_tavolo: "Servizio al tavolo",
  gestione_cassa: "Gestione cassa",
  presa_comande: "Presa comande",
  caffetteria: "Caffetteria",
  preparazione_caffetteria: "Caffetteria",
  spillatura_birra: "Spillatura birra",
  preparazione_cocktail: "Preparazione cocktail",
  uso_cassa: "Uso cassa",
  uso_palmare: "Uso palmare/comande",
  lavapiatti: "Lavapiatti",
  cucina_base: "Cucina base",
  banqueting: "Banqueting",
  fine_dining: "Fine dining",
  gestione_sala: "Gestione sala",
  italiano_base: "Italiano base",
  italiano_intermedio: "Italiano intermedio",
  italiano_avanzato: "Italiano avanzato",
  italiano_madrelingua: "Italiano madrelingua",
  inglese_base: "Inglese base",
  inglese_intermedio: "Inglese intermedio",
  inglese_avanzato: "Inglese avanzato",
  francese_base: "Francese base",
  francese_intermedio: "Francese intermedio",
  francese_avanzato: "Francese avanzato",
  tedesco_base: "Tedesco base",
  tedesco_intermedio: "Tedesco intermedio",
  tedesco_avanzato: "Tedesco avanzato",
  spagnolo_base: "Spagnolo base",
  spagnolo_intermedio: "Spagnolo intermedio",
  spagnolo_avanzato: "Spagnolo avanzato",
  patente_a: "Patente A",
  patente_b: "Patente B",
  patente_c: "Patente C",
  patente_d: "Patente D",
  patente_e: "Patente E",
  nessuna: "Nessuna",
  automunito: "Automunito",
  altro: "Altro",
};

/**
 * Convert a single slug-like value into a human-readable label.
 * - Falls back to a safe formatter that replaces underscores with spaces
 *   and capitalizes the first letter.
 * - Handles the "patente_x" pattern by uppercasing the single-letter suffix.
 */
export function formatDisplayLabel(value: string | null | undefined): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  const explicit = EXPLICIT_LABELS[key];
  if (explicit) return explicit;

  // Handle "patente_<letter>" / "patente_<letter><number>" defensively
  const patente = /^patente[_\s-]+([a-z]{1,3}[0-9]?)$/i.exec(raw);
  if (patente) return `Patente ${patente[1].toUpperCase()}`;

  const spaced = raw.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Map an array of slugs into their readable labels (skips empty entries). */
export function formatDisplayLabels(values: ReadonlyArray<string | null | undefined> | null | undefined): string[] {
  if (!values || values.length === 0) return [];
  const out: string[] = [];
  for (const v of values) {
    const label = formatDisplayLabel(v);
    if (label) out.push(label);
  }
  return out;
}