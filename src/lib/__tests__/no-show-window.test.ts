import { describe, it, expect } from "vitest";
import { getNoShowWindow, NO_SHOW_EXPIRED_MESSAGE, computeShiftStart } from "../no-show-window";

const DATE = "2026-07-15"; // CEST (UTC+2) → 20:00 Rome = 18:00Z
const at = (iso: string) => new Date(iso);
const win = (now: string, status = "scheduled") =>
  getNoShowWindow({ status, shiftDate: DATE, serviceTime: "20:00:00", now: at(now) });

describe("finestra no-show ristoratore (inizio + 15 min → inizio + 30 min)", () => {
  it("calcola l'inizio nel fuso Europe/Rome", () => {
    expect(computeShiftStart(DATE, "20:00:00")?.toISOString()).toBe("2026-07-15T18:00:00.000Z");
  });

  it("turno non ancora iniziato: no-show non disponibile, annullamento sì", () => {
    const w = win("2026-07-15T17:30:00Z");
    expect(w.phase).toBe("before_start");
    expect(w.canMarkNoShow).toBe(false);
    expect(w.canRestaurantCancel).toBe(true);
  });

  it("19:59:59 (prima dell'inizio): rifiutato", () => {
    expect(win("2026-07-15T17:59:59Z").canMarkNoShow).toBe(false);
  });

  it("20:00:00 (inizio esatto): rifiutato, attesa 15 minuti", () => {
    const w = win("2026-07-15T18:00:00Z");
    expect(w.phase).toBe("waiting");
    expect(w.canMarkNoShow).toBe(false);
    expect(w.message).toBe("Potrai segnalare il No-show tra 15 minuti.");
    expect(w.availableFrom?.toISOString()).toBe("2026-07-15T18:15:00.000Z");
  });

  it("20:14:59: ancora rifiutato", () => {
    expect(win("2026-07-15T18:14:59Z").canMarkNoShow).toBe(false);
  });

  it("20:15:00: consentito", () => {
    const w = win("2026-07-15T18:15:00Z");
    expect(w.phase).toBe("in_window");
    expect(w.canMarkNoShow).toBe(true);
  });

  it("20:15:01: consentito", () => {
    expect(win("2026-07-15T18:15:01Z").canMarkNoShow).toBe(true);
  });

  it("29 minuti dopo l'inizio: ancora disponibile", () => {
    expect(win("2026-07-15T18:29:00Z").canMarkNoShow).toBe(true);
  });

  it("esattamente 30 minuti dopo: ancora disponibile (termine incluso)", () => {
    expect(win("2026-07-15T18:30:00Z").canMarkNoShow).toBe(true);
  });

  it("oltre 30 minuti: scaduto, niente no-show né annullamento", () => {
    const w = win("2026-07-15T18:30:01Z");
    expect(w.phase).toBe("expired");
    expect(w.canMarkNoShow).toBe(false);
    expect(w.canRestaurantCancel).toBe(false);
    expect(w.message).toBe(NO_SHOW_EXPIRED_MESSAGE);
  });

  it("ora solare (CET, UTC+1): finestra spostata correttamente", () => {
    const w = getNoShowWindow({
      status: "scheduled",
      shiftDate: "2026-01-15",
      serviceTime: "20:00:00",
      now: new Date("2026-01-15T19:14:59Z"),
    });
    expect(w.canMarkNoShow).toBe(false);
    expect(w.availableFrom?.toISOString()).toBe("2026-01-15T19:15:00.000Z");
  });

  it("nessun impatto su turni conclusi, annullati o già no-show", () => {
    for (const st of ["completed", "cancelled", "no_show"]) {
      const w = win("2026-07-15T18:10:00Z", st);
      expect(w.phase).toBe("not_applicable");
      expect(w.canMarkNoShow).toBe(false);
    }
  });
});
