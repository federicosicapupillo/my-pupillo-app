import { describe, it, expect } from "vitest";
import { planNotificationEmail, absoluteLink, starLink, readEmailRating } from "../notification-email";

describe("planNotificationEmail", () => {
  it("messages get a read button", () => {
    expect(planNotificationEmail("Nuovo messaggio da Mario", "/messages/x")).toMatchObject({ category: "messages", cta: "Leggi il messaggio" });
  });
  it("review requests show clickable stars", () => {
    expect(planNotificationEmail("Turno completato — lascia una recensione", "/messages/x?action=review")?.stars).toBe(true);
    expect(planNotificationEmail("Lascia una recensione", "/shifts")?.stars).toBe(true);
  });
  it("confirmations and cancellations are sent", () => {
    expect(planNotificationEmail("Candidatura accettata — Cameriere", "/m")?.category).toBe("applications");
    expect(planNotificationEmail("Turno annullato", "/shifts")?.category).toBe("shifts");
  });
  it("non-important notifications are not emailed", () => {
    expect(planNotificationEmail("Candidatura scaduta", "/m")).toBeNull();
    expect(planNotificationEmail("Annuncio scaduto", "/a")).toBeNull();
    expect(planNotificationEmail("Turno creato", "/shifts")).toBeNull();
  });
});

describe("links", () => {
  it("only internal paths", () => {
    expect(absoluteLink("https://pupillo.life", "https://evil.com")).toBe("https://pupillo.life/notifications");
    expect(absoluteLink("https://pupillo.life/", "/messages/1")).toBe("https://pupillo.life/messages/1");
  });
  it("star links carry the rating", () => {
    expect(starLink("https://p.l/m/1?action=review", 4)).toBe("https://p.l/m/1?action=review&rating=4");
    expect(readEmailRating("?rating=4")).toBe(4);
    expect(readEmailRating("?rating=9")).toBeNull();
  });
});

import { describe as d2, it as i2, expect as e2 } from "vitest";
import { tomorrowInRome } from "../shift-reminder";
d2("promemoria turno del giorno dopo", () => {
  i2("usa il tasto «Vedi il turno»", () => {
    e2(planNotificationEmail("Promemoria: domani hai un turno", "/shifts?shift=1")?.cta).toBe("Vedi il turno");
  });
  i2("calcola domani in ora italiana", () => {
    e2(tomorrowInRome(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-15");
    e2(tomorrowInRome(new Date("2026-11-13T10:00:00Z"))).toBe("2026-11-14");
  });
});
