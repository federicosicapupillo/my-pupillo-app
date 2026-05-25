/**
 * Privacy helpers for displaying worker identity to restaurants.
 *
 * Rule (Pupillo): a restaurant may see a worker's real first + last name
 * ONLY if the worker has already completed at least one shift with that
 * restaurant. Until then we must hide the real name and show a neutral
 * role-based label (e.g. "Cameriere verificato").
 */

import { supabase } from "@/integrations/supabase/client";

/** Build a role-based anonymous label, e.g. "Cameriere verificato". */
export function verifiedRoleLabel(role: string | null | undefined): string {
  const r = (role ?? "").trim();
  if (!r) return "Profilo verificato";
  const cap = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  return `${cap} verificato`;
}

/**
 * Return the worker name the restaurant is allowed to see.
 * - hasWorkedTogether === true → real full_name (or first name only if missing).
 * - otherwise → role-based "verificato" label.
 */
export function displayWorkerName(
  w: { full_name: string | null; primary_role: string | null },
  hasWorkedTogether: boolean,
): string {
  if (hasWorkedTogether) {
    const n = (w.full_name ?? "").trim();
    if (n) return n;
  }
  return verifiedRoleLabel(w.primary_role);
}

/**
 * Set of worker ids that have at least one COMPLETED shift with the given
 * restaurant. This is the only signal that authorizes showing the worker's
 * real first + last name to that restaurant.
 */
export async function loadWorkedTogetherWorkerIds(restaurantId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!restaurantId) return ids;
  const { data, error } = await supabase
    .from("shifts")
    .select("worker_id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed");
  if (error) return ids;
  for (const row of (data ?? []) as Array<{ worker_id: string | null }>) {
    if (row.worker_id) ids.add(row.worker_id);
  }
  return ids;
}

/** True iff the given worker has a completed shift with the given restaurant. */
export async function hasWorkedTogether(workerId: string, restaurantId: string): Promise<boolean> {
  if (!workerId || !restaurantId) return false;
  const { data, error } = await supabase
    .from("shifts")
    .select("id")
    .eq("worker_id", workerId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}