import { describe, it, expect } from "vitest";

/**
 * Fonte canonica unica dell'evento "turno completato — lascia una recensione".
 * Il DB (trigger notify_shift_status) e i fallback frontend devono usare
 * ESATTAMENTE questi valori, con dedupe key = tipo + turno + destinatario.
 */
export const SHIFT_COMPLETED_NOTIFICATION = {
  notificationType: "shift_completed_review_requested",
  kind: "shift_completed_review",
  title: "Turno completato — lascia una recensione",
  body: "Il turno è stato completato. Hai 3 giorni per lasciare una recensione.",
} as const;

const dedupeKey = (shiftId: string, userId: string) =>
  `${SHIFT_COMPLETED_NOTIFICATION.kind}:${shiftId}:${userId}`;

describe("notifica canonica turno completato", () => {
  it("usa il copy canonico", () => {
    expect(SHIFT_COMPLETED_NOTIFICATION.title).toBe("Turno completato — lascia una recensione");
    expect(SHIFT_COMPLETED_NOTIFICATION.body).toBe(
      "Il turno è stato completato. Hai 3 giorni per lasciare una recensione.",
    );
  });

  it("la dedupe key dipende da tipo + turno + destinatario", () => {
    expect(dedupeKey("s1", "w1")).toBe("shift_completed_review:s1:w1");
    expect(dedupeKey("s1", "w1")).not.toBe(dedupeKey("s1", "w2"));
    expect(dedupeKey("s1", "w1")).not.toBe(dedupeKey("s2", "w1"));
  });

  it("retry / doppio click / due tab producono la stessa chiave (una sola notifica)", () => {
    const keys = new Set([
      dedupeKey("s1", "w1"),
      dedupeKey("s1", "w1"),
      dedupeKey("s1", "w1"),
    ]);
    expect(keys.size).toBe(1);
  });

  it("il testo legacy duplicato non è più una fonte valida", () => {
    expect(SHIFT_COMPLETED_NOTIFICATION.body).not.toContain("Raccontaci");
  });

  it("l'evento 'recensione ricevuta' resta distinto", () => {
    expect(SHIFT_COMPLETED_NOTIFICATION.notificationType).not.toBe("review_received");
  });
});
