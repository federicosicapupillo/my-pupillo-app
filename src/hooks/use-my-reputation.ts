import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reputation stats of the CURRENT user, read live from the database.
 *
 * The auth context caches the profile row at login, so aggregates recomputed
 * later by the DB (rating_avg, reviews_count, completed_shifts, completion_pct,
 * reputation_score/level…) stayed at their stale login values — typically 0 —
 * even after a review unlocked. This hook re-reads `get_my_profile()` on mount
 * and whenever the tab regains focus, so the reputation blocks always show the
 * values the database actually computed.
 */
export type MyReputationStats = {
  rating_avg: number | null;
  reviews_count: number | null;
  completed_shifts: number | null;
  completion_pct: number | null;
  reliability_pct: number | null;
  punctuality_pct: number | null;
  no_show_count: number | null;
  reputation_score: number | null;
  reputation_level: string | null;
  rehire_yes_count: number | null;
  rehire_total_answers: number | null;
  rehire_restaurants_count: number | null;
  distinct_restaurants_count: number | null;
};

export function useMyReputation(enabled: boolean) {
  const [stats, setStats] = useState<MyReputationStats | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();
    if (error || !data) return;
    setStats(data as unknown as MyReputationStats);
  }, [enabled]);

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  return { stats, reload: load };
}
