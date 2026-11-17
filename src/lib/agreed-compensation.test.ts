import { describe, it, expect } from "vitest";
import { applicationIdFromLink, formatAgreedCompensation } from "./notification-email";
import { buildConfirmationBody } from "./shift-confirmation";

describe("compenso pattuito", () => {
  it("usa il compenso concordato (10) al posto dell'annuncio (8)", () => {
    expect(formatAgreedCompensation(10, 8, "hourly")).toBe("Compenso pattuito: 10 €/h netti");
  });
  it("senza accordo usa il compenso dell'annuncio", () => {
    expect(formatAgreedCompensation(null, 10, "hourly")).toBe("Compenso pattuito: 10 €/h netti");
  });
  it("legge l'id candidatura dal link della chat", () => {
    expect(applicationIdFromLink("/messages/123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(applicationIdFromLink("/shifts")).toBeNull();
  });
  it("il riepilogo turno in chat indica il compenso pattuito", () => {
    const body = buildConfirmationBody({ tariff_amount: 10, tariff_type: "hourly", service_date: "2099-06-12", service_time: "19:00" }, "Trattoria", null);
    expect(body).toContain("Compenso pattuito:");
    expect(body).toContain("10");
  });
});
