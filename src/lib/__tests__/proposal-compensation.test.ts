import { describe, expect, it } from "vitest";
import { proposalCompensation } from "../proposal-compensation";

describe("compenso della proposta diretta", () => {
  it("annuncio 8, lavoratore 10: richiede accordo e propone 10", () => {
    expect(proposalCompensation(8, "hourly", 10)).toMatchObject({ higher: true, effective: 10, needsAgreement: true });
  });
  it("non abbassa il compenso di un annuncio a 12 per chi chiede 10", () => {
    expect(proposalCompensation(12, "hourly", 10)).toMatchObject({ higher: false, effective: 12, needsAgreement: false });
  });
  it("non richiede accordo per importi uguali", () => expect(proposalCompensation(10, "hourly", 10).needsAgreement).toBe(false));
  it("non confronta un compenso totale con una tariffa oraria", () => expect(proposalCompensation(8, "fixed", 10)).toMatchObject({ effective: 8, higher: false }));
  it("non inventa un compenso se il lavoratore non lo indica", () => expect(proposalCompensation(8, "hourly", null).effective).toBe(8));
  it("oltre 30 è un intervallo, non un accordo a 31 euro", () => expect(proposalCompensation(8, "hourly", 31)).toMatchObject({ needsExactRate: true, needsAgreement: false }));
  it("ignora importi non validi", () => expect(proposalCompensation("invalid", "hourly", 10).higher).toBe(false));
});