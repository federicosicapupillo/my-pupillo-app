/**
 * Focused regression coverage for the birth-date calendar validation.
 *
 * These cases mirror the exact list the product team asked us to guarantee
 * — leap-year handling, months without day 31, out-of-range day/month and
 * future dates must be rejected without JavaScript "normalizing" them to
 * the following month.
 */
import { describe, it, expect } from "vitest";
import {
  isValidCalendarDate,
  isValidISODate,
  parseISODate,
  parseItalianDateToISO,
  validateBirthDate,
  BIRTH_DATE_ERRORS,
} from "../document-dates";

const TODAY = new Date(2026, 6, 22); // 22/07/2026

const VALID = [
  "29/02/2008",
  "29/02/2000",
  "28/02/2009",
  "31/01/2009",
];

const INVALID = [
  "29/02/2009",
  "29/02/2010",
  "29/02/1900",
  "30/02/2008",
  "31/04/2008",
  "31/06/2008",
  "31/09/2008",
  "31/11/2008",
  "00/01/2000",
  "01/00/2000",
  "32/01/2000",
  "01/13/2000",
];

describe("isValidCalendarDate — accepts real days, rejects normalized ones", () => {
  for (const it_ of VALID) {
    it(`accepts ${it_}`, () => {
      expect(isValidCalendarDate(it_)).toBe(true);
      const iso = parseItalianDateToISO(it_);
      expect(iso).not.toBeNull();
      expect(isValidCalendarDate(iso!)).toBe(true);
      expect(isValidISODate(iso!)).toBe(true);
      expect(parseISODate(iso!)).not.toBeNull();
    });
  }

  for (const it_ of INVALID) {
    it(`rejects ${it_}`, () => {
      expect(isValidCalendarDate(it_)).toBe(false);
      expect(parseItalianDateToISO(it_)).toBeNull();
    });
  }

  it("rejects null / undefined / whitespace / malformed strings", () => {
    expect(isValidCalendarDate(null)).toBe(false);
    expect(isValidCalendarDate(undefined)).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
    expect(isValidCalendarDate("   ")).toBe(false);
    expect(isValidCalendarDate("2008-2-29")).toBe(false); // unpadded
    expect(isValidCalendarDate("2008/02/29")).toBe(false); // wrong separator for ISO
    expect(isValidCalendarDate("29-02-2008")).toBe(false); // wrong separator for IT
  });
});

describe("validateBirthDate — future dates are blocked with the Italian message", () => {
  it("rejects a future birth date", () => {
    expect(validateBirthDate("2030-01-01", TODAY)).toBe(
      BIRTH_DATE_ERRORS.FUTURE,
    );
  });

  it("accepts 29/02/2008 as a real leap-day birth date", () => {
    // Born 29/02/2008, today 22/07/2026 → 18 anni compiuti.
    expect(validateBirthDate("2008-02-29", TODAY)).toBeNull();
  });
});