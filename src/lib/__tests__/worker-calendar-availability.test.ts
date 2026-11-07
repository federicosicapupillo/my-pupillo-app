import { describe, expect, it } from 'vitest';
import { calendarAvailabilitySearchText, upcomingAvailabilityDates } from '../worker-calendar-availability';
import type { AvailabilityExceptionRow, AvailabilityRow } from '../availability';

const now = new Date('2026-11-07T12:00:00');
const exception = (date: string, time_slot: AvailabilityExceptionRow['time_slot'], is_available = true): AvailabilityExceptionRow => ({
  id: date, worker_id: 'worker', date, time_slot, is_available, start_time: '11:00', end_time: '15:00', notes: null,
  city: 'Torino', province: 'TO', district: null, latitude: null, longitude: null, radius_km: null,
});

describe('restaurant calendar availability', () => {
  it('retains every upcoming date, beyond the three-row card preview', () => {
    const entries = ['2026-11-07','2026-11-14','2026-11-21','2026-11-28'].map(d => exception(d,'pranzo'));
    expect(upcomingAvailabilityDates(entries,now).map(d => d.date)).toEqual(entries.map(e => e.date));
  });
  it('keeps single-date edits independent and excludes past dates', () => {
    const dates = upcomingAvailabilityDates([exception('2026-11-06','cena'),exception('2026-11-07','colazione'),exception('2026-11-14','pranzo')],now);
    expect(dates.map(d => [d.date,d.entries[0].time_slot])).toEqual([['2026-11-07','colazione'],['2026-11-14','pranzo']]);
  });
  it('matches today, tomorrow and weekend for date-only availability', () => {
    const text = calendarAvailabilitySearchText([], [exception('2026-11-07','pranzo'),exception('2026-11-08','cena')],now);
    for (const token of ['oggi','domani','weekend','pranzo','sera']) expect(text).toContain(token);
  });
  it('explicit unavailability overrides weekly availability for today', () => {
    const rows = [{ day_of_week: 5 }] as AvailabilityRow[];
    const text = calendarAvailabilitySearchText(rows,[exception('2026-11-07',null,false)],now);
    expect(text).not.toContain('oggi');
    expect(upcomingAvailabilityDates([exception('2026-11-07',null,false)],now)[0].available).toBe(false);
  });
});