export const CV_CRITERIA = [
  { key: 'experience', label: 'Esperienza pertinente', max: 30 },
  { key: 'skills', label: 'Competenze specifiche', max: 30 },
  { key: 'responsibility', label: 'Responsabilità svolte', max: 20 },
  { key: 'training', label: 'Formazione pertinente', max: 10 },
  { key: 'clarity', label: 'Informazioni sufficienti', max: 10 },
] as const;
export type CvCriterion = typeof CV_CRITERIA[number]['key'];
export type CvScores = Record<CvCriterion, number>;
export const CV_RUBRIC_VERSION = '3';
export const CV_RECOGNITION_DESCRIPTION = '4 stelle: riconoscimento di base per chi è agli inizi e presenta un curriculum leggibile. 5 stelle: almeno due esperienze lavorative dichiarate oppure gestione di attività o team. Non è una garanzia di qualità né una verifica delle esperienze dichiarate.';
export type CvRecognition = { work_experiences: number; managed_business_or_team: boolean };
export function recognitionStars(evaluable: boolean, recognition?: CvRecognition) {
  if (!evaluable) return null;
  return recognition && (recognition.work_experiences >= 2 || recognition.managed_business_or_team) ? 5 : 4;
}
export function automaticCurriculumRole(previousRole: string | null | undefined, primaryRole: string | null | undefined) {
  const usable = (role: string | null | undefined) => role?.trim() && !['worker', 'restaurant', 'admin'].includes(role.trim().toLowerCase()) ? role.trim() : null;
  return usable(previousRole) || usable(primaryRole) || 'Ristorazione e ospitalità';
}
export function canAnalyzeCurriculum(callerId: string, workerId: string, admin: boolean, worker: boolean) {
  return admin || (worker && callerId === workerId);
}
export function shouldStartCurriculumAnalysis(status: string, consent: string | null, current: boolean) {
  return current && !!consent && ['requested', 'pending_review'].includes(status);
}
export type CvPublicationState = {
  status: string; consent_at: string | null; evaluable: boolean; doubts: boolean;
  total: number | null; stars: number | null; scores: unknown; rubric_version?: string;
};
export function canPublishCurriculum(a: CvPublicationState, currentCurriculum: boolean) {
  if (a.rubric_version === CV_RUBRIC_VERSION) {
    const facts = a.scores && typeof a.scores === 'object' ? a.scores as Partial<CvRecognition> : null;
    if (!facts || !Number.isInteger(facts.work_experiences) || typeof facts.managed_business_or_team !== 'boolean') return false;
    return currentCurriculum && a.status === 'approved' && !!a.consent_at && a.evaluable && a.total !== null &&
      a.stars === recognitionStars(true, { work_experiences: facts.work_experiences ?? 0, managed_business_or_team: facts.managed_business_or_team });
  }
  if (a.rubric_version === '2') {
    return currentCurriculum && a.status === 'approved' && !!a.consent_at && a.evaluable && a.total !== null && a.stars === (a.total >= 85 && !a.doubts ? 5 : 4);
  }
  const clarity = a.scores && typeof a.scores === 'object' && 'clarity' in a.scores ? a.scores.clarity : null;
  return currentCurriculum && a.status === 'approved' && !!a.consent_at && a.evaluable && !a.doubts &&
    typeof clarity === 'number' && clarity >= 5 && a.total !== null && a.total >= 70 &&
    a.stars === (a.total >= 85 ? 5 : 4);
}
export function shouldAutoPublishCurriculum(a: CvPublicationState, currentCurriculum: boolean, publicationConsent: boolean) {
  return publicationConsent && canPublishCurriculum(a, currentCurriculum);
}
export function scoreCurriculum(scores: CvScores, evaluable: boolean, doubts: boolean, rubricVersion = CV_RUBRIC_VERSION, recognition?: CvRecognition) {
  if (!CV_CRITERIA.every(c => Number.isInteger(scores[c.key]) && scores[c.key] >= 0 && scores[c.key] <= c.max)) {
    throw new Error('Punteggio non valido');
  }
  const total = CV_CRITERIA.reduce((n, c) => n + scores[c.key], 0);
  if (rubricVersion === CV_RUBRIC_VERSION) return { total: evaluable ? total : null, stars: recognitionStars(evaluable, recognition) };
  if (rubricVersion === '2') return { total: evaluable ? total : null, stars: evaluable ? (total >= 85 && !doubts ? 5 : 4) : null };
  const stars = evaluable && !doubts && scores.clarity >= 5 && total >= 70 ? (total >= 85 ? 5 : 4) : null;
  return { total, stars };
}
export const CV_STATUS: Record<string, string> = {
  requested: 'Richiesta ricevuta', analyzing: 'Analisi in corso', pending_review: 'Analisi da completare',
  approved: 'Valutazione Pupillo completata', rejected: 'Non pubblicata', not_evaluable: 'Curriculum non valutabile',
  stale: 'Valutazione non attiva', error: 'Analisi non riuscita', blocked: 'Analisi sospesa: serve un controllo Pupillo',
};