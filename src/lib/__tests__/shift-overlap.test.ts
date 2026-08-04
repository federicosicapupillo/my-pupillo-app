import { describe, it, expect } from "vitest";
import { conflictsWithBusyWindows, BUFFER_HOURS, type BusyWindow } from "@/lib/shift-conflict";
import { getShiftStartDate, getShiftEndDate } from "@/lib/announcement-time";

const ann = (date: string, start: string, end: string) => ({
  service_date: date, service_time: start, end_time: end,
});

function busyFrom(date: string, start: string, end: string): BusyWindow {
  return {
    applicationId: "a1",
    announcementId: "n1",
    start: getShiftStartDate(ann(date, start, end))!,
    end: getShiftEndDate(ann(date, start, end))!,
  };
}

describe("sovrapposizione turni lavoratore (semiaperto [start, end))", () => {
  const busy = [busyFrom("2026-09-10", "18:00", "23:00")];

  it("nessun buffer applicato", () => {
    expect(BUFFER_HOURS).toBe(0);
  });

  it("blocca una sovrapposizione parziale", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-10", "22:00", "23:59"), busy)).not.toBeNull();
  });

  it("blocca un turno identico", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-10", "18:00", "23:00"), busy)).not.toBeNull();
  });

  it("blocca un turno contenuto", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-10", "19:00", "20:00"), busy)).not.toBeNull();
  });

  it("permette turni contigui (fine = inizio)", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-10", "23:00", "23:59"), busy)).toBeNull();
    expect(conflictsWithBusyWindows(ann("2026-09-10", "12:00", "18:00"), busy)).toBeNull();
  });

  it("permette due turni lo stesso giorno in fasce diverse", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-10", "08:00", "12:00"), busy)).toBeNull();
  });

  it("permette il giorno successivo", () => {
    expect(conflictsWithBusyWindows(ann("2026-09-11", "18:00", "23:00"), busy)).toBeNull();
  });

  it("gestisce il cambio ora legale/solare (ultima domenica di ottobre)", () => {
    const dst = [busyFrom("2026-10-25", "01:00", "04:00")];
    expect(conflictsWithBusyWindows(ann("2026-10-25", "03:00", "05:00"), dst)).not.toBeNull();
    expect(conflictsWithBusyWindows(ann("2026-10-25", "05:00", "07:00"), dst)).toBeNull();
  });
});
