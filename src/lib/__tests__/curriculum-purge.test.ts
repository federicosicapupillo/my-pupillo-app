import { describe, it, expect } from 'vitest';
import { shouldPurgeCurriculum } from '@/lib/curriculum-purge';

describe('curriculum PDF deletion after analysis', () => {
  it('deletes after a saved completed analysis', () => {
    expect(shouldPurgeCurriculum('approved', true)).toBe(true);
    expect(shouldPurgeCurriculum('not_evaluable', true)).toBe(true);
  });
  it('keeps the file when the result was not saved', () => {
    expect(shouldPurgeCurriculum('approved', false)).toBe(false);
  });
  it('keeps the file for retry when analysis failed or is pending', () => {
    for (const s of ['error', 'blocked', 'requested', 'analyzing', 'pending_review']) expect(shouldPurgeCurriculum(s, true)).toBe(false);
  });
});
