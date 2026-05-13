/**
 * Live `dd/mm/yyyy` input mask helpers.
 *
 * The goal is "cursor-friendly" formatting: as the user types digits, slashes
 * are inserted at positions 2 and 5, non-digits are stripped, and the caret
 * stays anchored to the same logical digit.
 *
 * The mask only formats the visible string. Calendar correctness
 * (`30/02/2026` etc.) is enforced separately by `parseItalianDateToISO` in
 * `src/lib/document-dates.ts`.
 */

/** Format a raw user string as `dd/mm/yyyy`, capping at 8 digits. */
export function formatDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Count how many digits appear in `value` strictly before index `caret`.
 * This is the cursor's logical position relative to the digit stream and
 * survives reformatting that adds or removes slashes.
 */
export function digitsBeforeCaret(value: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(caret, value.length); i++) {
    if (/\d/.test(value[i]!)) n++;
  }
  return n;
}

/**
 * Translate a logical digit-position back to a caret offset inside the
 * formatted string. The caret lands AFTER the Nth digit (or at the end if
 * the formatted string has fewer digits).
 */
export function caretAfterDigit(formatted: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++;
      if (seen === digitIndex) {
        // Skip a trailing slash that the mask just inserted so the next
        // typed digit lands in the next group, not before the slash.
        return formatted[i + 1] === "/" ? i + 2 : i + 1;
      }
    }
  }
  return formatted.length;
}

/**
 * Convert a fully-typed `dd/mm/yyyy` string to ISO `yyyy-mm-dd`, or `null` if
 * the string is not a real calendar day. Re-uses the strict parser to keep a
 * single source of truth for "is this a valid date".
 */
export { parseItalianDateToISO as maskedToISO } from "./document-dates";