import { describe, it, expect } from 'vitest';
import { availabilityCopyDates } from '../availability-calendar';

describe('Copia esplicita per data', () => {
  const now = new Date(2026, 10, 6);
  it('copia sabato 7 solo sui sabati futuri di novembre', () => {
    expect(availabilityCopyDates('2026-11-07', 'month', now)).toEqual(['2026-11-14','2026-11-21','2026-11-28']);
  });
  it('non modifica sabati precedenti né dicembre partendo dal 14', () => {
    expect(availabilityCopyDates('2026-11-14', 'month', now)).toEqual(['2026-11-21','2026-11-28']);
  });
  it('copia solo nella settimana scelta senza giorni passati', () => {
    expect(availabilityCopyDates('2026-11-07', 'week', now)).toEqual(['2026-11-06','2026-11-08']);
  });
});