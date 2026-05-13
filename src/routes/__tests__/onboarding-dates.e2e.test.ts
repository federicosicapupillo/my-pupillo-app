/**
 * End-to-end coverage for the worker onboarding date inputs
 * (data di rilascio / data di scadenza), exercised through the same guard
 * that `saveProfile` in `src/routes/onboarding.tsx` runs before submitting.
 *
 * Every assertion checks the EXACT toast message a user would see, so the
 * UI copy and the underlying validators stay in lockstep.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";
import {
  evaluateOnboardingDateGuard,
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
  type OnboardingDateInputs,
} from "@/lib/onboarding-date-guard";

// Pinned "today" so issued/expired comparisons are deterministic.
const TODAY = new Date(2026, 4, 13); // 13/05/2026

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

/**
 * Minimal stand-in for `saveProfile`'s date branch. It mirrors the order:
 *   1. run the date guard
 *   2. on failure -> toast.error(msg) and abort (return false)
 *   3. on success -> proceed (return true)
 */
function attemptSubmit(input: OnboardingDateInputs, today = TODAY): boolean {
  const guard = evaluateOnboardingDateGuard(input, today);
  if (guard.blocked) {
    toast.error(guard.message);
    return false;
  }
  return true;
}

const validDates: OnboardingDateInputs = {
  birth_date: "1990-06-01",
  id_document_issued_at: "2024-01-15",
  id_document_expires_at: "2030-01-15",
};

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  vi.mocked(toast.error).mockClear();
});

describe("onboarding form — submit blocked on missing/invalid dates", () => {
  it("blocks submit and shows the dd/mm/yyyy message when data di rilascio is empty", () => {
    const ok = attemptSubmit({ ...validDates, id_document_issued_at: "" });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
    expect(INVALID_DATE_MESSAGE).toBe(
      "Inserisci una data valida nel formato gg/mm/aaaa.",
    );
  });

  it("blocks submit and shows the dd/mm/yyyy message when data di scadenza is empty", () => {
    const ok = attemptSubmit({ ...validDates, id_document_expires_at: "" });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
  });

  it("blocks submit when data di rilascio is not a real calendar day", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_issued_at: "2024-02-30",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
  });

  it("blocks submit when data di scadenza is not in ISO yyyy-mm-dd shape", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_expires_at: "15/01/2030",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
  });

  it("blocks submit when birth_date is missing (guard runs on all three dates)", () => {
    const ok = attemptSubmit({ ...validDates, birth_date: null });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
  });
});

describe("onboarding form — submit blocked on rilascio/scadenza inconsistencies", () => {
  it("blocks submit when data di rilascio is in the future", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_issued_at: "2027-01-01",
      id_document_expires_at: "2030-01-01",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(DOC_DATE_ERRORS.ISSUED_FUTURE);
    expect(DOC_DATE_ERRORS.ISSUED_FUTURE).toBe(
      "La data di rilascio non può essere futura.",
    );
  });

  it("blocks submit when the document is already expired (scadenza < oggi)", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_issued_at: "2020-01-01",
      id_document_expires_at: "2025-01-01",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(DOC_DATE_ERRORS.EXPIRED);
    expect(DOC_DATE_ERRORS.EXPIRED).toBe(
      "Il documento risulta scaduto. Carica un documento valido.",
    );
  });

  it("blocks submit when scadenza is the same day as rilascio", () => {
    const ok = attemptSubmit({
      ...validDates,
      // both >= today so the EXPIRED check does not short-circuit the assertion
      id_document_issued_at: "2026-05-13",
      id_document_expires_at: "2026-05-13",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED,
    );
    expect(DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED).toBe(
      "La data di scadenza deve essere successiva alla data di rilascio.",
    );
  });

  it("blocks submit when scadenza is before rilascio (using a custom today)", () => {
    // Pick a "today" where issued < today and expires < issued, which
    // means expires < today too. The EXPIRED branch fires first, so the
    // dedicated EXPIRES_BEFORE_ISSUED branch is exercised by anchoring
    // today BEFORE both dates: issued and expires both >= today.
    const customToday = new Date(2024, 0, 1); // 01/01/2024
    const guard = attemptSubmit(
      {
        ...validDates,
        id_document_issued_at: "2028-06-01",
        id_document_expires_at: "2027-01-01",
      },
      customToday,
    );
    expect(guard).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED,
    );
  });

  it("reports the format error first when both format and range are wrong", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_issued_at: "not-a-date",
      id_document_expires_at: "2020-01-01",
    });
    expect(ok).toBe(false);
    // Format guard runs before the range guard.
    expect(toast.error).toHaveBeenCalledWith(INVALID_DATE_MESSAGE);
  });
});

describe("onboarding form — submit allowed on valid dates", () => {
  it("does not block submit and emits no error toast for a valid trio", () => {
    const ok = attemptSubmit(validDates);
    expect(ok).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("accepts a document issued today (boundary case: issued === today)", () => {
    const ok = attemptSubmit({
      ...validDates,
      id_document_issued_at: "2026-05-13",
      id_document_expires_at: "2030-05-13",
    });
    expect(ok).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});