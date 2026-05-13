/**
 * Per-type validation for the worker ID document number.
 * MUST stay in sync with the DB trigger `enforce_worker_personal_data`
 * which enforces the same per-type regex on the server.
 */
export type IdDocumentType = "carta_identita" | "passaporto" | "patente";

export const ID_DOC_PATTERNS: Record<IdDocumentType, RegExp> = {
  // 2 lettere + 5 numeri + 2 lettere — esempio: CA12345AB (9 char)
  carta_identita: /^[A-Z]{2}[0-9]{5}[A-Z]{2}$/,
  // Lettere + numeri, 8–9 caratteri — esempio: YA1234567
  passaporto: /^[A-Z0-9]{8,9}$/,
  // Lettere + numeri, esattamente 10 caratteri — esempio: U12345678A
  patente: /^[A-Z0-9]{10}$/,
};

export const ID_DOC_PLACEHOLDER: Record<IdDocumentType, string> = {
  carta_identita: "Es. CA12345AB",
  passaporto: "Es. YA1234567",
  patente: "Es. U12345678A",
};

export const ID_DOC_HINT: Record<IdDocumentType, string> = {
  carta_identita: "9 caratteri: 2 lettere + 5 numeri + 2 lettere.",
  passaporto: "8 o 9 caratteri tra lettere e numeri.",
  patente: "10 caratteri tra lettere e numeri.",
};

/** Per-type max length used to cap the input. */
export const ID_DOC_MAX_LEN: Record<IdDocumentType, number> = {
  carta_identita: 9,
  passaporto: 9,
  patente: 10,
};

export function isValidIdDocNumberForType(
  type: IdDocumentType | "" | null | undefined,
  value: string | null | undefined,
): boolean {
  if (!type || !value) return false;
  const re = ID_DOC_PATTERNS[type as IdDocumentType];
  if (!re) return false;
  return re.test(value.trim().toUpperCase());
}
