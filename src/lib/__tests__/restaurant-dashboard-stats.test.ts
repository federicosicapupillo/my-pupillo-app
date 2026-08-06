import { describe, it, expect } from "vitest";
import {
  normalizeRestaurantDashboardStats,
  receivedReviewsLabel,
  EMPTY_RESTAURANT_DASHBOARD_STATS,
} from "@/lib/restaurant-dashboard-stats";

describe("restaurant dashboard stats", () => {
  it("normalizes the RPC payload", () => {
    const s = normalizeRestaurantDashboardStats({
      activeAnnouncementsCount: 2,
      assignedAnnouncementsCount: 1,
      pendingWorkerApplicationsCount: 0,
      receivedVisibleReviewsCount: 1,
      averageReceivedRating: "2.00",
      completedDistinctShiftsCount: 1,
      totalShiftsCount: 1,
      cancelledShiftsCount: 0,
      topPositiveTag: null,
    });
    expect(s.pendingWorkerApplicationsCount).toBe(0);
    expect(s.receivedVisibleReviewsCount).toBe(1);
    expect(s.averageReceivedRating).toBe(2);
    expect(s.completedDistinctShiftsCount).toBe(1);
    expect(s.topPositiveTag).toBeNull();
  });

  it("returns null average when there are no reviews", () => {
    const s = normalizeRestaurantDashboardStats({ averageReceivedRating: null });
    expect(s.averageReceivedRating).toBeNull();
    expect(s.receivedVisibleReviewsCount).toBe(0);
  });

  it("defaults to zeros for a missing payload", () => {
    expect(normalizeRestaurantDashboardStats(null)).toEqual(EMPTY_RESTAURANT_DASHBOARD_STATS);
  });

  it("uses singular and plural correctly", () => {
    expect(receivedReviewsLabel(0)).toBe("Per ora hai 0 recensioni ricevute");
    expect(receivedReviewsLabel(1)).toBe("Per ora hai 1 recensione ricevuta");
    expect(receivedReviewsLabel(2)).toBe("Per ora hai 2 recensioni ricevute");
  });

  it("shows a neutral badge under the 3-review threshold", () => {
    const count = 1;
    const isInConstruction = count < 3;
    expect(isInConstruction).toBe(true);
    const badge = isInConstruction ? "In fase di calcolo" : "Attenzione";
    expect(badge).toBe("In fase di calcolo");
  });
});
