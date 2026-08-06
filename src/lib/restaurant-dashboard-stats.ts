import { supabase } from "@/integrations/supabase/client";

/**
 * Single authoritative source for the restaurant dashboard aggregates.
 *
 * All numbers come from the `get_restaurant_dashboard_stats()` RPC, which
 * identifies the restaurant through `auth.uid()` (no client-supplied id),
 * applies the canonical "candidatura da valutare" definition and only counts
 * reviews that are already visible under the blind reciprocal rule.
 */
export type RestaurantDashboardStats = {
  activeAnnouncementsCount: number;
  assignedAnnouncementsCount: number;
  pendingWorkerApplicationsCount: number;
  receivedVisibleReviewsCount: number;
  averageReceivedRating: number | null;
  completedDistinctShiftsCount: number;
  totalShiftsCount: number;
  cancelledShiftsCount: number;
  topPositiveTag: string | null;
};

export const EMPTY_RESTAURANT_DASHBOARD_STATS: RestaurantDashboardStats = {
  activeAnnouncementsCount: 0,
  assignedAnnouncementsCount: 0,
  pendingWorkerApplicationsCount: 0,
  receivedVisibleReviewsCount: 0,
  averageReceivedRating: null,
  completedDistinctShiftsCount: 0,
  totalShiftsCount: 0,
  cancelledShiftsCount: 0,
  topPositiveTag: null,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeRestaurantDashboardStats(raw: unknown): RestaurantDashboardStats {
  const o = (raw ?? {}) as Record<string, unknown>;
  const avgRaw = o["averageReceivedRating"];
  const avg = avgRaw === null || avgRaw === undefined ? null : Number(avgRaw);
  return {
    activeAnnouncementsCount: num(o["activeAnnouncementsCount"]),
    assignedAnnouncementsCount: num(o["assignedAnnouncementsCount"]),
    pendingWorkerApplicationsCount: num(o["pendingWorkerApplicationsCount"]),
    receivedVisibleReviewsCount: num(o["receivedVisibleReviewsCount"]),
    averageReceivedRating: avg !== null && Number.isFinite(avg) ? avg : null,
    completedDistinctShiftsCount: num(o["completedDistinctShiftsCount"]),
    totalShiftsCount: num(o["totalShiftsCount"]),
    cancelledShiftsCount: num(o["cancelledShiftsCount"]),
    topPositiveTag: typeof o["topPositiveTag"] === "string" && o["topPositiveTag"] ? (o["topPositiveTag"] as string) : null,
  };
}

export async function fetchRestaurantDashboardStats(): Promise<RestaurantDashboardStats> {
  const { data, error } = await supabase.rpc("get_restaurant_dashboard_stats" as never);
  if (error) throw error;
  return normalizeRestaurantDashboardStats(data);
}

/** Plural-aware copy for the "reviews received" line. */
export function receivedReviewsLabel(count: number): string {
  if (count === 1) return "Per ora hai 1 recensione ricevuta";
  return `Per ora hai ${count} recensioni ricevute`;
}

const REFRESH_EVENT = "pupillo:restaurant-dashboard-stats-refresh";

/**
 * Explicit invalidation bridge: accept/reject, assignment, shift completion
 * and review submission emit this so every dashboard card refetches the
 * authoritative aggregates without a manual page refresh.
 */
export function emitRestaurantStatsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
}

export function onRestaurantStatsRefresh(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(REFRESH_EVENT, handler);
  return () => window.removeEventListener(REFRESH_EVENT, handler);
}
