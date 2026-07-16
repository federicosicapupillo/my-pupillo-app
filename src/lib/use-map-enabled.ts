import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Legge i feature flag globali `worker_map_enabled` e `restaurant_map_enabled`.
 *
 * Default SAFE-ON (true) coerente col seed dei flag: evita che la voce "Mappa"
 * lampeggi e scompaia al primo caricamento se la rete è lenta. Se il backend
 * risponde con false, il valore viene aggiornato di conseguenza.
 */
export function useMapEnabled(): {
  workerEnabled: boolean;
  restaurantEnabled: boolean;
  loaded: boolean;
} {
  const [workerEnabled, setWorkerEnabled] = useState<boolean>(true);
  const [restaurantEnabled, setRestaurantEnabled] = useState<boolean>(true);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, r] = await Promise.all([
          supabase.rpc("is_feature_enabled", { _key: "worker_map_enabled" }),
          supabase.rpc("is_feature_enabled", { _key: "restaurant_map_enabled" }),
        ]);
        if (cancelled) return;
        if (!w.error) setWorkerEnabled(w.data === true);
        else console.warn("[map_enabled] worker flag read failed", w.error);
        if (!r.error) setRestaurantEnabled(r.data === true);
        else console.warn("[map_enabled] restaurant flag read failed", r.error);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          console.warn("[map_enabled] flag read threw", e);
          setLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { workerEnabled, restaurantEnabled, loaded };
}