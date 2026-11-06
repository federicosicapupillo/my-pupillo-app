import { describe, expect, it } from 'vitest';
import { isDayEditorEnabled } from '../availability';

describe('Selettore disponibilità del giorno', () => {
  it('è acceso inizialmente anche senza orari salvati', () => {
    expect(isDayEditorEnabled(false, false)).toBe(true);
  });
  it('può essere spento esplicitamente', () => {
    expect(isDayEditorEnabled(false, true)).toBe(false);
  });
  it('resta acceso per disponibilità già salvate', () => {
    expect(isDayEditorEnabled(true, false)).toBe(true);
  });
});