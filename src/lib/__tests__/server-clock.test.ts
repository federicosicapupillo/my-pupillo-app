import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { serverNow, setServerNow, resetServerClock, getClockOffsetMs, isClockSynced } from "../server-clock";
import { isAnnouncementExpired } from "../announcement-time";

const FUTURE = { service_date: "2026-08-04", service_time: "20:00:00" }; // 18:00Z

describe("server clock offset", () => {
  beforeEach(() => {
    resetServerClock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetServerClock();
  });

  it("senza sync usa l'orologio locale", () => {
    vi.setSystemTime(new Date("2026-08-04T10:00:00Z"));
    expect(isClockSynced()).toBe(false);
    expect(serverNow().toISOString()).toBe("2026-08-04T10:00:00.000Z");
  });

  it("corregge un dispositivo indietro di 3 giorni", () => {
    vi.setSystemTime(new Date("2026-08-01T10:00:00Z")); // orologio sbagliato
    setServerNow("2026-08-04T10:00:00.000Z");
    expect(getClockOffsetMs()).toBe(3 * 24 * 3600 * 1000);
    expect(serverNow().toISOString()).toBe("2026-08-04T10:00:00.000Z");
  });

  it("dispositivo con ora sbagliata: turno passato mostrato come scaduto", () => {
    // Il device crede sia il 3 agosto (turno del 4 ancora futuro),
    // ma il server dice 4 agosto 19:00Z -> turno gia' iniziato.
    vi.setSystemTime(new Date("2026-08-03T10:00:00Z"));
    expect(isAnnouncementExpired(FUTURE)).toBe(false);
    setServerNow("2026-08-04T19:00:00.000Z");
    expect(isAnnouncementExpired(FUTURE)).toBe(true);
  });

  it("dispositivo avanti nel tempo: turno futuro NON marcato scaduto", () => {
    vi.setSystemTime(new Date("2026-08-05T10:00:00Z"));
    expect(isAnnouncementExpired(FUTURE)).toBe(true); // errato senza sync
    setServerNow("2026-08-04T10:00:00.000Z");
    expect(isAnnouncementExpired(FUTURE)).toBe(false); // corretto dopo sync
  });

  it("compensa metà del round trip di rete", () => {
    vi.setSystemTime(new Date("2026-08-04T10:00:00Z"));
    setServerNow("2026-08-04T10:00:00.000Z", 400);
    expect(getClockOffsetMs()).toBe(200);
  });

  it("ignora un valore non valido", () => {
    vi.setSystemTime(new Date("2026-08-04T10:00:00Z"));
    setServerNow("not-a-date");
    expect(getClockOffsetMs()).toBe(0);
    expect(isClockSynced()).toBe(false);
  });
});
