/**
 * Single source of truth for the blind reciprocal review flow of a shift.
 *
 * Backend truth lives in `public.get_shift_review_status(_shift_id)`
 * (SECURITY DEFINER, participants only) plus the DB triggers
 * `reviews_blind_before_insert` / `reviews_blind_after_insert`, which keep
 * both rows locked until BOTH directions exist for the same shift.
 *
 * The UI must never derive the unlock from a notification, from a single
 * side's review, or from local state: it always uses `deriveShiftReviewPhase`
 * fed with the RPC result.
 */

export type ShiftReviewViewerRole = "worker" | "restaurant";

export type ShiftReviewStatus = {
  viewerRole: ShiftReviewViewerRole | null;
  shiftStatus: string | null;
  mineExists: boolean;
  mineReviewId: string | null;
  otherExists: boolean;
  /** Only set once both sides reviewed (blind unlock). */
  otherReviewId: string | null;
  unlocked: boolean;
};

export type ShiftReviewPhase =
  /** Shift cancelled / no-show → reviews are not allowed. */
  | "not_reviewable"
  /** Shift has not ended yet. */
  | "not_ended"
  /** Can review, nothing received yet. */
  | "can_review"
  /** Counterpart reviewed first; content stays hidden until the viewer reviews. */
  | "received_locked"
  /** Viewer reviewed, waiting for the counterpart. */
  | "sent_waiting"
  /** Both sides reviewed → both contents visible. */
  | "unlocked";

export function deriveShiftReviewPhase(input: {
  shiftStatus: string | null | undefined;
  shiftEnded: boolean;
  status: Pick<ShiftReviewStatus, "mineExists" | "otherExists" | "unlocked">;
}): ShiftReviewPhase {
  const { shiftStatus, shiftEnded, status } = input;
  const mine = status.mineExists;
  const other = status.otherExists;
  // Unlock rule — the ONLY one, identical for both roles.
  const unlocked = mine && other;

  if (unlocked) return "unlocked";
  if (shiftStatus === "cancelled" || shiftStatus === "no_show") return "not_reviewable";
  if (mine) return "sent_waiting";
  if (!shiftEnded) return "not_ended";
  if (other) return "received_locked";
  return "can_review";
}

/** True only when both reviews of the shift exist. */
export function reviewsUnlocked(status: Pick<ShiftReviewStatus, "mineExists" | "otherExists">): boolean {
  return status.mineExists && status.otherExists;
}