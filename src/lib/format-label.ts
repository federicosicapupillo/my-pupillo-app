/**
 * Formatter centralizzato per mostrare all'utente i valori tecnici salvati a
 * DB (slug, enum, chiavi applicative) come etichette italiane leggibili.
 *
 * Regole (nell'ordine):
 *  1. se esiste una label ufficiale nei dizionari del progetto, vince quella;
 *  2. i termini da preservare (HACCP, B&B, part-time…) restano invariati;
 *  3. gli underscore vengono sempre sostituiti con uno spazio;
 *  4. i trattini vengono sostituiti SOLO quando il valore è certamente uno
 *     slug tecnico (tutto minuscolo, senza spazi);
 *  5. i testi già formattati (con spazi o maiuscole) restano invariati.
 *
 * Solo presentazione: non usare mai per trasformare valori prima di salvarli,
 * filtrarli o confrontarli.
 */

import {
  ALL_OPTION_LISTS,
  LEGACY_VALUE_LABELS,
  PRESERVED_TERM_LABELS,
} from "@/lib/requirement-options";
import { JOB_ROLE_CATALOG } from "@/lib/job-roles";

/** Dizionario ufficiale valore tecnico → etichetta, costruito una sola volta. */
const OFFICIAL_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const list of ALL_OPTION_LISTS) {
    for (const opt of list) {
      if (!(opt.value in map)) map[opt.value] = opt.label;
    }
  }
  for (const role of JOB_ROLE_CATALOG) {
    if (!(role.id in map)) map[role.id] = role.label;
  }
  for (const [k, v] of Object.entries(LEGACY_VALUE_LABELS)) {
    if (!(k in map)) map[k] = v;
  }
  return map;
})();

/** Espone il dizionario ufficiale (sola lettura) per test e diagnostica. */
export function getOfficialLabels(): Readonly<Record<string, string>> {
  return OFFICIAL_LABELS;
}

/** true se il valore ha l'aspetto di uno slug tecnico (minuscolo, senza spazi). */
function isTechnicalSlug(raw: string): boolean {
  return !/\s/.test(raw) && raw === raw.toLowerCase();
}

/**
 * Converte un singolo valore strutturato in etichetta leggibile.
 * Restituisce "" per null, undefined e stringhe vuote.
 */
export function formatDisplayLabel(value: string | null | undefined): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const key = raw.toLowerCase();

  // 1. label ufficiale del progetto
  const official = OFFICIAL_LABELS[key];
  if (official) return official;

  // 2. acronimi e diciture da preservare
  const preserved = PRESERVED_TERM_LABELS[key];
  if (preserved) return preserved;

  // Pattern difensivo "patente_<lettera>"
  const patente = /^patente[_\s-]+([a-z]{1,3}[0-9]?)$/i.exec(raw);
  if (patente) return `Patente ${patente[1].toUpperCase()}`;

  // 3/4. underscore sempre, trattini solo sugli slug tecnici
  const separators = isTechnicalSlug(raw) ? /[_-]+/g : /_+/g;
  const spaced = raw.replace(separators, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return raw;

  // 5. testo già formattato (contiene maiuscole o spazi originali): non alterarlo
  if (!isTechnicalSlug(raw)) return spaced;

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Applica `formatDisplayLabel` a un array, scartando i valori vuoti. */
export function formatDisplayLabels(
  values: ReadonlyArray<string | null | undefined> | null | undefined,
): string[] {
  if (!values || values.length === 0) return [];
  const out: string[] = [];
  for (const v of values) {
    const label = formatDisplayLabel(v);
    if (label) out.push(label);
  }
  return out;
}
