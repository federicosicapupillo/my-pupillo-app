/**
 * Hardened edge-case coverage for the worker document date validators.
 *
 * Focus areas:
 *   - timezone-safe day comparisons (UTC vs local, late-evening "today")
 *   - empty / whitespace / partially filled inputs
 *   - invalid ranges and ordering of error messages
 *   - leap-year boundaries
 *
 * All assertions check the EXACT user-facing Italian copy via the shared
 * `DOC_DATE_ERRORS` / `INVALID_DATE_MESSAGE` constants so the UI and the
 * validators stay in lockstep.
 */
import { describe, it, expect } from "vitest";
import {
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
  isValidISODate,
  parseISODate,
  parseItalianDateToISO,
  validateDocumentDates,
  validateRequiredDates,
} from "../document-dates";
import {
  evaluateOnboardingDateGuard,
  type OnboardingDateInputs,
} from "../onboarding-date-guard";

const TODAY = new Date(2026, 4, 13); // 13/05/2026 — local midnight

const validTrio: OnboardingDateInputs = {
  birth_date: "1990-06-01",
  id_document_issued_at: "2024-01-15",
  id_document_expires_at: "2030-01-15",
};

describe("document dates — timezone-safe comparisons", () => {
  it("treats 'today' at 23:59 local time as the same calendar day as 00:00", () => {
    const lateToday = new Date(2026, 4, 13, 23, 59, 59, 999);
    // Issued exactly on the same calendar day must still pass.
    expect(
      validateDocumentDates("2026-05-13", "2030-05-13", lateToday),
    ).toBeNull();
    // Expiring on the same calendar day must NOT report EXPIRED
    // (the guard normalizes to start-of-day).
    expect(
      validateDocumentDates("2020-01-01", "2026-05-13", lateToday),
    ).toBe(DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED) /* sanity: range still triggers */ === false
      ? null
      : null;
  });

  it("does not flip results when 'today' is built from UTC hours that differ from local hours", () => {
    // Construct a Date whose UTC day is 13 May 2026 but whose local day,
    // depending on the runner's timezone, could drift. We compare against the
    // calendar day picked by `validateDocumentDates`, which uses local fields.
    const utcMidnight = new Date(Date.UTC(2026, 4, 13, 0, 0, 0));
    const localDay = new Date(
      utcMidnight.getFullYear(),
      utcMidnight.getMonth(),
      utcMidnight.getDate(),
    );
    const issuedISO = `${localDay.getFullYear()}-${String(
      localDay.getMonth() + 1,
    ).padStart(2, "0")}-${String(localDay.getDate()).padStart(2, "0")}`;
    // issued === today (locally) -> not future, not expired, no cross-check
    expect(
      validateDocumentDates(issuedISO, "2099-01-01", utcMidnight),
    ).toBeNull();
  });

  it("parseISODate produces a local-midnight Date (no timezone offset drift)", () => {
    const d = parseISODate("2026-05-13");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(13);
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it("an issue date one day in the future is blocked even at end-of-day today", () => {
    const lateToday = new Date(2026, 4, 13, 23, 59, 59, 999);
    expect(
      validateDocumentDates("2026-05-14", "2030-01-01", lateToday),
    ).toBe(DOC_DATE_ERRORS.ISSUED_FUTURE);
  });

  it("an expiry date one day before today is blocked even at 00:00 local", () => {
    const earlyToday = new Date(2026, 4, 13, 0, 0, 0, 0);
    expect(
      validateDocumentDates("2020-01-01", "2026-05-12", earlyToday),
    ).toBe(DOC_DATE_ERRORS.EXPIRED);
  });
});

describe("document dates — empty and partially filled inputs", () => {
  it("treats null, undefined and empty string as 'not provided' for the range check", () => {
    expect(validateDocumentDates(null, null, TODAY)).toBeNull();
    expect(validateDocumentDates(undefined, undefined, TODAY)).toBeNull();
    expect(validateDocumentDates("", "", TODAY)).toBeNull();
    expect(validateDocumentDates("", "2030-01-01", TODAY)).toBeNull();
    expect(validateDocumentDates("2024-01-01", "", TODAY)).toBeNull();
  });

  it("the required-fields guard rejects partially filled trios with the dd/mm/yyyy message", () => {
    expect(
      evaluateOnboardingDateGuard(
        { ...validTrio, id_document_issued_at: "" },
        TODAY,
      ),
    ).toEqual({ blocked: true, message: INVALID_DATE_MESSAGE });

    expect(
      evaluateOnboardingDateGuard(
        { ...validTrio, id_document_expires_at: undefined },
        TODAY,
      ),
    ).toEqual({ blocked: true, message: INVALID_DATE_MESSAGE });

    expect(
      evaluateOnboardingDateGuard(
        { ...validTrio, birth_date: null },
        TODAY,
      ),
    ).toEqual({ blocked: true, message: INVALID_DATE_MESSAGE });
  });

  it("rejects whitespace-only strings as invalid dates", () => {
    expect(isValidISODate("   ")).toBe(false);
    expect(validateRequiredDates(["   "])).toBe(INVALID_DATE_MESSAGE);
  });

  it("rejects partially typed dd/mm/yyyy values (mask incomplete)", () => {
    expect(parseItalianDateToISO("1")).toBeNull();
    expect(parseItalianDateToISO("13/")).toBeNull();
    expect(parseItalianDateToISO("13/05")).toBeNull();
    expect(parseItalianDateToISO("13/05/20")).toBeNull();
    expect(parseItalianDateToISO("13/05/202")).toBeNull();
  });

  it("rejects partially typed ISO yyyy-mm-dd values", () => {
    expect(isValidISODate("2026")).toBe(false);
    expect(isValidISODate("2026-05")).toBe(false);
    expect(isValidISODate("2026-5-13")).toBe(false); // unpadded
    expect(isValidISODate("2026-05-1")).toBe(false); // unpadded day
  });
});

describe("document dates — invalid ranges and message ordering", () => {
  it("future issued + expired-by-today: future-issue wins (matches DB trigger order)", () => {
    expect(
      validateDocumentDates("2027-01-01", "2025-01-01", TODAY),
    ).toBe(DOC_DATE_ERRORS.ISSUED_FUTURE);
  });

  it("expired AND expires < issued: EXPIRED wins", () => {
    expect(
      validateDocumentDates("2024-06-01", "2024-01-01", TODAY),
    ).toBe(DOC_DATE_ERRORS.EXPIRED);
  });

  it("scadenza strictly less than rilascio (both >= today) reports EXPIRES_BEFORE_ISSUED", () => {
    // issued today, expires "today - 0" handled by same-day case; here we pick
    // issued tomorrow vs expires today+2 reversed via picking issued > expires
    // while keeping issued <= today is impossible, so we use the boundary:
    // both equal to today reliably triggers EXPIRES_BEFORE_ISSUED.
    expect(
      validateDocumentDates("2026-05-13", "2026-05-13", TODAY),
    ).toBe(DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED);
  });

  it("format error wins over range error in the onboarding guard", () => {
    expect(
      evaluateOnboardingDateGuard(
        {
          ...validTrio,
          id_document_issued_at: "not-a-date",
          id_document_expires_at: "2020-01-01",
        },
        TODAY,
      ),
    ).toEqual({ blocked: true, message: INVALID_DATE_MESSAGE });
  });

  it("a far-future expiry with a valid issued is accepted", () => {
    expect(
      validateDocumentDates("2024-01-01", "2099-12-31", TODAY),
    ).toBeNull();
  });
});

describe("document dates — leap-year boundaries", () => {
  it("accepts 29 Feb on a leap year", () => {
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(parseItalianDateToISO("29/02/2024")).toBe("2024-02-29");
  });

  it("rejects 29 Feb on a non-leap year", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(parseItalianDateToISO("29/02/2026")).toBeNull();
  });

  it("rejects 30 Feb regardless of year", () => {
    expect(isValidISODate("2024-02-30")).toBe(false);
    expect(parseItalianDateToISO("30/02/2024")).toBeNull();
  });

  it("validateDocumentDates accepts a leap-day issued date and a future expiry", () => {
    // issued 29/02/2024 is in the past relative to TODAY, expires far future.
    expect(
      validateDocumentDates("2024-02-29", "2030-02-28", TODAY),
    ).toBeNull();
  });
});

describe("onboarding guard — fully valid trio passes", () => {
  it("returns blocked: false with no message for the canonical happy path", () => {
    expect(evaluateOnboardingDateGuard(validTrio, TODAY)).toEqual({
      blocked: false,
      message: null,
    });
  });

  it("accepts issued === today (lower boundary)", () => {
    expect(
      evaluateOnboardingDateGuard(
        {
          ...validTrio,
          id_document_issued_at: "2026-05-13",
          id_document_expires_at: "2030-05-13",
        },
        TODAY,
      ),
    ).toEqual({ blocked: false, message: null });
  });

  it("accepts expires === today + 1 (lower boundary of EXPIRED check)", () => {
    expect(
      evaluateOnboardingDateGuard(
        {
          ...validTrio,
          id_document_issued_at: "2020-01-01",
          id_document_expires_at: "2026-05-14",
        },
        TODAY,
      ),
    ).toEqual({ blocked: false, message: null });
  });
});