/** Analysis outcomes after which the PDF is no longer needed and is deleted. */
export const CV_PURGE_STATUSES = ['approved', 'not_evaluable'] as const;
/** Automatic deletion applies to analyses completed from this instant; earlier files are not mass-deleted. */
export const CV_AUTO_DELETE_SINCE = '2026-11-10T00:00:00Z';
export function shouldPurgeCurriculum(status: string, savedOk: boolean) {
  return savedOk && (CV_PURGE_STATUSES as readonly string[]).includes(status);
}
