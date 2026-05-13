/**
 * Server-side validator parity check.
 *
 * `runWorkerDocumentDateValidation` is the pure core of the
 * `validateWorkerDocumentDates` server function. Tests here MUST stay in
 * sync with `src/lib/__tests__/onboarding-date-guard` and the DB trigger
 * `enforce_worker_personal_data`, so that a violation surfaces the same
 * Italian message no matter which layer rejects it.
 */
import { describe, it, expect } from "vitest";
import {
  runWorkerDocumentDateValidation,
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
} from "@/lib/worker-profile.functions";

const TODAY = new Date(2026, 4, 13); // 13/05/2026

const valid = {
  birth_date: "1990-06-01",
  id_document_issued_at: "2024-01-15",
  id_document_expires_at: "2030-01-15",
};

describe("runWorkerDocumentDateValidation — server-side parity", () => {
  it("accepts a valid trio", () => {
    expect(runWorkerDocumentDateValidation(valid, TODAY)).toEqual({ ok: true });
  });

  it("rejects empty issued/expired dates with the dd/mm/yyyy message", () => {
    expect(
      runWorkerDocumentDateValidation(
        { ...valid, id_document_issued_at: "" },
        TODAY,
      ),
    ).toEqual({ ok: false, error: INVALID_DATE_MESSAGE });
    expect(
      runWorkerDocumentDateValidation(
        { ...valid, id_document_expires_at: "" },
        TODAY,
      ),
    ).toEqual({ ok: false, error: INVALID_DATE_MESSAGE });
  });

  it("rejects a future issued date with the trigger's exact message", () => {
    expect(
      runWorkerDocumentDateValidation(
        { ...valid, id_document_issued_at: "2027-01-01" },
        TODAY,
      ),
    ).toEqual({ ok: false, error: DOC_DATE_ERRORS.ISSUED_FUTURE });
  });

  it("rejects an expired document with the trigger's exact message", () => {
    expect(
      runWorkerDocumentDateValidation(
        {
          ...valid,
          id_document_issued_at: "2020-01-01",
          id_document_expires_at: "2025-01-01",
        },
        TODAY,
      ),
    ).toEqual({ ok: false, error: DOC_DATE_ERRORS.EXPIRED });
  });

  it("rejects scadenza == rilascio with EXPIRES_BEFORE_ISSUED", () => {
    expect(
      runWorkerDocumentDateValidation(
        {
          ...valid,
          id_document_issued_at: "2026-05-13",
          id_document_expires_at: "2026-05-13",
        },
        TODAY,
      ),
    ).toEqual({ ok: false, error: DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED });
  });
});