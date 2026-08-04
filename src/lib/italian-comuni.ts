/**
 * ANAGRAFICA nazionale dei comuni italiani.
 *
 * ATTENZIONE — separazione semantica (regola Pupillo):
 * questo modulo serve ESCLUSIVAMENTE ai dati anagrafici (residenza del
 * lavoratore, luogo di nascita). NON ha nulla a che vedere con l'AREA
 * OPERATIVA di Pupillo (`@/lib/launch-area`), che limita annunci, luoghi
 * di lavoro, offerte e mappa a Bologna e provincia.
 *
 * Un lavoratore può risiedere ovunque: la residenza non filtra e non
 * autorizza nulla in "Trova offerte".
 *
 * Sorgente dati: elenco ISTAT/catastale distribuito con `codice-fiscale-js`
 * (stesso dataset usato per validare il codice fiscale), quindi coerente
 * con la validazione anagrafica già presente.
 */
// @ts-expect-error — modulo JS senza tipi, dataset ufficiale del pacchetto
import { COMUNI } from "codice-fiscale-js/src/lista-comuni.js";
// @ts-expect-error — modulo JS senza tipi
import { PROVINCE } from "codice-fiscale-js/src/lista-province.js";

export type ResidenceComune = {
  /** Nome del comune in forma leggibile (es. "Reggio nell'Emilia") */
  name: string;
  /** Sigla provincia (es. "MS") */
  province_code: string;
  /** Nome provincia esteso (es. "Massa-Carrara") */
  province: string;
  /** Codice catastale (Belfiore) del comune — identificativo stabile */
  cadastral_code: string;
};

/** "REGGIO NELL'EMILIA" → "Reggio nell'Emilia" */
function toTitleCase(raw: string): string {
  const lower = raw.toLowerCase();
  const minor = new Set(["di", "de", "del", "della", "dello", "dei", "degli", "delle", "da", "dal", "d'", "in", "su", "sul", "sulla", "e", "al", "a", "nel", "nella", "con"]);
  return lower
    .split(" ")
    .map((word, i) =>
      word
        .split("'")
        .map((part, j, arr) => {
          const isFirst = i === 0 && j === 0;
          if (!isFirst && arr.length > 1 && j === 0 && minor.has(`${part}'`)) return part;
          if (!isFirst && minor.has(part)) return part;
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("'"),
    )
    .join(" ");
}

type RawComune = [string, string, string, number];

/** Tutti i comuni italiani ATTUALMENTE attivi (esclusi i nomi storici/soppressi). */
export const RESIDENCE_COMUNI: ResidenceComune[] = (() => {
  const seen = new Set<string>();
  const out: ResidenceComune[] = [];
  for (const row of COMUNI as RawComune[]) {
    const [cadastral, provinceCode, name, active] = row;
    if (active !== 1) continue;
    const key = `${name}|${provinceCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: toTitleCase(name),
      province_code: provinceCode,
      province: (PROVINCE as Record<string, string>)[provinceCode] ?? provinceCode,
      cadastral_code: cadastral,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "it"));
})();

function normalize(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, ResidenceComune[]>();
for (const c of RESIDENCE_COMUNI) {
  const k = normalize(c.name);
  const list = BY_NAME.get(k);
  if (list) list.push(c);
  else BY_NAME.set(k, [c]);
}

/**
 * Ricerca di un comune di residenza sull'anagrafica nazionale.
 * `provinceCode` disambigua gli omonimi (es. "Peglio" PU/CO).
 */
export function findResidenceComune(
  city: string | null | undefined,
  provinceCode?: string | null,
): ResidenceComune | null {
  const list = BY_NAME.get(normalize(city));
  if (!list || list.length === 0) return null;
  if (provinceCode) {
    const pc = provinceCode.trim().toUpperCase();
    return list.find((c) => c.province_code === pc) ?? list[0];
  }
  return list[0];
}

/** True se il comune esiste nell'anagrafica nazionale. */
export function isResidenceComuneValid(
  city: string | null | undefined,
  provinceCode?: string | null,
): boolean {
  const found = findResidenceComune(city, provinceCode);
  if (!found) return false;
  if (provinceCode) {
    return found.province_code === provinceCode.trim().toUpperCase();
  }
  return true;
}

/** Validazione CAP anagrafico: 5 cifre. Nessun vincolo territoriale. */
export function isValidResidenceCap(cap: string | null | undefined): boolean {
  return /^\d{5}$/.test((cap ?? "").trim());
}

/** Opzioni pronte per il selettore di residenza. */
export const RESIDENCE_CITY_OPTIONS: { value: string; label: string }[] =
  RESIDENCE_COMUNI.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.province_code})`,
  }));

/** Testo informativo del campo residenza (nessun allarmismo). */
export const RESIDENCE_HELPER_TEXT =
  "Inserisci la tua residenza effettiva. Puoi registrarti da qualsiasi località.";
