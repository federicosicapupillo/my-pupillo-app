/** Compensation belongs to this worker's proposal, not to the shared announcement. */
export function proposalCompensation(announcementRate: number | string | null | undefined, tariffType: string | null | undefined, workerRate: number | null | undefined) {
  const announced = announcementRate == null ? null : Number(announcementRate);
  const validAnnounced = announced != null && Number.isFinite(announced) && announced > 0 ? announced : null;
  const validWorker = workerRate != null && Number.isFinite(workerRate) && workerRate > 0 ? workerRate : null;
  const higher = tariffType === "hourly" && validAnnounced != null && validWorker != null && validWorker > validAnnounced;
  return { announced: validAnnounced, worker: validWorker, higher, effective: higher ? validWorker : validAnnounced, needsAgreement: higher && validWorker < 31, needsExactRate: higher && validWorker >= 31 };
}