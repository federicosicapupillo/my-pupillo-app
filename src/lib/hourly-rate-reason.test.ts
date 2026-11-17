import { describe, it, expect } from "vitest";
import { rateReasonRequired, rateReasonError, rateReasonForSave } from "./hourly-rate-guidance";

describe("motivazione compenso fuori range", () => {
  it("obbligatoria se fuori range (1 anno, 15 €/h)", () => {
    expect(rateReasonRequired("1", "15")).toBe(true);
    expect(rateReasonError("1", "15", "")).not.toBeNull();
  });
  it("non richiesta se in linea (1 anno, 12 €/h)", () => {
    expect(rateReasonRequired("1", "12")).toBe(false);
    expect(rateReasonError("1", "12", "")).toBeNull();
  });
  it("accetta una motivazione di almeno 10 caratteri", () => {
    expect(rateReasonError("1", "15", "Sommelier certificato")).toBeNull();
    expect(rateReasonError("1", "15", "corta")).not.toBeNull();
  });
  it("cancella la motivazione se il compenso torna in linea", () => {
    expect(rateReasonForSave("1", "12", "vecchia motivazione")).toBeNull();
    expect(rateReasonForSave("1", "15", "  Sommelier certificato ")).toBe("Sommelier certificato");
  });
});
