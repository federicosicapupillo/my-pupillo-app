/**
 * Codice Fiscale validation helper.
 *
 * Wraps `codice-fiscale-js` to provide a single entry point that:
 *  1. Validates the CF format + checksum (already covered by CF_REGEX but the
 *     lib also checks the control character).
 *  2. Verifies coherence with the anagrafica actually collected by Pupillo:
 *     nome, cognome, data di nascita, comune/Stato estero di nascita.
 *     Il sesso NON viene mai controllato perché non viene richiesto in
 *     registrazione: la data di nascita è confrontata con giorno decodificato
 *     modulo 40 (day+40 per le donne).
 *  3. Nome e cognome vengono normalizzati (uppercase, rimozione accenti,
 *     apostrofi, trattini, spazi multipli) prima del calcolo dei codici
 *     consonanti/vocali. La libreria applica le regole standard per nomi
 *     con 4+ consonanti e per cognomi/nomi composti.
 *  4. Se il Belfiore non è risolvibile (foreign / Z-code / comuni storici),
 *     il controllo del luogo viene saltato per evitare falsi negativi.
 *
 * Omocodie: `computeInverse` transparently handles the standard omocodia
 * substitutions per data/luogo; i primi 6 caratteri (cognome+nome) sono
 * sempre lettere e non sono toccati dall'omocodia, quindi il confronto
 * con i codici calcolati è diretto.
 */
import CodiceFiscale from "codice-fiscale-js";

export type CfValidationInput = {
  cf: string;
  birthDate?: string | null; // ISO yyyy-mm-dd
  birthPlace?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type CfValidationResult =
  | { ok: true }
  | { ok: false; error: string; field?: "tax_code" };

const CF_REGEX =
  /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$|^[0-9]{11}$/;

/** Messaggio unico di incoerenza CF ↔ anagrafica. */
export const CF_MISMATCH_MESSAGE =
  "Il codice fiscale non corrisponde ai dati anagrafici inseriti. Controlla nome, cognome, data e luogo di nascita.";

function normalizePlace(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normalizza nome/cognome per il calcolo del codice CF:
 *  - NFD + rimozione diacritici (È → E, ç → C)
 *  - uppercase
 *  - rimozione apostrofi, trattini, punti, spazi multipli
 *  - collassa in una stringa di sole A-Z (la libreria applica poi le
 *    regole consonanti/vocali standard, inclusa la gestione di nomi
 *    con 4+ consonanti)
 */
function normalizeAnagName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function validateCodiceFiscale(
  input: CfValidationInput,
): CfValidationResult {
  const cf = (input.cf ?? "").trim().toUpperCase();
  if (!cf) return { ok: false, error: "Codice fiscale obbligatorio.", field: "tax_code" };
  if (!CF_REGEX.test(cf)) {
    return { ok: false, error: "Codice fiscale non valido.", field: "tax_code" };
  }
  // Numeric-only P.IVA-style CF (rare, only for entities): format is enough.
  if (/^[0-9]{11}$/.test(cf)) return { ok: true };

  // Checksum
  try {
    if (!CodiceFiscale.check(cf)) {
      return { ok: false, error: "Codice fiscale non valido (checksum errato).", field: "tax_code" };
    }
  } catch {
    return { ok: false, error: "Codice fiscale non valido.", field: "tax_code" };
  }

  let decoded: ReturnType<typeof CodiceFiscale.computeInverse> | null = null;
  try {
    decoded = CodiceFiscale.computeInverse(cf);
  } catch {
    // Unable to decode (e.g. unresolved Belfiore) — accept format+checksum
    // to avoid false negatives on foreign / historical comuni.
    return { ok: true };
  }

  // --- Coerenza cognome (primi 3 caratteri, lettere, immuni da omocodia) ---
  if (input.lastName && input.lastName.trim()) {
    const norm = normalizeAnagName(input.lastName);
    if (norm.length > 0) {
      try {
        const expected = CodiceFiscale.surnameCode(norm);
        if (expected && expected.length === 3 && cf.slice(0, 3) !== expected) {
          return { ok: false, field: "tax_code", error: CF_MISMATCH_MESSAGE };
        }
      } catch {
        // se la libreria non riesce a calcolare, non blocchiamo
      }
    }
  }

  // --- Coerenza nome (caratteri 4-6) ---
  if (input.firstName && input.firstName.trim()) {
    const norm = normalizeAnagName(input.firstName);
    if (norm.length > 0) {
      try {
        const expected = CodiceFiscale.nameCode(norm);
        if (expected && expected.length === 3 && cf.slice(3, 6) !== expected) {
          return { ok: false, field: "tax_code", error: CF_MISMATCH_MESSAGE };
        }
      } catch {
        // ignora
      }
    }
  }

  // Coerenza con data di nascita
  if (input.birthDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (decoded.year !== y || decoded.month !== mo || decoded.day !== d) {
        return { ok: false, field: "tax_code", error: CF_MISMATCH_MESSAGE };
      }
    }
  }

  // Coerenza con luogo di nascita (solo se conosciamo il comune)
  if (input.birthPlace && decoded.birthplace) {
    const expected = normalizePlace(String(decoded.birthplace));
    const provided = normalizePlace(input.birthPlace);
    // Skip if the decoded name looks like a placeholder / foreign (Z-code) or if user typed something too short.
    if (expected && provided && expected.length > 1 && provided.length > 1) {
      if (expected !== provided) {
        return { ok: false, field: "tax_code", error: CF_MISMATCH_MESSAGE };
      }
    }
  }

  return { ok: true };
}
