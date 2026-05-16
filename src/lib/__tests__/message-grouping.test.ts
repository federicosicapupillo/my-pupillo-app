import { describe, it, expect } from "vitest";
import {
  statusRank,
  computePrimaryStatus,
  effectiveStatus,
  recencyKey,
  type ThreadLike,
} from "@/lib/message-grouping";

const t = (overrides: Partial<ThreadLike> & { status: string }): ThreadLike => ({
  lastAt: null,
  createdAt: null,
  ann: null,
  ...overrides,
});

describe("statusRank", () => {
  it("ordina pending > counter_offer > interested > accepted > rejected > expired", () => {
    expect(statusRank("pending")).toBeGreaterThan(statusRank("counter_offer"));
    expect(statusRank("counter_offer")).toBeGreaterThan(statusRank("interested"));
    expect(statusRank("interested")).toBeGreaterThan(statusRank("accepted"));
    expect(statusRank("accepted")).toBeGreaterThan(statusRank("rejected"));
    expect(statusRank("rejected")).toBeGreaterThan(statusRank("expired"));
  });

  it("ritorna 0 per stati sconosciuti", () => {
    expect(statusRank("unknown")).toBe(0);
  });
});

describe("recencyKey", () => {
  it("preferisce lastAt quando presente", () => {
    expect(
      recencyKey(t({ status: "pending", lastAt: "2026-05-10T10:00:00Z", createdAt: "2026-01-01T00:00:00Z" })),
    ).toBe("2026-05-10T10:00:00Z");
  });

  it("ripiega su createdAt se lastAt manca", () => {
    expect(recencyKey(t({ status: "pending", createdAt: "2026-01-01T00:00:00Z" }))).toBe(
      "2026-01-01T00:00:00Z",
    );
  });

  it("ripiega su data+ora del turno se sia lastAt sia createdAt mancano", () => {
    expect(
      recencyKey(t({ status: "pending", ann: { date: "2026-05-18", time: "19:30" } })),
    ).toBe("2026-05-18T19:30");
  });

  it("usa 00:00 quando l'orario del turno manca", () => {
    expect(recencyKey(t({ status: "pending", ann: { date: "2026-05-18", time: null } }))).toBe(
      "2026-05-18T00:00",
    );
  });

  it("ritorna stringa vuota se nessuna chiave è disponibile", () => {
    expect(recencyKey(t({ status: "pending" }))).toBe("");
  });
});

describe("computePrimaryStatus", () => {
  it("vince la priorità più alta tra stati misti", () => {
    const threads = [
      t({ status: "accepted", lastAt: "2026-05-12T09:00:00Z" }),
      t({ status: "rejected", lastAt: "2026-05-13T09:00:00Z" }),
      t({ status: "pending", lastAt: "2026-05-10T09:00:00Z" }),
      t({ status: "expired", lastAt: "2026-05-14T09:00:00Z" }),
    ];
    // pending ha priorità massima anche se la sua data è la più vecchia
    expect(computePrimaryStatus(threads)).toBe("pending");
  });

  it("a parità di priorità vince la proposta più recente (lastAt)", () => {
    const threads = [
      t({ status: "pending", lastAt: "2026-05-10T09:00:00Z" }),
      t({ status: "pending", lastAt: "2026-05-15T09:00:00Z" }),
      t({ status: "pending", lastAt: "2026-05-12T09:00:00Z" }),
    ];
    expect(computePrimaryStatus(threads)).toBe("pending");
  });

  it("counter_offer batte interested e accepted", () => {
    const threads = [
      t({ status: "interested", lastAt: "2026-05-15T09:00:00Z" }),
      t({ status: "counter_offer", lastAt: "2026-05-10T09:00:00Z" }),
      t({ status: "accepted", lastAt: "2026-05-20T09:00:00Z" }),
    ];
    expect(computePrimaryStatus(threads)).toBe("counter_offer");
  });

  it("usa il fallback createdAt nel tie-break se lastAt è assente", () => {
    const threads = [
      t({ status: "accepted", createdAt: "2026-05-01T00:00:00Z" }),
      t({ status: "accepted", createdAt: "2026-05-09T00:00:00Z" }),
    ];
    // entrambi accepted: vince il createdAt più recente
    expect(computePrimaryStatus(threads)).toBe("accepted");
  });

  it("solo stati negativi: vince rejected su expired", () => {
    const threads = [
      t({ status: "expired", lastAt: "2026-05-15T09:00:00Z" }),
      t({ status: "rejected", lastAt: "2026-05-10T09:00:00Z" }),
    ];
    expect(computePrimaryStatus(threads)).toBe("rejected");
  });

  it("ritorna undefined per lista vuota", () => {
    expect(computePrimaryStatus([])).toBeUndefined();
  });
});

describe("effectiveStatus", () => {
  const now = new Date("2026-05-16T12:00:00Z");

  it("accepted con turno futuro resta accepted", () => {
    expect(
      effectiveStatus(
        t({ status: "accepted", ann: { date: "2026-05-20", time: "19:00" } }),
        now,
      ),
    ).toBe("accepted");
  });

  it("accepted con turno passato diventa completed", () => {
    expect(
      effectiveStatus(
        t({ status: "accepted", ann: { date: "2026-05-10", time: "19:00" } }),
        now,
      ),
    ).toBe("completed");
  });

  it("accepted con turno oggi resta accepted", () => {
    expect(
      effectiveStatus(
        t({ status: "accepted", ann: { date: "2026-05-16", time: "19:00" } }),
        now,
      ),
    ).toBe("accepted");
  });

  it("pending non viene mai derivato in completed", () => {
    expect(
      effectiveStatus(
        t({ status: "pending", ann: { date: "2026-05-10", time: "19:00" } }),
        now,
      ),
    ).toBe("pending");
  });

  it("accepted senza data turno resta accepted", () => {
    expect(effectiveStatus(t({ status: "accepted", ann: null }), now)).toBe("accepted");
  });
});