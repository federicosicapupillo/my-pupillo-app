import { DAY_LABELS, SLOT_LABELS, type AvailabilityExceptionRow, type AvailabilityRow } from '@/lib/availability';
import { dowOfIso, toIso } from '@/lib/availability-calendar';

export function upcomingAvailabilityDates(exceptions: AvailabilityExceptionRow[], now = new Date()) {
  const byDate = new Map<string, AvailabilityExceptionRow[]>();
  for (const row of exceptions) {
    if (row.date < toIso(now)) continue;
    const group = byDate.get(row.date) ?? [];
    group.push(row);
    byDate.set(row.date, group);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({
    date,
    available: entries.every(e => e.is_available),
    entries,
  }));
}

export function calendarAvailabilitySearchText(rows: AvailabilityRow[], exceptions: AvailabilityExceptionRow[], now = new Date()) {
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const dates = upcomingAvailabilityDates(exceptions, now);
  const parts: string[] = [];
  for (const { date, available, entries } of dates) {
    if (!available) continue;
    const dow = dowOfIso(date);
    parts.push(date, DAY_LABELS[dow]);
    if (date === toIso(now)) parts.push('oggi today');
    if (date === toIso(tomorrow)) parts.push('domani tomorrow');
    if (dow >= 5) parts.push('weekend');
    for (const e of entries) {
      parts.push(e.time_slot ? SLOT_LABELS[e.time_slot] : '', e.start_time ?? '', e.end_time ?? '');
      if (e.time_slot === 'cena' || e.time_slot === 'serale') parts.push('sera evening night');
      if (e.time_slot === 'intera_giornata') parts.push('full fulltime full-time');
      if (e.time_slot === 'last_minute') parts.push('urgente urgent');
    }
  }
  // Date overrides win over the weekly fallback, including explicit unavailability.
  for (const [date, token] of [[toIso(now), 'oggi today'], [toIso(tomorrow), 'domani tomorrow']]) {
    if (!dates.some(d => d.date === date) && rows.some(r => r.day_of_week === dowOfIso(date))) parts.push(token);
  }
  return parts.join(' ').toLowerCase();
}