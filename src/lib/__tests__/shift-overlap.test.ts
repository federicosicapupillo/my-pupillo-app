import { describe, it, expect } from "vitest";
import {
  conflictsWithBusyWindows,
  BUFFER_HOURS,
  MINIMUM_BUFFER_MINUTES,
  isActiveApplicationStatus,
  mapShiftConflictError,
  ACTIVE_APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  type BusyWindow,
} from "@/lib/shift-conflict";
import { getShiftStartDate, getShiftEndDate } from "@/lib/announcement-time";

const ann = (date: string, start: string, end: string, endDate?: string) => ({
  service_date: date,
  service_time: start,
  end_time: end,
  ...(endDate ? { end_date: endDate } : {}),
});

const BUFFER_MS = BUFFER_HOURS * 3_600_000;

/** Le finestre "busy" reali arrivano già con il buffer applicato alla fine. */
function busyFrom(date: string, start: string, end: string, endDate?: string): BusyWindow {
  const a = ann(date, start, end, endDate);
  return {
    applicationId: "a1",
    announcementId: "n1",
    start: getShiftStartDate(a)!,
    end: new Date(getShiftEndDate(a)!.getTime() + BUFFER_MS),
  };
}

describe("buffer minimo di un'ora tra due turni", () => {
  // Turno esistente 18:00-22:00
  const busy = [busyFrom("2026-09-10", "18:00", "22:00")];
  const blocked = (a: ReturnType<typeof ann>) => conflictsWithBusyWindows(a, busy) !== null;

  it("il buffer canonico è di 60 minuti", () => {
    expect(BUFFER_HOURS).toBe(1);
    expect(MINIMUM_BUFFER_MINUTES).toBe(60);
  });

  it("21:00-23:00 → rifiutato (sovrapposizione)", () => {
    expect(blocked(ann("2026-09-10", "21:00", "23:00"))).toBe(true);
  });

  it("22:00-00:00 → rifiutato (nessuna pausa)", () => {
    expect(blocked(ann("2026-09-10", "22:00", "23:59", "2026-09-10"))).toBe(true);
  });

  it("22:30-00:30 → rifiutato (30 minuti)", () => {
    expect(blocked(ann("2026-09-10", "22:30", "00:30", "2026-09-11"))).toBe(true);
  });

  it("22:59-01:00 → rifiutato", () => {
    expect(blocked(ann("2026-09-10", "22:59", "01:00", "2026-09-11"))).toBe(true);
  });

  it("23:00-01:00 → consentito (60 minuti esatti)", () => {
    expect(blocked(ann("2026-09-10", "23:00", "01:00", "2026-09-11"))).toBe(false);
  });

  it("15:00-17:00 → consentito (un'ora esatta prima)", () => {
    expect(blocked(ann("2026-09-10", "15:00", "17:00"))).toBe(false);
  });

  it("15:00:01-17:00:01 → rifiutato (59'59\")", () => {
    expect(blocked(ann("2026-09-10", "15:00:01", "17:00:01"))).toBe(true);
  });

  it("15:30-17:30 → rifiutato (30 minuti)", () => {
    expect(blocked(ann("2026-09-10", "15:30", "17:30"))).toBe(true);
  });

  it("16:00-18:00 → rifiutato (turno consecutivo)", () => {
    expect(blocked(ann("2026-09-10", "16:00", "18:00"))).toBe(true);
  });

  it("controllo simmetrico: esistente 20:00-23:00, nuovo 17:30-19:30 → rifiutato", () => {
    const b = [busyFrom("2026-09-10", "20:00", "23:00")];
    expect(conflictsWithBusyWindows(ann("2026-09-10", "17:30", "19:30"), b)).not.toBeNull();
    expect(conflictsWithBusyWindows(ann("2026-09-10", "17:00", "19:00"), b)).toBeNull();
  });

  it("turni che attraversano la mezzanotte", () => {
    const b = [busyFrom("2026-09-10", "22:00", "02:00", "2026-09-11")];
    expect(conflictsWithBusyWindows(ann("2026-09-11", "02:30", "05:00"), b)).not.toBeNull();
    expect(conflictsWithBusyWindows(ann("2026-09-11", "03:00", "05:00"), b)).toBeNull();
  });

  it("giorno successivo consentito", () => {
    expect(blocked(ann("2026-09-11", "18:00", "22:00"))).toBe(false);
  });

  it("gestisce il cambio ora legale/solare (ultima domenica di ottobre)", () => {
    const dst = [busyFrom("2026-10-25", "01:00", "04:00")];
    expect(conflictsWithBusyWindows(ann("2026-10-25", "03:00", "05:00"), dst)).not.toBeNull();
    expect(conflictsWithBusyWindows(ann("2026-10-25", "05:00", "07:00"), dst)).toBeNull();
  });
});

describe("stati candidatura considerati attivi", () => {
  it("gli stati operativi generano conflitto", () => {
    for (const s of ACTIVE_APPLICATION_STATUSES) expect(isActiveApplicationStatus(s)).toBe(true);
  });
  it("gli stati chiusi non generano conflitto", () => {
    for (const s of CLOSED_APPLICATION_STATUSES) expect(isActiveApplicationStatus(s)).toBe(false);
    expect(isActiveApplicationStatus(null)).toBe(false);
  });
});

describe("mappatura errori backend", () => {
  it("riconosce SHIFT_APPLICATION_BUFFER_CONFLICT", () => {
    const msg = mapShiftConflictError(
      { message: "SHIFT_APPLICATION_BUFFER_CONFLICT" },
      "worker_apply",
    );
    expect(msg).toContain("almeno un'ora");
  });
  it("riconosce il codice legacy", () => {
    expect(mapShiftConflictError({ message: "WORKER_SHIFT_CONFLICT" }, "worker_accept")).toBeTruthy();
  });
  it("riconosce l'orario di fine mancante", () => {
    expect(mapShiftConflictError({ message: "SHIFT_END_TIME_MISSING" }, "worker_apply")).toContain(
      "orario di fine",
    );
  });
  it("ignora altri errori", () => {
    expect(mapShiftConflictError({ message: "boom" }, "worker_apply")).toBeNull();
  });
});
