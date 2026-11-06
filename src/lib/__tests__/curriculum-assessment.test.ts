import { describe, it, expect } from 'vitest';
import { scoreCurriculum, canPublishCurriculum, canAnalyzeCurriculum, shouldStartCurriculumAnalysis } from '../curriculum-assessment';
describe('Valutazione curriculum', () => {
  it('assegna cinque stelle a 85 punti', () => expect(scoreCurriculum({ experience: 30, skills: 25, responsibility: 15, training: 5, clarity: 10 }, true, false)).toEqual({ total: 85, stars: 5 }));
  it('assegna quattro stelle a 70 punti', () => expect(scoreCurriculum({ experience: 25, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false)).toEqual({ total: 70, stars: 4 }));
  it('non pubblica sotto 70 punti', () => expect(scoreCurriculum({ experience: 24, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false).stars).toBeNull());
  it('non valuta documenti illeggibili', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, false, false).stars).toBeNull());
  it('non pubblica dubbi irrisolti', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, true, true).stars).toBeNull());
  it('richiede informazioni sufficienti', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 4 }, true, false).stars).toBeNull());
  it('rifiuta valori fuori criterio', () => expect(() => scoreCurriculum({ experience: 31, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false)).toThrow());
});
describe('Scelta pubblicazione curriculum', () => {
  const approved = { status: 'approved', consent_at: '2026-11-06T16:00:00Z', evaluable: true, doubts: false, total: 70, stars: 4, scores: { clarity: 10 } };
  it('permette la scelta da quattro stelle approvate', () => expect(canPublishCurriculum(approved, true)).toBe(true));
  it('non permette la pubblicazione sotto quattro stelle', () => expect(canPublishCurriculum({ ...approved, total: 69, stars: null }, true)).toBe(false));
  it('mantiene disponibile il punteggio privato sotto soglia', () => expect(scoreCurriculum({ experience: 24, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false).total).toBe(69));
  it('richiede un’analisi completata', () => expect(canPublishCurriculum({ ...approved, status: 'pending_review' }, true)).toBe(false));
  it('richiede consenso attivo', () => expect(canPublishCurriculum({ ...approved, consent_at: null }, true)).toBe(false));
  it('non pubblica il curriculum sostituito', () => expect(canPublishCurriculum(approved, false)).toBe(false));
  it('blocca dubbi irrisolti', () => expect(canPublishCurriculum({ ...approved, doubts: true }, true)).toBe(false));
});
describe('Analisi diretta senza approvazione manuale', () => {
  it('autorizza il lavoratore sul proprio curriculum', () => expect(canAnalyzeCurriculum('owner', 'owner', false, true)).toBe(true));
  it('nega al lavoratore analisi di altri utenti', () => expect(canAnalyzeCurriculum('other', 'owner', false, true)).toBe(false));
  it('nega analisi a un ristoratore anche sul proprio ID', () => expect(canAnalyzeCurriculum('owner', 'owner', false, false)).toBe(false));
  it('mantiene accesso admin', () => expect(canAnalyzeCurriculum('admin', 'owner', true, false)).toBe(true));
  it('avvia automaticamente richieste già consentite', () => expect(shouldStartCurriculumAnalysis('requested', '2026-11-06', true)).toBe(true));
  it('completa le richieste in attesa di verifica manuale', () => expect(shouldStartCurriculumAnalysis('pending_review', '2026-11-06', true)).toBe(true));
  it('non avvia analisi dopo revoca del consenso', () => expect(shouldStartCurriculumAnalysis('requested', null, true)).toBe(false));
  it('non avvia analisi di documenti sostituiti', () => expect(shouldStartCurriculumAnalysis('requested', '2026-11-06', false)).toBe(false));
  it.each(['approved', 'error', 'blocked', 'analyzing'])('non ripete automaticamente lo stato %s', status => expect(shouldStartCurriculumAnalysis(status, '2026-11-06', true)).toBe(false));
});