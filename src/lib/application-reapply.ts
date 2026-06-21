import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for "can this worker re-apply / can this restaurant
 * re-invite for a given announcement?".
 *
 * Background: the `applications` table has a full UNIQUE constraint on
 * (announcement_id, worker_id), so only ONE row per pair can ever exist. We
 * therefore distinguish re-engagement by inspecting the EXISTING row's
 * status to derive who closed the relationship:
 *
 *   - status `not_interested`  → worker self-withdrew (cancelled by worker)
 *   - status `rejected`        → restaurant rejected / cancelled
 *   - status `cancelled` / `expired` → system/admin closure
 *   - active statuses (pending/interested/counter_offer/accepted) → still in contact
 *
 * RULE:
 *   - Worker MUST NOT be able to re-apply if they self-cancelled.
 *   - Restaurant CAN re-invite by reactivating the closed row (status → pending),
 *     when no active row exists and the announcement is still available.
 *
 * History is never deleted; we reuse the same row so the chat / timeline is
 * preserved and the worker can still see "Hai annullato questa candidatura".
 */

export type PriorApplicationState =
  | { kind: "none" }
  | { kind: "active"; applicationId: string; status: string }
  | { kind: "cancelled_by_worker"; applicationId: string }
  | { kind: "closed_by_restaurant"; applicationId: string }
  | { kind: "closed_other"; applicationId: string; status: string };

const ACTIVE_STATUSES = new Set([
  "pending",
  "interested",
  "counter_offer",
  "accepted",
]);

/**
 * Fetch the (single) existing application row for the given pair and
 * classify it. Returns `{ kind: "none" }` if no row exists.
 */
export async function getPriorApplicationState(params: {
  announcementId: string;
  workerId: string;
}): Promise<PriorApplicationState> {
  const { announcementId, workerId } = params;
  if (!announcementId || !workerId) return { kind: "none" };
  const { data } = await supabase
    .from("applications")
    .select("id, status")
    .eq("announcement_id", announcementId)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return { kind: "none" };
  const status = String((data as { status?: string }).status ?? "");
  const id = (data as { id: string }).id;
  if (ACTIVE_STATUSES.has(status)) return { kind: "active", applicationId: id, status };
  if (status === "not_interested") return { kind: "cancelled_by_worker", applicationId: id };
  if (status === "rejected") return { kind: "closed_by_restaurant", applicationId: id };
  return { kind: "closed_other", applicationId: id, status };
}

/** True iff the worker self-cancelled a previous application to this announcement. */
export async function hasWorkerSelfCancelled(
  workerId: string,
  announcementId: string,
): Promise<boolean> {
  const prior = await getPriorApplicationState({ announcementId, workerId });
  return prior.kind === "cancelled_by_worker";
}

/** True iff there is currently an active application/proposal for the pair. */
export async function hasActiveApplicationOrInvite(
  workerId: string,
  announcementId: string,
): Promise<boolean> {
  const prior = await getPriorApplicationState({ announcementId, workerId });
  return prior.kind === "active";
}

export type WorkerApplyDecision =
  | { allowed: true }
  | { allowed: false; reason: "self_cancelled"; applicationId: string }
  | { allowed: false; reason: "active_exists"; applicationId: string }
  | { allowed: false; reason: "previously_closed"; applicationId: string };

/**
 * Worker-side gate. The worker may NEVER re-apply to the same announcement
 * once they self-cancelled.
 */
export async function canWorkerApplyToAnnouncement(
  workerId: string,
  announcementId: string,
): Promise<WorkerApplyDecision> {
  const prior = await getPriorApplicationState({ announcementId, workerId });
  switch (prior.kind) {
    case "none":
      return { allowed: true };
    case "active":
      return { allowed: false, reason: "active_exists", applicationId: prior.applicationId };
    case "cancelled_by_worker":
      return { allowed: false, reason: "self_cancelled", applicationId: prior.applicationId };
    case "closed_by_restaurant":
    case "closed_other":
      // Worker cannot re-open a relationship the restaurant/system closed; only
      // the restaurant can re-invite (handled in canRestaurantInviteWorker).
      return { allowed: false, reason: "previously_closed", applicationId: prior.applicationId };
  }
}

export type RestaurantInviteDecision =
  | { allowed: true; mode: "create" }
  | { allowed: true; mode: "reactivate"; applicationId: string }
  | { allowed: false; reason: "active_exists"; applicationId: string };

/**
 * Restaurant-side gate. The restaurant can ALWAYS re-engage as long as no
 * active row exists: if a closed row is found, we reactivate it (status →
 * pending) so we don't violate the (announcement_id, worker_id) UNIQUE
 * constraint and we preserve the historical chat/messages.
 */
export async function canRestaurantInviteWorker(
  workerId: string,
  announcementId: string,
): Promise<RestaurantInviteDecision> {
  const prior = await getPriorApplicationState({ announcementId, workerId });
  switch (prior.kind) {
    case "none":
      return { allowed: true, mode: "create" };
    case "active":
      return { allowed: false, reason: "active_exists", applicationId: prior.applicationId };
    case "cancelled_by_worker":
    case "closed_by_restaurant":
    case "closed_other":
      return { allowed: true, mode: "reactivate", applicationId: prior.applicationId };
  }
}

/** Copy used by the UI when the worker is blocked because they self-cancelled. */
export const WORKER_SELF_CANCELLED_MESSAGE =
  "Hai annullato questa candidatura. Non puoi candidarti di nuovo a questa inserzione.";