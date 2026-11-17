import { describe, it, expect } from "vitest";
import { rateThreshold, rateGuidance, rateForSave, formatEuroRate } from "../hourly-rate-guidance";

describe("rateThreshold", () => {
  it.each([
    ["meno_di_1", 13], ["prima_esperienza", 13], ["0", 13], ["2", 13], ["3", 13.25],
    ["6", 14], ["8", 14.5], ["10", 15], ["oltre_10", 15], ["6_10", 14.5],
  ])("%s anni => %s", (y, t) => expect(rateThreshold(y)).toBe(t));
  it("nessuna selezione => null", () => expect(rateThreshold("")).toBeNull());
});

describe("rateGuidance", () => {
  it("13 €/h con 2 anni rientra", () => expect(rateGuidance("2", "13")?.status).toBe("within"));
  it("14 €/h con 2 anni supera", () => expect(rateGuidance("2", "14")?.status).toBe("above"));
  it("14 €/h con 6 anni rientra (soglia 14)", () => expect(rateGuidance("6", "14")?.status).toBe("within"));
  it("15 €/h con oltre_10 rientra", () => expect(rateGuidance("oltre_10", "15")?.status).toBe("within"));
  it("15 €/h con legacy 6_10 supera", () => expect(rateGuidance("6_10", "15")?.status).toBe("above"));
  it("oltre 30 (31) supera sempre", () => expect(rateGuidance("oltre_10", "oltre_30")?.status).toBe("above"));
  it("31 numerico supera", () => expect(rateGuidance("10", "31")?.status).toBe("above"));
  it("nessuna tariffa => nessun avviso", () => expect(rateGuidance("3", "")).toBeNull());
  it("nessun anno => nessun avviso", () => expect(rateGuidance("", "13")).toBeNull());
});

describe("rateForSave", () => {
  it("anni null azzera la tariffa", () => expect(rateForSave("", "15")).toBeNull());
  it("oltre_30 salvato come 31", () => expect(rateForSave("3", "oltre_30")).toBe(31));
  it("tariffa conservata con anni", () => expect(rateForSave("6_10", "14")).toBe(14));
});

it("formato italiano", () => {
  expect(formatEuroRate(14.5)).toBe("14,50");
  expect(formatEuroRate(13.25)).toBe("13,25");
  expect(formatEuroRate(15)).toBe("15");
});
