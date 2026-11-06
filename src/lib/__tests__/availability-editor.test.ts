import { describe, expect, it } from 'vitest';
import { dayAvailabilityValue } from '../availability';

describe('Menu disponibilità del giorno', () => {
  it('parte da non disponibile senza orari salvati', () => {
    expect(dayAvailabilityValue(false, undefined, false)).toBe('non_disponibile');
  });
  it('mostra non disponibile dopo disattivazione anche con orari precedenti', () => {
    expect(dayAvailabilityValue(false, 'cena', false)).toBe('non_disponibile');
  });
  it('mantiene la fascia già salvata', () => {
    expect(dayAvailabilityValue(true, 'cena', false)).toBe('cena');
  });
  it('mantiene disponibilità flessibili già salvate', () => {
    expect(dayAvailabilityValue(true, undefined, true)).toBe('flessibile');
  });
});