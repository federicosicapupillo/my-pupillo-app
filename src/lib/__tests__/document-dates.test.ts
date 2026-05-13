import { describe, it, expect } from "vitest";
import {
  DOC_DATE_ERRORS,
  INVALID_DATE_MESSAGE,
  formatItalianDate,
  parseISODate,
  parseItalianDateToISO,
  isValidISODate,
  validateRequiredDates,
  validateDocumentDates,
} from "../document-dates";

const TODAY = new Date(2026, 4, 13); // 13/05/2026 — fixed reference for tests

describe("dd/mm/yyyy formatting", () => {
  it("formats an ISO date to Italian dd/mm/yyyy", () => {
    expect(formatItalianDate("2026-05-13")).toBe("13/05/2026");
    expect(formatItalianDate("2024-01-09")).toBe("09/01/2024");
  });

  it("formats a Date instance to Italian dd/mm/yyyy", () => {
    expect(formatItalianDate(new Date(2030, 11, 1))).toBe("01/12/2030");
  });

  it("returns empty string for nullish or invalid values", () => {
    expect(formatItalianDate(null)).toBe("");
    expect(formatItalianDate(undefined)).toBe("");
    expect(formatItalianDate("not-a-date")).toBe("");
    expect(formatItalianDate("2026-13-40")).toBe("");
  });

  it("round-trips dd/mm/yyyy ↔ ISO", () => {
    const iso = parseItalianDateToISO("13/05/2026");
    expect(iso).toBe("2026-05-13");
    expect(formatItalianDate(iso)).toBe("13/05/2026");
  });

  it("rejects malformed Italian dates", () => {
    expect(parseItalianDateToISO("31/02/2026")).toBeNull();
    expect(parseItalianDateToISO("2026/05/13")).toBeNull();
    expect(parseItalianDateToISO("13-05-2026")).toBeNull();
    expect(parseItalianDateToISO("")).toBeNull();
  });

  it("parseISODate validates calendar correctness", () => {
    expect(parseISODate("2026-02-29")).toBeNull(); // not a leap year
    expect(parseISODate("2024-02-29")).not.toBeNull(); // leap year
  });
});

describe("isValidISODate / validateRequiredDates", () => {
  it("isValidISODate accepts only real dd/mm/yyyy ↔ ISO values", () => {
    expect(isValidISODate("2026-05-13")).toBe(true);
    expect(isValidISODate("2024-02-29")).toBe(true); // leap day
    expect(isValidISODate("2026-02-29")).toBe(false); // invalid leap day
    expect(isValidISODate("2026-13-01")).toBe(false); // bad month
    expect(isValidISODate("2026-05-32")).toBe(false); // bad day
    expect(isValidISODate("13/05/2026")).toBe(false); // wrong format
    expect(isValidISODate("not-a-date")).toBe(false);
    expect(isValidISODate("")).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(undefined)).toBe(false);
  });

  it("validateRequiredDates returns the dd/mm/yyyy message on any invalid value", () => {
    expect(
      validateRequiredDates(["2026-05-13", "2024-02-29", "2030-01-01"]),
    ).toBeNull();
    expect(validateRequiredDates(["2026-05-13", "", "2030-01-01"])).toBe(
      INVALID_DATE_MESSAGE,
    );
    expect(validateRequiredDates(["13-05-2026"])).toBe(INVALID_DATE_MESSAGE);
    expect(validateRequiredDates(["2026-02-30"])).toBe(INVALID_DATE_MESSAGE);
    expect(INVALID_DATE_MESSAGE).toBe(
      "Inserisci una data valida nel formato gg/mm/aaaa.",
    );
  });
});

describe("validateDocumentDates — error messages match the DB trigger", () => {
  it("returns null when both dates are valid", () => {
    expect(
      validateDocumentDates("2024-01-01", "2030-01-01", TODAY),
    ).toBeNull();
  });

  it("returns null when only one of the two dates is set", () => {
    expect(validateDocumentDates(null, null, TODAY)).toBeNull();
    expect(validateDocumentDates("2024-01-01", null, TODAY)).toBeNull();
    expect(validateDocumentDates(null, "2030-01-01", TODAY)).toBeNull();
  });

  it("blocks a future issue date", () => {
    expect(validateDocumentDates("2027-01-01", "2030-01-01", TODAY)).toBe(
      DOC_DATE_ERRORS.ISSUED_FUTURE,
    );
    expect(DOC_DATE_ERRORS.ISSUED_FUTURE).toBe(
      "La data di rilascio non può essere futura.",
    );
  });

  it("allows an issue date equal to today", () => {
    expect(validateDocumentDates("2026-05-13", "2030-01-01", TODAY)).toBeNull();
  });

  it("blocks an expired document", () => {
    expect(validateDocumentDates("2020-01-01", "2025-01-01", TODAY)).toBe(
      DOC_DATE_ERRORS.EXPIRED,
    );
    expect(DOC_DATE_ERRORS.EXPIRED).toBe(
      "Il documento risulta scaduto.",
    );
  });

  it("blocks an expiry date earlier than or equal to the issue date", () => {
    // Both dates set to TODAY isolate the cross-check: issue is not in the
    // future and the document is not expired, so only the
    // expires <= issued rule can fire (matches the DB trigger ordering).
    expect(validateDocumentDates("2026-05-13", "2026-05-13", TODAY)).toBe(
      DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED,
    );
    expect(DOC_DATE_ERRORS.EXPIRES_BEFORE_ISSUED).toBe(
      "La data di scadenza deve essere successiva alla data di rilascio.",
    );
  });

  it("prioritizes the future-issue check over the cross-check", () => {
    // issued in the future AND expires <= issued: future-issue wins
    expect(validateDocumentDates("2028-06-01", "2027-01-01", TODAY)).toBe(
      DOC_DATE_ERRORS.ISSUED_FUTURE,
    );
  });

  it("prioritizes the expired check over the cross-check", () => {
    expect(validateDocumentDates("2024-01-01", "2023-01-01", TODAY)).toBe(
      DOC_DATE_ERRORS.EXPIRED,
    );
  });
});