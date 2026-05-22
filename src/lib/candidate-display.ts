/**
 * Privacy rule for showing worker names in restaurant-facing lists.
 *
 * - Default: show first name + initial of last name (e.g. "Marco R.").
 * - Only if the worker has at least one COMPLETED shift with this restaurant
 *   we expose the full last name.
 *
 * A pending application, an open chat or an accepted-but-not-yet-completed
 * shift are NOT enough.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Shift statuses that count as "real collaboration" between worker and
 * restaurant. In the Pupillo schema the only status that represents a
 * shift actually performed and closed is `completed`. We keep this as a
 * single source of truth so the rule can evolve if new statuses are added.
 */
export const COLLABORATED_SHIFT_STATUSES = ["completed"] as const;

/** Format a worker name applying the privacy rule. */
export function formatCandidateName(fullName: string | null | undefined, hasCollaborated: boolean): string {
  const raw = (fullName ?? "").trim();
  if (!raw) return "Lavoratore";
  if (hasCollaborated) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

/**
 * Returns true if the given worker has at least one completed shift with the
 * given restaurant. In case of doubt (errors, missing data) returns false so
 * the caller falls back to the privacy-safe abbreviation.
 */
export async function hasCompletedShiftWithRestaurant(
  workerId: string,
  restaurantId: string,
): Promise<boolean> {
  if (!workerId || !restaurantId) return false;
  const { data, error } = await supabase
    .from("shifts")
    .select("id")
    .eq("worker_id", workerId)
    .eq("restaurant_id", restaurantId)
    .in("status", COLLABORATED_SHIFT_STATUSES as unknown as any)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Batch-load the set of worker IDs that have already completed at least one
 * shift with the given restaurant. Used to drive both the name privacy rule
 * and the "Già collaboratore" badge in lists.
 */
export async function loadCollaboratedWorkerIds(restaurantId: string): Promise<Set<string>> {
  if (!restaurantId) return new Set();
  const { data, error } = await supabase
    .from("shifts")
    .select("worker_id")
    .eq("restaurant_id", restaurantId)
    .in("status", COLLABORATED_SHIFT_STATUSES as unknown as any);
  if (error || !data) return new Set();
  return new Set(data.map((r: any) => r.worker_id).filter(Boolean));
}