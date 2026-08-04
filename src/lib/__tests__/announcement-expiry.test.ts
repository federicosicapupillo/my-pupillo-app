/**
 * Regressione BUG: "annunci scaduti ancora candidabili / offerte scadute accettabili".
 *
 * Regola unica: un annuncio è scaduto quando `now >= service_date + service_time`
 * interpretati come wall time nel fuso Europa/Rome (colonna generata
 * `announcements.shift_start_at` lato DB, `getShiftStartDate` lato UI).
 */
import { describe, it, expect } from "vitest";
import { getShiftStartDate, isAnnouncementExpired } from "@/lib/announcement-time";

/** Istante UTC a partire da un wall time Europe/Rome (helper indipendente dalla lib sotto test). */
const romeInstant = (date: string, time: string, offsetHours: number) =>
  new Date(`${date}T${time}:00${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`);

const ann = (service_date: string, service_time: string | null) => ({ service_date, service_time });

describe("scadenza annuncio — scenari di regressione", () => {
  it("turno di ieri → scaduto", () => {
    const now = romeInstant("2026-08-04", "11:00", 2);
    expect(isAnnouncementExpired(ann("2026-08-03", "19:00"), now)).toBe(true);
  });

  it("turno di oggi già iniziato → scaduto", () => {
    const now = romeInstant("2026-08-04", "11:00", 2);
    expect(isAnnouncementExpired(ann("2026-08-04", "10:59"), now)).toBe(true);
  });

  it("turno di oggi non ancora iniziato → NON scaduto", () => {
    const now = romeInstant("2026-08-04", "11:00", 2);
    expect(isAnnouncementExpired(ann("2026-08-04", "11:01"), now)).toBe(false);
    expect(isAnnouncementExpired(ann("2026-08-04", "23:30"), now)).toBe(false);
  });

  it("turno futuro → NON scaduto", () => {
    const now = romeInstant("2026-08-04", "11:00", 2);
    expect(isAnnouncementExpired(ann("2026-09-01", "18:00"), now)).toBe(false);
  });

  it("istante esatto di inizio → scaduto (>= inizio)", () => {
    const now = romeInstant("2026-08-04", "19:00", 2);
    expect(isAnnouncementExpired(ann("2026-08-04", "19:00"), now)).toBe(true);
  });

  it("pagina aperta prima dell'inizio, accettazione tentata dopo l'inizio", () => {
    const a = ann("2026-08-04", "19:00");
    const atRender = romeInstant("2026-08-04", "18:55", 2);
    const atClick = romeInstant("2026-08-04", "19:05", 2);
    expect(isAnnouncementExpired(a, atRender)).toBe(false);
    expect(isAnnouncementExpired(a, atClick)).toBe(true);
  });

  it("turno vicino alla mezzanotte: 23:59 e 00:01 del giorno dopo", () => {
    expect(isAnnouncementExpired(ann("2026-08-04", "23:59"), romeInstant("2026-08-04", "23:58", 2))).toBe(false);
    expect(isAnnouncementExpired(ann("2026-08-04", "23:59"), romeInstant("2026-08-05", "00:01", 2))).toBe(true);
    // Turno che inizia subito dopo mezzanotte: alle 23:50 del giorno prima NON è scaduto.
    expect(isAnnouncementExpired(ann("2026-08-05", "00:10"), romeInstant("2026-08-04", "23:50", 2))).toBe(false);
  });

  it("senza service_time il turno inizia a mezzanotte (Europa/Rome)", () => {
    expect(getShiftStartDate(ann("2026-08-04", null))?.toISOString()).toBe("2026-08-03T22:00:00.000Z");
    expect(isAnnouncementExpired(ann("2026-08-04", null), romeInstant("2026-08-04", "00:30", 2))).toBe(true);
  });

  it("ora legale (CEST, +02:00): l'inizio è ancorato al fuso italiano, non al fuso del device", () => {
    expect(getShiftStartDate(ann("2026-07-15", "20:00"))?.toISOString()).toBe("2026-07-15T18:00:00.000Z");
  });

  it("ora solare (CET, +01:00): l'inizio è ancorato al fuso italiano", () => {
    expect(getShiftStartDate(ann("2026-01-15", "20:00"))?.toISOString()).toBe("2026-01-15T19:00:00.000Z");
  });

  it("notte del cambio ora: 25 ottobre 2026 (CEST→CET alle 03:00)", () => {
    // 02:30 prima del cambio è ancora CEST (+02:00).
    expect(getShiftStartDate(ann("2026-10-25", "01:30"))?.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    // 04:00 dopo il cambio è CET (+01:00).
    expect(getShiftStartDate(ann("2026-10-25", "04:00"))?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
    expect(isAnnouncementExpired(ann("2026-10-25", "04:00"), new Date("2026-10-25T02:59:00.000Z"))).toBe(false);
    expect(isAnnouncementExpired(ann("2026-10-25", "04:00"), new Date("2026-10-25T03:01:00.000Z"))).toBe(true);
  });

  it("notte del cambio ora: 29 marzo 2026 (CET→CEST alle 02:00)", () => {
    expect(getShiftStartDate(ann("2026-03-29", "01:00"))?.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(getShiftStartDate(ann("2026-03-29", "05:00"))?.toISOString()).toBe("2026-03-29T03:00:00.000Z");
  });
});
