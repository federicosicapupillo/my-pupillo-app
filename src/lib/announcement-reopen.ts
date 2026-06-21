import { supabase } from "@/integrations/supabase/client";

/**
 * When a worker cancels a shift they were assigned/confirmed for, the
 * announcement is reopened so the restaurant can recover other candidates.
 * This helper notifies all PREVIOUS valid candidates that the announcement
 * is available again, in an idempotent way (safe to call multiple times for
 * the same cancellation event).
 *
 * Dedup key (logical): `announcement_reopened:<announcement_id>:<cancelled_application_id>:<worker_id>`.
 * We persist the key inside notifications.metadata.dedup_key so a second
 * invocation can skip workers already notified for the same event.
 *
 * Excluded from the notification:
 *  - the worker who just cancelled (cancellingWorkerId)
 *  - workers whose own application is in a closed state they triggered
 *    (`not_interested`, `cancelled`) — regola: chi si è ritirato non può
 *    ricandidarsi alla stessa inserzione.
 *  - workers with `rejected` applications — la relazione è chiusa.
 *  - deleted / disabled profiles (`is_deleted = true`).
 */
export type NotifyPreviousCandidatesInput = {
  announcementId: string;
  cancelledApplicationId: string;
  cancellingWorkerId: string;
};

const REOPEN_NOTIFICATION_KIND = "announcement_reopened";

const EXCLUDED_APPLICATION_STATUSES = new Set([
  "not_interested",
  "cancelled",
  "rejected",
]);

export async function notifyPreviousCandidatesOfReopen(
  input: NotifyPreviousCandidatesInput,
): Promise<void> {
  const { announcementId, cancelledApplicationId, cancellingWorkerId } = input;
  if (!announcementId || !cancellingWorkerId) return;

  // 1) Candidates: all applications for this announcement, except the one
  //    just cancelled. We use the worker_id from each row.
  const { data: apps, error: appsErr } = await supabase
    .from("applications")
    .select("worker_id, status")
    .eq("announcement_id", announcementId);
  if (appsErr || !apps?.length) return;

  const candidateWorkerIds = Array.from(
    new Set(
      apps
        .filter((a: any) => a.worker_id && a.worker_id !== cancellingWorkerId)
        .filter((a: any) => !EXCLUDED_APPLICATION_STATUSES.has(String(a.status)))
        .map((a: any) => a.worker_id as string),
    ),
  );
  if (candidateWorkerIds.length === 0) return;

  // 2) Filter out deleted/disabled profiles.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_deleted")
    .in("id", candidateWorkerIds);
  const validIds = (profiles ?? [])
    .filter((p: any) => !p.is_deleted)
    .map((p: any) => p.id as string);
  if (validIds.length === 0) return;

  // 3) Idempotency: skip workers already notified for this exact event.
  //    We match on metadata->>dedup_key.
  const dedupBase = `${REOPEN_NOTIFICATION_KIND}:${announcementId}:${cancelledApplicationId}`;
  const { data: existing } = await supabase
    .from("notifications")
    .select("user_id, metadata")
    .in("user_id", validIds)
    .like("metadata->>dedup_key", `${dedupBase}:%`);
  const alreadyNotified = new Set(
    (existing ?? []).map((n: any) => String(n.user_id)),
  );
  const toNotify = validIds.filter((id) => !alreadyNotified.has(id));
  if (toNotify.length === 0) return;

  // 4) Insert one notification per remaining worker.
  const link = `/announcements/${announcementId}`;
  const rows = toNotify.map((workerId) => ({
    user_id: workerId,
    title: "Il turno è tornato disponibile",
    body: "Un turno a cui ti eri candidato è di nuovo disponibile. Puoi controllare l'annuncio e confermare se sei ancora disponibile.",
    link,
    metadata: {
      kind: REOPEN_NOTIFICATION_KIND,
      announcement_id: announcementId,
      cancelled_application_id: cancelledApplicationId,
      dedup_key: `${dedupBase}:${workerId}`,
    },
  }));
  await supabase.from("notifications").insert(rows as never);
}

/**
 * True if the given YYYY-MM-DD date string is today or in the future.
 * Used to decide whether to auto-reopen an announcement after a worker
 * cancels: past shifts must NOT be reopened.
 */
export function isShiftDateStillFuture(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= today.getTime();
}