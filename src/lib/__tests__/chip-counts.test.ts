import { describe, it, expect } from "vitest";
import {
  searchScopeThreads,
  computeChipCounts,
  type SearchableThread,
} from "@/lib/message-grouping";

const t = (over: Partial<SearchableThread>): SearchableThread => ({
  status: "pending",
  lastAt: "2026-05-01T10:00:00Z",
  createdAt: "2026-05-01T09:00:00Z",
  ann: { date: "2026-05-10", time: "19:00", role: "Cameriere" },
  other: { id: "u1", name: "Mario Rossi" },
  lastBody: "ciao",
  unread: 0,
  ...over,
});

const NOW = new Date("2026-05-15T12:00:00Z");

describe("computeChipCounts", () => {
  it("conta total, unread e stati effettivi", () => {
    const threads = [
      t({ status: "pending", unread: 2 }),
      t({ status: "pending", unread: 0 }),
      t({ status: "rejected", unread: 1 }),
      t({ status: "accepted", ann: { date: "2026-05-10", time: "19:00" } }), // passato -> completed
      t({ status: "accepted", ann: { date: "2026-06-10", time: "19:00" } }), // futuro -> accepted
    ];
    const c = computeChipCounts(threads, NOW);
    expect(c.total).toBe(5);
    expect(c.unread).toBe(2); // due thread con unread>0
    expect(c.byStatus).toEqual({
      pending: 2,
      rejected: 1,
      completed: 1,
      accepted: 1,
    });
  });

  it("ricalcola unread quando un thread viene segnato come letto", () => {
    const threads = [
      t({ id: "a", unread: 3 } as any),
      t({ id: "b", unread: 1 } as any),
    ];
    expect(computeChipCounts(threads, NOW).unread).toBe(2);
    const afterRead = threads.map((x, i) => (i === 0 ? { ...x, unread: 0 } : x));
    expect(computeChipCounts(afterRead, NOW).unread).toBe(1);
  });

  it("unread conta i thread, non i singoli messaggi non letti", () => {
    const threads = [t({ unread: 10 }), t({ unread: 0 })];
    expect(computeChipCounts(threads, NOW).unread).toBe(1);
  });

  it("byStatus è vuoto per scope vuoto", () => {
    expect(computeChipCounts([], NOW)).toEqual({ total: 0, unread: 0, byStatus: {} });
  });
});

describe("searchScopeThreads + computeChipCounts", () => {
  const threads: SearchableThread[] = [
    t({ other: { id: "u1", name: "Mario Rossi" }, status: "pending", unread: 1 }),
    t({ other: { id: "u2", name: "Luca Bianchi" }, status: "rejected", unread: 0, lastBody: "no grazie" }),
    t({ other: { id: "u2", name: "Luca Bianchi" }, status: "pending", unread: 2, ann: { date: "2026-07-20", time: "20:30", role: "Pizzaiolo" } }),
  ];

  it("filtro vuoto -> tutti i thread contati", () => {
    const scoped = searchScopeThreads(threads, "", "");
    const c = computeChipCounts(scoped, NOW);
    expect(c.total).toBe(3);
    expect(c.unread).toBe(2);
    expect(c.byStatus.pending).toBe(2);
    expect(c.byStatus.rejected).toBe(1);
  });

  it("query testuale riduce total/unread/byStatus coerentemente", () => {
    const scoped = searchScopeThreads(threads, "luca", "");
    const c = computeChipCounts(scoped, NOW);
    expect(c.total).toBe(2);
    expect(c.unread).toBe(1);
    expect(c.byStatus.pending).toBe(1);
    expect(c.byStatus.rejected).toBe(1);
  });

  it("query matcha ruolo dell'annuncio", () => {
    const scoped = searchScopeThreads(threads, "pizzaiolo", "");
    const c = computeChipCounts(scoped, NOW);
    expect(c.total).toBe(1);
    expect(c.unread).toBe(1);
    expect(c.byStatus).toEqual({ pending: 1 });
  });

  it("query matcha contenuto dell'ultimo messaggio", () => {
    const scoped = searchScopeThreads(threads, "grazie", "");
    expect(scoped.map((x) => x.other.name)).toEqual(["Luca Bianchi"]);
    expect(computeChipCounts(scoped, NOW).total).toBe(1);
  });

  it("filtro per utente focalizzato (?with=) restringe lo scope", () => {
    const scoped = searchScopeThreads(threads, "", "u2");
    const c = computeChipCounts(scoped, NOW);
    expect(c.total).toBe(2);
    expect(c.unread).toBe(1);
  });

  it("query senza match -> tutti i conteggi a zero", () => {
    const scoped = searchScopeThreads(threads, "nessuno xyz", "");
    const c = computeChipCounts(scoped, NOW);
    expect(c).toEqual({ total: 0, unread: 0, byStatus: {} });
  });

  it("la query è case-insensitive e ignora spazi ai bordi", () => {
    const scoped = searchScopeThreads(threads, "   MARIO  ", "");
    expect(scoped).toHaveLength(1);
    expect(scoped[0].other.name).toBe("Mario Rossi");
  });
});