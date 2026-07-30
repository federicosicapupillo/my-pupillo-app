import { describe, it, expect } from "vitest";
import { deriveShiftReviewPhase, reviewsUnlocked } from "../shift-reviews";

const S = (mine: boolean, other: boolean) => ({ mineExists: mine, otherExists: other, unlocked: mine && other });

describe("deriveShiftReviewPhase — single source of truth for the blind unlock", () => {
  it("blocks reviews before the shift ends", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "scheduled", shiftEnded: false, status: S(false, false) })).toBe("not_ended");
  });

  it("blocks reviews for cancelled / no-show shifts", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "cancelled", shiftEnded: true, status: S(false, false) })).toBe("not_reviewable");
    expect(deriveShiftReviewPhase({ shiftStatus: "no_show", shiftEnded: true, status: S(false, false) })).toBe("not_reviewable");
  });

  it("offers the form once the shift ended and nothing was written", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "completed", shiftEnded: true, status: S(false, false) })).toBe("can_review");
  });

  it("hides received content until the viewer reviews", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "completed", shiftEnded: true, status: S(false, true) })).toBe("received_locked");
  });

  it("waits for the counterpart after the viewer reviewed", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "completed", shiftEnded: true, status: S(true, false) })).toBe("sent_waiting");
  });

  it("unlocks only when both reviews exist, regardless of shift end flag", () => {
    expect(deriveShiftReviewPhase({ shiftStatus: "completed", shiftEnded: false, status: S(true, true) })).toBe("unlocked");
    expect(deriveShiftReviewPhase({ shiftStatus: "cancelled", shiftEnded: true, status: S(true, true) })).toBe("unlocked");
  });

  it("reviewsUnlocked mirrors the same rule for both roles", () => {
    expect(reviewsUnlocked({ mineExists: true, otherExists: true })).toBe(true);
    expect(reviewsUnlocked({ mineExists: true, otherExists: false })).toBe(false);
    expect(reviewsUnlocked({ mineExists: false, otherExists: true })).toBe(false);
  });
});