/**
 * Submit-time guard for the worker onboarding date inputs
 * (data di nascita, data di rilascio, data di scadenza).
 *
 * Returns the FIRST exact toast message that should be shown to the user
 * when the form attempts to submit, or `null` if all dates are valid.
 *
 * The order of checks mirrors `saveProfile` in
 * `src/routes/onboarding.tsx` so that the message a user sees in the UI
 * is identical to the message asserted by the test suite.
 */
import {
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
  validateDocumentDates,
  validateRequiredDates,
} from "./document-dates";

export type OnboardingDateInputs = {
  birth_date: string | null | undefined;
  id_document_issued_at: string | null | undefined;
  id_document_expires_at: string | null | undefined;
};

export type OnboardingDateGuardResult =
  | { blocked: false; message: null }
  | { blocked: true; message: string };

export function evaluateOnboardingDateGuard(
  input: OnboardingDateInputs,
  today: Date = new Date(),
): OnboardingDateGuardResult {
  const fmt = validateRequiredDates([
    input.birth_date,
    input.id_document_issued_at,
    input.id_document_expires_at,
  ]);
  if (fmt) return { blocked: true, message: fmt };

  const range = validateDocumentDates(
    input.id_document_issued_at,
    input.id_document_expires_at,
    today,
  );
  if (range) return { blocked: true, message: range };

  return { blocked: false, message: null };
}

// Re-export the canonical messages so tests assert against the single source of truth.
export { DOC_DATE_ERRORS, INVALID_DATE_MESSAGE };