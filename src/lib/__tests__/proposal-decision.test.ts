import { describe, it, expect, vi } from "vitest";
import {
  getProposalDecisionState,
  isProposalPending,
  resolveProposalEffectiveStatus,
  PROPOSAL_ACCEPT_LABEL,
  PROPOSAL_REJECT_LABEL,
  PROPOSAL_BUSY_LABEL,
} from "../proposal-decision";

const worker = { isWorker: true as const };

describe("azioni candidatura — coppia unica", () => {
  it("1. candidatura pendente → esattamente 2 pulsanti (una sola coppia)", () => {
    const s = getProposalDecisionState({ status: "pending", ...worker });
    expect(s.showActions).toBe(true);
    const buttons = s.showActions ? [s.acceptLabel, s.rejectLabel] : [];
    expect(buttons).toHaveLength(2);
    expect(buttons).toEqual([PROPOSAL_ACCEPT_LABEL, PROPOSAL_REJECT_LABEL]);
  });

  it("2. etichette richieste", () => {
    expect(PROPOSAL_ACCEPT_LABEL).toBe("Accetta candidatura");
    expect(PROPOSAL_REJECT_LABEL).toBe("Rifiuta candidatura");
  });

  it("3. click su Accetta → entrambi i pulsanti disabilitati durante la richiesta", () => {
    const s = getProposalDecisionState({ status: "pending", busy: "accept", ...worker });
    expect(s.acceptDisabled).toBe(true);
    expect(s.rejectDisabled).toBe(true);
    expect(s.acceptLabel).toBe(PROPOSAL_BUSY_LABEL);
  });

  it("5. click su Rifiuta → entrambi i pulsanti disabilitati durante la richiesta", () => {
    const s = getProposalDecisionState({ status: "pending", busy: "reject", ...worker });
    expect(s.acceptDisabled).toBe(true);
    expect(s.rejectDisabled).toBe(true);
    expect(s.rejectLabel).toBe(PROPOSAL_BUSY_LABEL);
  });

  it("4. accettazione riuscita → nessun pulsante attivo (anche dopo refresh, stato dal DB)", () => {
    const fromDb = resolveProposalEffectiveStatus({
      ownStatus: "accepted",
      hasAnyResponse: true,
      applicationStatus: "pending",
    });
    const s = getProposalDecisionState({ status: fromDb, ...worker });
    expect(s.showActions).toBe(false);
    expect(s.acceptDisabled).toBe(true);
    expect(s.rejectDisabled).toBe(true);
    expect(s.outcomeLabel).toBe("Candidatura accettata");
  });

  it("6. rifiuto riuscito → nessun pulsante attivo dopo refresh", () => {
    for (const st of ["rejected", "not_interested"]) {
      const fromDb = resolveProposalEffectiveStatus({ ownStatus: st, hasAnyResponse: true });
      const s = getProposalDecisionState({ status: fromDb, ...worker });
      expect(s.showActions).toBe(false);
      expect(s.outcomeLabel).toBe("Candidatura rifiutata");
    }
  });

  it("7. errore backend → pulsanti nuovamente utilizzabili (nessun stato ottimistico)", () => {
    const s = getProposalDecisionState({ status: "pending", busy: null, ...worker });
    expect(s.showActions).toBe(true);
    expect(s.acceptDisabled).toBe(false);
    expect(s.rejectDisabled).toBe(false);
  });

  it("8. doppio click → una sola chiamata (guardia busy/decided)", async () => {
    const rpc = vi.fn().mockResolvedValue(undefined);
    let busy: "accept" | null = null;
    let status = "pending";
    const click = async () => {
      const s = getProposalDecisionState({ status, busy, ...worker });
      if (s.acceptDisabled) return;
      busy = "accept";
      await rpc();
      status = "accepted";
      busy = null;
    };
    await Promise.all([click(), click()]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("9. due tab concorrenti → una sola transizione valida (vince lo stato DB)", () => {
    // Tab B ricarica dopo la risposta di Tab A: le azioni non sono più offerte.
    const tabB = getProposalDecisionState({
      status: resolveProposalEffectiveStatus({ ownStatus: "accepted", hasAnyResponse: true }),
      ...worker,
    });
    expect(tabB.showActions).toBe(false);
  });

  it("10. stato deciso non torna mai pendente (no doppia notifica/assegnazione)", () => {
    expect(isProposalPending("pending")).toBe(true);
    expect(isProposalPending("counter_offer")).toBe(true);
    for (const st of ["accepted", "rejected", "not_interested", "expired"]) {
      expect(isProposalPending(st)).toBe(false);
      expect(getProposalDecisionState({ status: st, ...worker }).decided).toBe(true);
    }
  });

  it("turno annullato/concluso o proposta scaduta → nessuna azione", () => {
    expect(getProposalDecisionState({ status: "pending", lockReason: "cancelled", ...worker }).showActions).toBe(false);
    expect(getProposalDecisionState({ status: "pending", lockReason: "completed", ...worker }).showActions).toBe(false);
    expect(getProposalDecisionState({ status: "pending", timeExpired: true, ...worker }).showActions).toBe(false);
  });

  it("disponibilità speciale incompatibile → solo Rifiuta attivo", () => {
    const s = getProposalDecisionState({ status: "pending", incompatibleSpecial: true, ...worker });
    expect(s.acceptDisabled).toBe(true);
    expect(s.rejectDisabled).toBe(false);
  });

  it("lato ristoratore non vengono mai renderizzate le azioni del lavoratore", () => {
    expect(getProposalDecisionState({ status: "pending", isWorker: false }).showActions).toBe(false);
  });
});
