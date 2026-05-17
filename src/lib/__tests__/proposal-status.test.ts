import { describe, it, expect } from "vitest";
import {
  computeProposalStatus,
  computeAssignButtonState,
  type ProposalState,
} from "../proposal-status";

const NOW = new Date("2026-05-17T12:00:00Z");
const PAST = new Date("2026-05-17T11:00:00Z").toISOString();
const FUTURE = new Date("2026-05-17T13:00:00Z").toISOString();

describe("computeProposalStatus — all five proposal states", () => {
  it("returns 'pending' when no response, no expiration, no cancellation", () => {
    expect(
      computeProposalStatus({
        applicationStatus: "pending",
        responseDeadline: FUTURE,
        now: NOW,
      }),
    ).toBe<ProposalState>("pending");
  });

  it("returns 'accepted' when the worker accepted this proposal", () => {
    expect(
      computeProposalStatus({
        response: { status: "accepted" },
        applicationStatus: "accepted",
        responseDeadline: PAST, // expiration is irrelevant once accepted
        now: NOW,
      }),
    ).toBe<ProposalState>("accepted");
  });

  it("returns 'rejected' when the worker rejected this proposal", () => {
    expect(
      computeProposalStatus({
        response: { status: "rejected" },
        applicationStatus: "pending",
        responseDeadline: FUTURE,
        now: NOW,
      }),
    ).toBe<ProposalState>("rejected");
  });

  it("returns 'expired' when the response deadline has passed", () => {
    expect(
      computeProposalStatus({
        applicationStatus: "pending",
        responseDeadline: PAST,
        now: NOW,
      }),
    ).toBe<ProposalState>("expired");
  });

  it("returns 'cancelled' when a newer proposal supersedes this one", () => {
    expect(
      computeProposalStatus({
        supersededByNewer: true,
        applicationStatus: "pending",
        responseDeadline: FUTURE,
        now: NOW,
      }),
    ).toBe<ProposalState>("cancelled");
  });

  it("returns 'cancelled' when the application itself was closed by either party", () => {
    expect(
      computeProposalStatus({
        applicationStatus: "rejected",
        responseDeadline: FUTURE,
        now: NOW,
      }),
    ).toBe<ProposalState>("cancelled");

    expect(
      computeProposalStatus({
        applicationStatus: "not_interested",
        responseDeadline: FUTURE,
        now: NOW,
      }),
    ).toBe<ProposalState>("cancelled");
  });

  it("treats a recorded acceptance as authoritative even past the deadline", () => {
    expect(
      computeProposalStatus({
        response: { status: "accepted" },
        responseDeadline: PAST,
        now: NOW,
      }),
    ).toBe<ProposalState>("accepted");
  });

  it("treats a recorded rejection as authoritative even if a newer proposal exists", () => {
    expect(
      computeProposalStatus({
        response: { status: "rejected" },
        supersededByNewer: true,
        now: NOW,
      }),
    ).toBe<ProposalState>("rejected");
  });
});

describe("computeAssignButtonState — coherence per chat & per proposal", () => {
  it("is disabled (no reason) for the worker side regardless of proposal state", () => {
    for (const s of ["pending", "accepted", "rejected", "expired", "cancelled"] as ProposalState[]) {
      expect(
        computeAssignButtonState({
          role: "worker",
          applicationStatus: "pending",
          latestProposalStatus: s,
        }),
      ).toEqual({ enabled: false, reason: null });
    }
  });

  it("is disabled when the chat has no proposal yet", () => {
    expect(
      computeAssignButtonState({
        role: "restaurant",
        applicationStatus: "pending",
        latestProposalStatus: null,
      }),
    ).toEqual({
      enabled: false,
      reason: "Invia una proposta di lavoro per poter assegnare il turno.",
    });
  });

  it("is disabled with the matching reason for each non-accepted proposal state", () => {
    const cases: Array<[ProposalState, string]> = [
      ["pending", "In attesa che il lavoratore accetti la proposta."],
      ["rejected", "Il lavoratore ha rifiutato la proposta."],
      ["expired", "La proposta è scaduta. Inviane una nuova per assegnare il turno."],
      ["cancelled", "La proposta è stata annullata. Inviane una nuova per assegnare il turno."],
    ];
    for (const [state, reason] of cases) {
      expect(
        computeAssignButtonState({
          role: "restaurant",
          applicationStatus: "pending",
          latestProposalStatus: state,
        }),
      ).toEqual({ enabled: false, reason });
    }
  });

  it("is enabled only when the latest proposal is 'accepted' and the restaurant is not blocked", () => {
    expect(
      computeAssignButtonState({
        role: "restaurant",
        applicationStatus: "pending",
        latestProposalStatus: "accepted",
        isBlocked: false,
      }),
    ).toEqual({ enabled: true, reason: null });
  });

  it("is disabled with the review-blocker reason when the restaurant has overdue reviews", () => {
    expect(
      computeAssignButtonState({
        role: "restaurant",
        applicationStatus: "pending",
        latestProposalStatus: "accepted",
        isBlocked: true,
      }),
    ).toEqual({
      enabled: false,
      reason: "Prima di assegnare nuovi turni devi chiudere e recensire i turni conclusi.",
    });
  });

  it("is disabled when the application is already assigned (accepted)", () => {
    expect(
      computeAssignButtonState({
        role: "restaurant",
        applicationStatus: "accepted",
        latestProposalStatus: "accepted",
      }),
    ).toEqual({ enabled: false, reason: "Il turno è già stato assegnato." });
  });

  it("is disabled when the application has been closed (rejected / not_interested)", () => {
    for (const closed of ["rejected", "not_interested"]) {
      expect(
        computeAssignButtonState({
          role: "restaurant",
          applicationStatus: closed,
          latestProposalStatus: "pending",
        }),
      ).toEqual({ enabled: false, reason: "La candidatura è già chiusa." });
    }
  });

  it("guarantees a single enabled path: only ('restaurant', 'accepted', !isBlocked, open app)", () => {
    const roles = ["restaurant", "worker"] as const;
    const appStatuses = ["pending", "interested", "counter_offer", "accepted", "rejected", "not_interested"];
    const proposalStates: Array<ProposalState | null> = [
      null,
      "pending",
      "accepted",
      "rejected",
      "expired",
      "cancelled",
    ];
    const blocked = [true, false];

    const enabledCombos: string[] = [];
    for (const role of roles)
      for (const appStatus of appStatuses)
        for (const latestProposalStatus of proposalStates)
          for (const isBlocked of blocked) {
            const r = computeAssignButtonState({ role, applicationStatus: appStatus, latestProposalStatus, isBlocked });
            if (r.enabled) {
              enabledCombos.push(`${role}|${appStatus}|${latestProposalStatus}|blk=${isBlocked}`);
            }
          }

    // Only "restaurant" + open app (pending/interested/counter_offer) + accepted proposal + !blocked enable the button.
    expect(enabledCombos.sort()).toEqual(
      [
        "restaurant|pending|accepted|blk=false",
        "restaurant|interested|accepted|blk=false",
        "restaurant|counter_offer|accepted|blk=false",
      ].sort(),
    );
  });
});