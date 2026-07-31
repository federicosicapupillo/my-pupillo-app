/**
 * E2E logico "DJ / intrattenimento": percorre tutte le superfici che toccano
 * il ruolo (selezione lavoratore → salvataggio → filtro Trova offerte →
 * ricerca avanzata ristoratore → compatibilità → anteprima proposta) usando
 * gli stessi helper del codice di produzione, inclusi i valori legacy.
 */
import { describe, expect, it } from "vitest";
import { JOB_ROLES, isSameRole, roleIdOf, roleLabelOf } from "@/lib/job-roles";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { buildProposalPreview } from "@/lib/shift-proposal";

const CANONICAL = "DJ / intrattenimento";
const LEGACY = ["DJ", "dj", "DJ e intrattenimento", "dj_entertainment", "dj_intrattenimento", "Intrattenimento", "deejay"];

describe("E2E ruolo DJ / intrattenimento", () => {
  it("è selezionabile dal lavoratore (onboarding / profilo)", () => {
    expect(WORKER_ROLES).toContain(CANONICAL);
  });

  it("è pubblicabile in annuncio e filtrabile in Trova offerte", () => {
    expect(JOB_ROLES).toContain(CANONICAL);
  });

  it("il valore salvato è quello canonico", () => {
    expect(roleLabelOf(CANONICAL)).toBe(CANONICAL);
    expect(roleIdOf(CANONICAL)).toBe("dj_intrattenimento");
  });

  it("la ricerca avanzata ristoratore trova il lavoratore anche con valori legacy", () => {
    // filtro ristoratore = CANONICAL, ruolo salvato sul profilo = legacy
    for (const stored of LEGACY) {
      expect(isSameRole(CANONICAL, stored), `filtro non trova il profilo salvato come "${stored}"`).toBe(true);
    }
  });

  it("un annuncio salvato con valore legacy compare filtrando per il ruolo canonico", () => {
    for (const stored of LEGACY) {
      expect(isSameRole(stored, CANONICAL)).toBe(true);
    }
  });

  it("il ruolo mostrato è sempre quello canonico, da qualunque variante", () => {
    for (const stored of [...LEGACY, CANONICAL]) {
      expect(roleLabelOf(stored)).toBe(CANONICAL);
    }
  });

  it("l'anteprima della proposta di turno usa l'etichetta canonica", () => {
    expect(
      buildProposalPreview({
        id: "a1",
        professional_profile: "dj",
        service_date: "2026-06-12",
        service_time: "21:00:00",
        end_time: "02:00:00",
        location_address: null,
      } as never),
    ).toContain(CANONICAL);
  });

  it("non viene confuso con altri ruoli eventi", () => {
    expect(isSameRole(CANONICAL, "Animatore eventi")).toBe(false);
    expect(isSameRole(CANONICAL, "Sicurezza / controllo accessi")).toBe(false);
  });
});