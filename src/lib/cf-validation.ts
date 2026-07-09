/**
 * Codice Fiscale validation helper.
 *
 * Wraps `codice-fiscale-js` to provide a single entry point that:
 *  1. Validates the CF format + checksum (already covered by CF_REGEX but the
 *     lib also checks the control character).
 *  2. Decodes the CF and checks that the encoded birth date matches the
 *     `birth_date` (ISO yyyy-mm-dd) filled in the form.
 *  3. If a `birth_place` is provided AND the lib can resolve the CF's Belfiore
 *     code to a comune, compares the two names (case- and accent-insensitive).
 *     If the Belfiore code is unknown (foreign / Z000, obsolete comuni), we
 *     do NOT raise a false negative — the check is skipped.
 *
 * Omocodie: `computeInverse` transparently handles the standard omocodia
 * substitutions, so a CF with letter substitutions in numeric positions still
 * yields the correct decoded fields.
 */
import CodiceFiscale from "codice-fiscale-js";

export type CfValidationInput = {
  cf: string;
  birthDate?: string | null; // ISO yyyy-mm-dd
  birthPlace?: string | null;
};

export type CfValidationResult =
  | { ok: true }
  | { ok: false; error: string; field?: "tax_code" };

const CF_REGEX =
  /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$|^[0-9]{11}$/;

function normalizePlace(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

  // Coerenza con data di nascita
  if (input.birthDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (decoded.year !== y || decoded.month !== mo || decoded.day !== d) {
        return {
          ok: false,
          field: "tax_code",
          error:
            "Il codice fiscale non corrisponde alla data di nascita inserita.",
        };
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
        return {
          ok: false,
          field: "tax_code",
          error:
            "Il codice fiscale non corrisponde al luogo di nascita inserito.",
        };
      }
    }
  }

  return { ok: true };
}
