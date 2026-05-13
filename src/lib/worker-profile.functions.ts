/**
 * Server-side validation for the worker ID document dates.
 *
 * The same three rules are enforced in three places to keep the system
 * consistent end-to-end:
 *   1. Client form guard      — `evaluateOnboardingDateGuard` (immediate UI)
 *   2. Server function (here) — runs under the user's auth session
 *   3. Database trigger       — `enforce_worker_personal_data` (final guard)
 *
 * The error messages returned here MUST match the messages emitted by the
 * client guard and by the DB trigger character-for-character. The shared
 * source of truth is `src/lib/document-dates.ts` (`DOC_DATE_ERRORS`,
 * `INVALID_DATE_MESSAGE`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evaluateOnboardingDateGuard,
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
} from "@/lib/onboarding-date-guard";

const ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_DATE_MESSAGE);

const Schema = z.object({
  birth_date: ISO_DATE,
  id_document_issued_at: ISO_DATE,
  id_document_expires_at: ISO_DATE,
});

export type ValidateWorkerDocumentDatesResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validate the worker's ID document dates (data di nascita, rilascio,
 * scadenza) against the same calendar rules used by the client form and
 * the DB trigger. Returns `{ ok: true }` on success, otherwise the exact
 * Italian message the user should see.
 */
export const validateWorkerDocumentDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    // Normalize null/undefined to empty strings so the date guard reports
    // the dd/mm/yyyy message instead of a Zod shape error.
    const obj =
      input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    return {
      birth_date: typeof obj.birth_date === "string" ? obj.birth_date : "",
      id_document_issued_at:
        typeof obj.id_document_issued_at === "string"
          ? obj.id_document_issued_at
          : "",
      id_document_expires_at:
        typeof obj.id_document_expires_at === "string"
          ? obj.id_document_expires_at
          : "",
    };
  })
  .handler(
    async ({ data, context }): Promise<ValidateWorkerDocumentDatesResult> => {
      // Shape check first — surfaces INVALID_DATE_MESSAGE for malformed payloads.
      const shape = Schema.safeParse(data);
      if (!shape.success) {
        await logFailure(context, INVALID_DATE_MESSAGE, data);
        return { ok: false, error: INVALID_DATE_MESSAGE };
      }
      const result = runWorkerDocumentDateValidation(shape.data, new Date());
      if (!result.ok) {
        await logFailure(context, result.error, shape.data);
      }
      return result;
    },
  );

/**
 * Best-effort write to activity_logs via the SECURITY DEFINER helper
 * `log_profile_date_validation_failure`. Failures here MUST NOT block the
 * validation response — logging is observability, not a security boundary.
 */
async function logFailure(
  context: { supabase: unknown },
  reason: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = context.supabase as {
      rpc: (
        fn: "log_profile_date_validation_failure",
        args: { _reason: string; _payload: unknown },
      ) => Promise<unknown>;
    };
    await sb.rpc("log_profile_date_validation_failure", {
      _reason: reason,
      _payload: payload,
    });
  } catch (e) {
    // Swallow — never let logging break the response.
    console.error("[worker-profile] failed to log date validation failure", e);
  }
}

/**
 * Pure variant used by the server function and re-exported so callers (the
 * onboarding form, future admin tools) can dry-run the same validation
 * without an HTTP round-trip.
 */
export function runWorkerDocumentDateValidation(
  input: {
    birth_date: string | null | undefined;
    id_document_issued_at: string | null | undefined;
    id_document_expires_at: string | null | undefined;
  },
  today: Date = new Date(),
): ValidateWorkerDocumentDatesResult {
  const guard = evaluateOnboardingDateGuard(input, today);
  if (guard.blocked) return { ok: false, error: guard.message };
  return { ok: true };
}

export { DOC_DATE_ERRORS, INVALID_DATE_MESSAGE };