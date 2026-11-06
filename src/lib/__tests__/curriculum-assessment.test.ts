import { describe, it, expect } from 'vitest';
import { scoreCurriculum } from '../curriculum-assessment';
describe('Valutazione curriculum', () => {
  it('assegna cinque stelle a 85 punti', () => expect(scoreCurriculum({ experience: 30, skills: 25, responsibility: 15, training: 5, clarity: 10 }, true, false)).toEqual({ total: 85, stars: 5 }));
  it('assegna quattro stelle a 70 punti', () => expect(scoreCurriculum({ experience: 25, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false)).toEqual({ total: 70, stars: 4 }));
  it('non pubblica sotto 70 punti', () => expect(scoreCurriculum({ experience: 24, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false).stars).toBeNull());
  it('non valuta documenti illeggibili', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, false, false).stars).toBeNull());
  it('non pubblica dubbi irrisolti', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, true, true).stars).toBeNull());
  it('richiede informazioni sufficienti', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 4 }, true, false).stars).toBeNull());
  it('rifiuta valori fuori criterio', () => expect(() => scoreCurriculum({ experience: 31, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false)).toThrow());
});