/**
 * Privacy rule for showing worker names in restaurant-facing lists.
 *
 * - Default: show ONLY the first name (e.g. "Marco").
 * - Show the full last name only when there is a real link between worker
 *   and restaurant: an assigned/confirmed shift for this restaurant OR at
 *   least one past shift already completed/scheduled with this restaurant.
 *
 * A pending application, an open chat, a shortlist, a saved favorite or a
 * profile preview are NOT enough.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Shift statuses that count as "confirmed collaboration" between worker and
 * restaurant. A row in `shifts` only exists after the restaurant has
 * assigned/confirmed a worker, so both `scheduled` (upcoming confirmed turn)
 * and `completed` (past closed turn) qualify.
 */
export const COLLABORATED_SHIFT_STATUSES = ["scheduled", "completed"] as const;

/** Application statuses that mean "this worker is currently confirmed for this restaurant". */
export const CONFIRMED_APPLICATION_STATUSES = ["accepted"] as const;

/** Format a worker name applying the privacy rule. */
export function formatCandidateName(fullName: string | null | undefined, hasCollaborated: boolean): string {
  const raw = (fullName ?? "").trim();
  if (!raw) return "Lavoratore";
  if (hasCollaborated) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  return parts[0] || "Lavoratore";
}

/** Extract the first name from a full name string. */
export function firstNameOnly(fullName: string | null | undefined): string {
  const raw = (fullName ?? "").trim();
  if (!raw) return "Lavoratore";
  return raw.split(/\s+/)[0] || "Lavoratore";
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
 * Batch-load the set of worker IDs for which the restaurant is allowed to see
 * the full name. Includes:
 *  - workers with at least one scheduled/completed shift with this restaurant
 *  - workers currently assigned to one of this restaurant's announcements
 *  - workers whose application to this restaurant is already accepted
 */
export async function loadCollaboratedWorkerIds(restaurantId: string): Promise<Set<string>> {
  if (!restaurantId) return new Set();
  const ids = new Set<string>();
  const [shiftsRes, annRes, appsRes] = await Promise.all([
    supabase
      .from("shifts")
      .select("worker_id")
      .eq("restaurant_id", restaurantId)
      .in("status", COLLABORATED_SHIFT_STATUSES as unknown as any),
    supabase
      .from("announcements")
      .select("assigned_worker_id")
      .eq("restaurant_id", restaurantId)
      .not("assigned_worker_id", "is", null),
    supabase
      .from("applications")
      .select("worker_id")
      .eq("restaurant_id", restaurantId)
      .in("status", CONFIRMED_APPLICATION_STATUSES as unknown as any),
  ]);
  for (const r of (shiftsRes.data ?? []) as any[]) if (r.worker_id) ids.add(r.worker_id);
  for (const r of (annRes.data ?? []) as any[]) if (r.assigned_worker_id) ids.add(r.assigned_worker_id);
  for (const r of (appsRes.data ?? []) as any[]) if (r.worker_id) ids.add(r.worker_id);
  return ids;
}