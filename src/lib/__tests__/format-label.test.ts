import { describe, it, expect } from "vitest";
import { formatDisplayLabel, formatDisplayLabels } from "@/lib/format-label";
import { labelOf, labelsOf, LICENSE_OPTIONS } from "@/lib/announcement-requirements";

describe("formatDisplayLabel", () => {
  it("mappa i valori ufficiali", () => {
    expect(formatDisplayLabel("uso_palmare")).not.toContain("_");
    expect(formatDisplayLabel("grembiule_nero")).toBe("Grembiule nero");
  });
  it("non lascia mai underscore nel fallback", () => {
    expect(formatDisplayLabel("valore_tecnico_sconosciuto")).toBe("Valore tecnico sconosciuto");
  });
  it("preserva testi già leggibili", () => {
    expect(formatDisplayLabel("Cameriere di sala")).toBe("Cameriere di sala");
  });
  it("gestisce vuoti", () => {
    expect(formatDisplayLabel(null)).toBe("");
    expect(formatDisplayLabel(undefined)).toBe("");
    expect(formatDisplayLabel("  ")).toBe("");
  });
  it("formatta le patenti", () => {
    expect(formatDisplayLabel("patente_b")).toBe("Patente B");
  });
  it("formatta liste", () => {
    expect(formatDisplayLabels(["grembiule_nero", "", "scarpe_nere"]).every(l => !l.includes("_"))).toBe(true);
  });
});

describe("labelOf / labelsOf", () => {
  it("usa il formatter come fallback invece del valore grezzo", () => {
    expect(labelOf("valore_non_in_lista", LICENSE_OPTIONS)).toBe("Valore non in lista");
    expect(labelsOf(["altro_valore_x"], LICENSE_OPTIONS)[0]).not.toContain("_");
  });
  it("restituisce — per valori assenti", () => {
    expect(labelOf(null, LICENSE_OPTIONS)).toBe("—");
    expect(labelsOf([], LICENSE_OPTIONS)).toEqual([]);
  });
});
