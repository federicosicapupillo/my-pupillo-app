/**
 * Validation helpers for the worker ID document dates.
 *
 * The three Italian error messages MUST match the DB trigger
 * `enforce_worker_personal_data` exactly — both layers are covered
 * by the test suites in `src/lib/__tests__/document-dates.test.ts`
 * and `supabase/tests/document_dates_trigger.sql`.
 */

export const DOC_DATE_ERRORS = {
  ISSUED_FUTURE: "La data di rilascio non può essere futura.",
  EXPIRED: "Il documento risulta scaduto.",
  EXPIRES_BEFORE_ISSUED:
    "La data di scadenza deve essere successiva alla data di rilascio.",
} as const;

/**
 * Italian error messages for the worker birth_date field.
 * MUST stay in sync with the DB trigger `enforce_worker_personal_data`
 * and `enforce_worker_date_fields_always`.
 */
export const BIRTH_DATE_ERRORS = {
  FUTURE: "La data di nascita non può essere futura.",
  UNDERAGE: "Devi avere almeno 18 anni per registrarti.",
} as const;

export type BirthDateError =
  (typeof BIRTH_DATE_ERRORS)[keyof typeof BIRTH_DATE_ERRORS];

/** Minimum age (in years) required to complete the worker profile. */
export const MIN_WORKER_AGE_YEARS = 18;

/** Generic message shown when a date input is not a real dd/mm/yyyy value. */
export const INVALID_DATE_MESSAGE =
  "Inserisci una data valida nel formato gg/mm/aaaa.";

export type DocDateError =
  (typeof DOC_DATE_ERRORS)[keyof typeof DOC_DATE_ERRORS];

/** Strip the time component so comparisons are calendar-day based. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Today, expressed as a Date at 00:00 in the Europe/Rome calendar.
 * Use this everywhere that compares the user's documento dates against
 * "oggi" so that midnight in Italia is the boundary, regardless of the
 * runtime timezone (the SSR Worker is UTC).
 */
export function todayInRome(now: Date = new Date()): Date {
  // en-CA gives an ISO yyyy-mm-dd in the requested timezone.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Parse an ISO `yyyy-mm-dd` string to a local Date at 00:00. */
export function parseISODate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (
    dt.getFullYear() !== Number(y) ||
    dt.getMonth() !== Number(mo) - 1 ||
    dt.getDate() !== Number(d)
  ) {
    return null;
  }
  return dt;
}

/**
 * `true` only if the given string is a real calendar day expressible as
 * both ISO `yyyy-mm-dd` and Italian `dd/mm/yyyy`.
 */
export function isValidISODate(iso: string | null | undefined): boolean {
  if (iso == null || iso === "") return false;
  return parseISODate(iso) !== null;
}

/**
 * Validate a list of required date inputs (ISO `yyyy-mm-dd`).
 * Returns the generic dd/mm/yyyy error message if any value is missing
 * or not a real date; `null` otherwise.
 */
export function validateRequiredDates(
  values: Array<string | null | undefined>,
): string | null {
  for (const v of values) {
    if (!isValidISODate(v)) return INVALID_DATE_MESSAGE;
  }
  return null;
}

/** Format an ISO `yyyy-mm-dd` (or Date) as Italian `dd/mm/yyyy`. */
export function formatItalianDate(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseISODate(value ?? null);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Parse an Italian `dd/mm/yyyy` string to ISO `yyyy-mm-dd`. */
export function parseItalianDateToISO(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    dt.getFullYear() !== Number(yyyy) ||
    dt.getMonth() !== Number(mm) - 1 ||
    dt.getDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Validate the issue/expiry date pair.
 * Returns the first matching error message, or `null` if valid.
 * Pass `today` to make tests deterministic.
 */
export function validateDocumentDates(
  issuedISO: string | null | undefined,
  expiresISO: string | null | undefined,
  today: Date = new Date(),
): DocDateError | null {
  const t = startOfDay(today);
  const issued = parseISODate(issuedISO ?? null);
  const expires = parseISODate(expiresISO ?? null);

  if (issued && issued > t) return DOC_DATE_ERRORS.ISSUED_FUTURE;
  if (expires && expires < t) return DOC_DATE_ERRORS.EXPIRED;
  if (issued && expires && expires <= issued)
    return DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED;
  return null;
}

/**
 * Validate the worker's birth date.
 * - Must not be in the future.
 * - Must be at least `MIN_WORKER_AGE_YEARS` years before `today`.
 * Returns the first matching Italian error message, or `null` if valid.
 */
export function validateBirthDate(
  birthISO: string | null | undefined,
  today: Date = new Date(),
): BirthDateError | null {
  const birth = parseISODate(birthISO ?? null);
  if (!birth) return null;
  const t = startOfDay(today);
  if (birth > t) return BIRTH_DATE_ERRORS.FUTURE;
  // Maximum allowed birth date: today minus MIN_WORKER_AGE_YEARS.
  const maxBirth = new Date(
    t.getFullYear() - MIN_WORKER_AGE_YEARS,
    t.getMonth(),
    t.getDate(),
  );
  if (birth > maxBirth) return BIRTH_DATE_ERRORS.UNDERAGE;
  return null;
}