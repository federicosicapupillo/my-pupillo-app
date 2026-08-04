/**
 * UNICA sorgente dati (pura, senza dipendenze UI) delle opzioni strutturate
 * usate negli annunci: patente, lingue, aspetto, competenze, dress code e
 * velocità di ricerca.
 *
 * Ogni opzione ha:
 *  - `value`: chiave tecnica salvata a DB (mai tradotta, mai riformattata)
 *  - `label`: etichetta italiana mostrata all'utente
 *
 * Questo modulo non importa nulla, così può essere usato sia dai componenti
 * React sia dal formatter centralizzato (`format-label.ts`) senza cicli.
 */

export type Option = { value: string; label: string };

export const LICENSE_OPTIONS = [
  { value: "nessuna", label: "Nessuna" },
  { value: "patente_b", label: "Patente B" },
  { value: "patente_a", label: "Patente A" },
  { value: "automunito", label: "Automunito richiesto" },
  { value: "altro", label: "Altro" },
] as const satisfies readonly Option[];

export const LANGUAGE_OPTIONS = [
  { value: "italiano_base", label: "Italiano base (A2)" },
  { value: "italiano_intermedio", label: "Italiano intermedio (B2)" },
  { value: "italiano_avanzato", label: "Italiano avanzato (C1)" },
  { value: "italiano_madrelingua", label: "Italiano madrelingua" },
  { value: "inglese_base", label: "Inglese base (A2)" },
  { value: "inglese_intermedio", label: "Inglese intermedio (B2)" },
  { value: "inglese_avanzato", label: "Inglese avanzato (C1)" },
  { value: "francese_base", label: "Francese base (A2)" },
  { value: "francese_intermedio", label: "Francese intermedio (B2)" },
  { value: "francese_avanzato", label: "Francese avanzato (C1)" },
  { value: "tedesco_base", label: "Tedesco base (A2)" },
  { value: "tedesco_intermedio", label: "Tedesco intermedio (B2)" },
  { value: "tedesco_avanzato", label: "Tedesco avanzato (C1)" },
  { value: "spagnolo_base", label: "Spagnolo base (A2)" },
  { value: "spagnolo_intermedio", label: "Spagnolo intermedio (B2)" },
  { value: "spagnolo_avanzato", label: "Spagnolo avanzato (C1)" },
] as const satisfies readonly Option[];

export const TATTOO_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_non_visibili", label: "Solo se non visibili" },
  { value: "indifferente", label: "Indifferente" },
] as const satisfies readonly Option[];

export const PIERCING_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_discreti", label: "Solo se discreti" },
  { value: "indifferente", label: "Indifferente" },
] as const satisfies readonly Option[];

export const BEARD_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_curata", label: "Solo curata" },
  { value: "indifferente", label: "Indifferente" },
] as const satisfies readonly Option[];

export const SKILL_OPTIONS = [
  { value: "saper_portare_tre_piatti", label: "Saper portare tre piatti" },
  { value: "uso_palmare", label: "Uso palmare/comande" },
  { value: "servizio_al_tavolo", label: "Servizio al tavolo" },
  { value: "preparazione_cocktail", label: "Cocktail base" },
  { value: "preparazione_caffetteria", label: "Caffetteria" },
  { value: "gestione_cassa", label: "Gestione cassa" },
  { value: "banqueting", label: "Banqueting" },
  { value: "fine_dining", label: "Fine dining" },
  { value: "gestione_sala", label: "Gestione sala" },
  { value: "altro", label: "Altro" },
] as const satisfies readonly Option[];

/** Dress code: solo dati (le icone sono aggiunte in `announcement-requirements.ts`). */
export const DRESS_CODE_ITEMS = [
  { value: "accendino", label: "Accendino" },
  { value: "cavatappi", label: "Cavatappi" },
  { value: "penna", label: "Penna" },
  { value: "calze_lunghe_nere", label: "Calze lunghe nere" },
  { value: "cintura_nera", label: "Cintura nera pelle" },
  { value: "grembiule_nero", label: "Grembiule nero" },
  { value: "camicia_bianca", label: "Camicia bianca no loghi" },
  { value: "cravatta_nera", label: "Cravatta nera no loghi" },
  { value: "pantalone_nero", label: "Pantalone nero (no jeans)" },
  { value: "scarpe_nere", label: "Scarpe nere eleganti" },
  { value: "capelli_raccolti", label: "Capelli raccolti" },
  { value: "unghie_curate", label: "Unghie curate" },
  { value: "no_profumi", label: "No profumi intensi" },
  { value: "divisa_fornita", label: "Divisa fornita dal locale" },
  { value: "total_black", label: "Total black" },
  { value: "altro", label: "Altro" },
] as const satisfies readonly Option[];

/** Velocità di ricerca dell'annuncio (enum `service_speed`). */
export const SPEED_OPTIONS = [
  { value: "normal", label: "Normale (7 giorni)" },
  { value: "fast", label: "Veloce (24 ore)" },
  { value: "flash", label: "Flash (immediato)" },
] as const satisfies readonly Option[];

/** Etichetta breve della velocità, per badge e chip compatti. */
export const SPEED_SHORT_LABELS: Record<string, string> = {
  normal: "Normale",
  fast: "Veloce",
  flash: "Flash",
};

/**
 * Valori tecnici storici o provenienti da altre sezioni che non fanno parte
 * delle liste di opzioni ma possono comparire nei dati salvati.
 */
export const LEGACY_VALUE_LABELS: Record<string, string> = {
  uso_cassa: "Uso cassa",
  presa_comande: "Presa comande",
  caffetteria: "Caffetteria",
  spillatura_birra: "Spillatura birra",
  cucina_base: "Cucina base",
  lavapiatti: "Lavapiatti",
  scarpe_antinfortunistiche: "Scarpe antinfortunistiche",
  pantaloni_neri: "Pantaloni neri",
  capelli_legati: "Capelli legati",
  patente_c: "Patente C",
  patente_d: "Patente D",
  patente_e: "Patente E",
  non_specificato: "Non specificato",
  indifferente: "Indifferente",
};

/**
 * Diciture da preservare così come sono: acronimi, sigle e termini con
 * trattino che NON devono essere trasformati dal formatter generico.
 */
export const PRESERVED_TERM_LABELS: Record<string, string> = {
  haccp: "HACCP",
  "b&b": "B&B",
  bb: "B&B",
  "part-time": "Part-time",
  part_time: "Part-time",
  "full-time": "Full-time",
  full_time: "Full-time",
  "on-call": "On-call",
  srl: "SRL",
  snc: "SNC",
  sas: "SAS",
  spa: "SpA",
  iva: "IVA",
  sdi: "SDI",
  pec: "PEC",
  cap: "CAP",
  "no-show": "No-show",
  no_show: "No-show",
};

/** Tutte le liste di opzioni ufficiali del progetto. */
export const ALL_OPTION_LISTS: readonly (readonly Option[])[] = [
  LICENSE_OPTIONS,
  LANGUAGE_OPTIONS,
  TATTOO_OPTIONS,
  PIERCING_OPTIONS,
  BEARD_OPTIONS,
  SKILL_OPTIONS,
  DRESS_CODE_ITEMS,
  SPEED_OPTIONS,
];
