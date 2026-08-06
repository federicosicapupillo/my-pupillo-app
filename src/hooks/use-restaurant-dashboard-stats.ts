import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createDebouncedReload } from "@/lib/inbox-realtime";
import {
  EMPTY_RESTAURANT_DASHBOARD_STATS,
  fetchRestaurantDashboardStats,
  onRestaurantStatsRefresh,
  type RestaurantDashboardStats,
} from "@/lib/restaurant-dashboard-stats";

/**
 * Subscribes to the authoritative restaurant dashboard aggregates.
 * Refetches on mount, on the explicit refresh event and when the tab
 * becomes visible again (back/forward navigation, mobile app switch).
 */
export function useRestaurantDashboardStats(enabled: boolean) {
  const [stats, setStats] = useState<RestaurantDashboardStats>(EMPTY_RESTAURANT_DASHBOARD_STATS);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const s = await fetchRestaurantDashboardStats();
      setStats(s);
    } catch {
      /* keep previous values on transient errors */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    void (async () => { if (!cancelled) await reload(); })();
    const off = onRestaurantStatsRefresh(() => { void reload(); });
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    // Realtime: applications (accept/reject), shifts (assignment/completion)
    // and reviews (received or made visible) all change the aggregates.
    // Debounced so retries or duplicate events cannot double-trigger.
    const reloader = createDebouncedReload(() => { void reload(); }, 350);
    const ch = supabase
      .channel(`restaurant-dashboard-stats-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => reloader.schedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => reloader.schedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => reloader.schedule())
      .subscribe();
    return () => {
      cancelled = true;
      off();
      reloader.cancel();
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reload]);

  return { stats, loading, reload };
}
