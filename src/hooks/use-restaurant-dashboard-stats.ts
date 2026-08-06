import { useCallback, useEffect, useState } from "react";
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
    return () => {
      cancelled = true;
      off();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reload]);

  return { stats, loading, reload };
}
