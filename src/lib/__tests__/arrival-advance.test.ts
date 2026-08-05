import { describe, expect, it } from "vitest";
import {
  formatArrivalInstruction,
  resolveArrivalAdvanceMinutesOrNull,
} from "@/lib/shift-confirmation";

describe("anticipo di presentazione", () => {
  it("usa il valore canonico dell'annuncio", () => {
    expect(resolveArrivalAdvanceMinutesOrNull({ canonicalMinutes: 15 })).toBe(15);
    expect(resolveArrivalAdvanceMinutesOrNull({ canonicalMinutes: 45 })).toBe(45);
  });

  it("ricade sul testo dell'annuncio solo se il campo canonico è vuoto", () => {
    expect(
      resolveArrivalAdvanceMinutesOrNull({
        canonicalMinutes: null,
        announcementTexts: ["Presentarsi almeno 20 minuti prima del turno."],
      }),
    ).toBe(20);
  });

  it("non inventa mai un default", () => {
    expect(resolveArrivalAdvanceMinutesOrNull({ canonicalMinutes: null })).toBeNull();
    expect(formatArrivalInstruction(null)).not.toMatch(/10 minuti/);
  });

  it("formatta la frase con i minuti reali e la motivazione", () => {
    expect(formatArrivalInstruction(15)).toContain("15 minuti");
    expect(formatArrivalInstruction(30, "briefing")).toContain("Motivo: briefing");
    expect(formatArrivalInstruction(0)).toContain("puntuale");
  });
});
