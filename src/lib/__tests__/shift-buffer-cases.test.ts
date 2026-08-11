import { describe, it, expect } from "vitest";
import { conflictsWithBusyWindows, BUFFER_HOURS, type BusyWindow } from "@/lib/shift-conflict";
import { getShiftStartDate, getShiftEndDate } from "@/lib/announcement-time";
const B = BUFFER_HOURS * 3_600_000;
const ann = (d: string, s: string, e: string, ed?: string) => ({ service_date: d, service_time: s, end_time: e, ...(ed?{end_date:ed}:{}) });
const busy = (a: any): BusyWindow[] => [{ applicationId:"a", announcementId:"n", start:getShiftStartDate(a)!, end:new Date(getShiftEndDate(a)!.getTime()+B) }];
const day = busy(ann("2026-08-12","11:00","18:00"));
const night = busy(ann("2026-08-12","22:00","02:00"));
describe("casi richiesti", () => {
  it("12/08 18:30 bloccato", () => expect(conflictsWithBusyWindows(ann("2026-08-12","18:30","20:00"), day)).not.toBeNull());
  it("12/08 19:00 consentito", () => expect(conflictsWithBusyWindows(ann("2026-08-12","19:00","22:00"), day)).toBeNull());
  it("13/08 18:30 consentito", () => expect(conflictsWithBusyWindows(ann("2026-08-13","18:30","20:00"), day)).toBeNull());
  it("11/08 fino alle 10:30 consentito", () => expect(conflictsWithBusyWindows(ann("2026-08-11","08:00","10:30"), day)).toBeNull());
  it("notturno + 13/08 02:30 bloccato", () => expect(conflictsWithBusyWindows(ann("2026-08-13","02:30","05:00"), night)).not.toBeNull());
  it("notturno + 13/08 03:00 consentito", () => expect(conflictsWithBusyWindows(ann("2026-08-13","03:00","05:00"), night)).toBeNull());
});
