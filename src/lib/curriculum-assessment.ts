export const CV_CRITERIA = [
  { key: 'experience', label: 'Esperienza pertinente', max: 30 },
  { key: 'skills', label: 'Competenze specifiche', max: 30 },
  { key: 'responsibility', label: 'Responsabilità svolte', max: 20 },
  { key: 'training', label: 'Formazione pertinente', max: 10 },
  { key: 'clarity', label: 'Informazioni sufficienti', max: 10 },
] as const;
export type CvCriterion = typeof CV_CRITERIA[number]['key'];
export type CvScores = Record<CvCriterion, number>;
export function scoreCurriculum(scores: CvScores, evaluable: boolean, doubts: boolean) {
  if (!CV_CRITERIA.every(c => Number.isInteger(scores[c.key]) && scores[c.key] >= 0 && scores[c.key] <= c.max)) {
    throw new Error('Punteggio non valido');
  }
  const total = CV_CRITERIA.reduce((n, c) => n + scores[c.key], 0);
  const stars = evaluable && !doubts && scores.clarity >= 5 && total >= 70 ? (total >= 85 ? 5 : 4) : null;
  return { total, stars };
}
export const CV_STATUS: Record<string, string> = {
  requested: 'Richiesta ricevuta', analyzing: 'Analisi in corso', pending_review: 'In attesa di verifica Pupillo',
  approved: 'Approvata da Pupillo', rejected: 'Non pubblicata', not_evaluable: 'Curriculum non valutabile',
  stale: 'Valutazione non attiva', error: 'Analisi non riuscita', blocked: 'Analisi sospesa: serve un controllo Pupillo',
};