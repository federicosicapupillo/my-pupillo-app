import { describe, it, expect } from 'vitest';
import { automaticCurriculumRole, scoreCurriculum, canPublishCurriculum, shouldAutoPublishCurriculum, canAnalyzeCurriculum, shouldStartCurriculumAnalysis } from '../curriculum-assessment';
describe('Mansione automatica senza richiesta separata', () => {
  it('riusa la mansione già valutata alla sostituzione', () => expect(automaticCurriculumRole('Cameriere', 'Barista')).toBe('Cameriere'));
  it('usa la mansione del profilo al primo caricamento', () => expect(automaticCurriculumRole(null, 'Barista')).toBe('Barista'));
  it('consente la valutazione prima del completamento del profilo', () => expect(automaticCurriculumRole(null, null)).toBe('Ristorazione e ospitalità'));
});
describe('Valutazione curriculum', () => {
  it('assegna cinque stelle a 85 punti', () => expect(scoreCurriculum({ experience: 30, skills: 25, responsibility: 15, training: 5, clarity: 10 }, true, false, '2')).toEqual({ total: 85, stars: 5 }));
  it('assegna quattro stelle a 70 punti', () => expect(scoreCurriculum({ experience: 25, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false)).toEqual({ total: 70, stars: 4 }));
  it('riconosce quattro stelle anche sotto 70 punti', () => expect(scoreCurriculum({ experience: 24, skills: 20, responsibility: 10, training: 5, clarity: 10 }, true, false).stars).toBe(4));
  it('non valuta documenti illeggibili', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, false, false).stars).toBeNull());
  it('mantiene quattro stelle di base in presenza di dubbi', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 10 }, true, true).stars).toBe(4));
  it('non esclude un curriculum leggibile poco dettagliato', () => expect(scoreCurriculum({ experience: 30, skills: 30, responsibility: 20, training: 10, clarity: 4 }, true, false, '2').stars).toBe(5));
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
describe('Pubblicazione automatica con consenso esplicito', () => {
  const completed = { status: 'approved', consent_at: '2026-11-06', evaluable: true, doubts: false, total: 70, stars: 4, scores: { clarity: 10 } };
  it('pubblica automaticamente quattro stelle con consenso', () => expect(shouldAutoPublishCurriculum(completed, true, true)).toBe(true));
  it('pubblica automaticamente cinque stelle con consenso', () => expect(shouldAutoPublishCurriculum({ ...completed, total: 85, stars: 5 }, true, true)).toBe(true));
  it('non pubblica sotto quattro stelle', () => expect(shouldAutoPublishCurriculum({ ...completed, total: 69, stars: null }, true, true)).toBe(false));
  it('non pubblica retroattivamente senza consenso alla pubblicazione', () => expect(shouldAutoPublishCurriculum(completed, true, false)).toBe(false));
  it('non pubblica dopo sostituzione del documento', () => expect(shouldAutoPublishCurriculum(completed, false, true)).toBe(false));
  it('non pubblica dopo rimozione del consenso', () => expect(shouldAutoPublishCurriculum({ ...completed, consent_at: null }, true, true)).toBe(false));
});
describe('Riconoscimento inclusivo versione 2', () => {
  const zero = { experience: 0, skills: 0, responsibility: 0, training: 0, clarity: 0 };
  it('garantisce quattro stelle senza gonfiare il punteggio', () => expect(scoreCurriculum(zero, true, true)).toEqual({ total: 0, stars: 4 }));
  it('non assegna un falso zero a un PDF non valutabile', () => expect(scoreCurriculum(zero, false, true)).toEqual({ total: null, stars: null }));
  it('pubblica quattro stelle di base con consenso anche a zero punti', () => expect(shouldAutoPublishCurriculum({ rubric_version: '2', status: 'approved', consent_at: '2026-11-14', evaluable: true, doubts: true, total: 0, stars: 4, scores: zero }, true, true)).toBe(true));
  it('corregge worker con la mansione del profilo', () => expect(automaticCurriculumRole('worker', 'Cameriere')).toBe('Cameriere'));
});

 describe('Riconoscimento esperienze versione 3', () => {
  const scores = { experience: 5, skills: 5, responsibility: 0, training: 0, clarity: 5 };
  it('cinque stelle a chi dichiara due lavori anche senza formazione', () => expect(scoreCurriculum(scores, true, true, '3', { work_experiences: 2, managed_business_or_team: false })).toEqual({ total: 15, stars: 5 }));
  it('cinque stelle a chi ha gestito un ristorante con una sola esperienza', () => expect(scoreCurriculum(scores, true, false, '3', { work_experiences: 1, managed_business_or_team: true }).stars).toBe(5));
  it('quattro stelle a chi è agli inizi con un lavoro', () => expect(scoreCurriculum(scores, true, false, '3', { work_experiences: 1, managed_business_or_team: false }).stars).toBe(4));
  it('nessuna stella per un documento illeggibile anche con esperienze', () => expect(scoreCurriculum(scores, false, false, '3', { work_experiences: 2, managed_business_or_team: true })).toEqual({ total: null, stars: null }));
  const completed = { rubric_version: '3', status: 'approved', consent_at: '2026-11-14', evaluable: true, doubts: true, total: 15, stars: 5, scores: { ...scores, work_experiences: 2, managed_business_or_team: false } };
  it('pubblica il riconoscimento a cinque stelle con consenso senza soglia numerica', () => expect(shouldAutoPublishCurriculum(completed, true, true)).toBe(true));
  it('non pubblica senza consenso', () => expect(shouldAutoPublishCurriculum(completed, true, false)).toBe(false));
  it('rifiuta cinque stelle se non ci sono più lavori o gestione', () => expect(canPublishCurriculum({ ...completed, scores: { ...scores, work_experiences: 1, managed_business_or_team: false } }, true)).toBe(false));
 });
