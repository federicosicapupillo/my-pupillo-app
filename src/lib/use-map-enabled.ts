import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag globali per la pagina Mappa. Comportamento FAIL-CLOSED:
 * durante il caricamento e in caso di errore RPC lo stato NON è "enabled",
 * così la UI non può montare la mappa né mostrare CTA temporanee.
 *
 * Stati esposti per ciascun ruolo:
 *  - "loading"  → RPC ancora in corso
 *  - "enabled"  → flag confermato attivo
 *  - "disabled" → flag confermato disattivato
 *  - "error"    → lettura RPC fallita (trattare come disattivato)
 */
export type MapFlagStatus = "loading" | "enabled" | "disabled" | "error";

export function useMapEnabled(): {
  workerStatus: MapFlagStatus;
  restaurantStatus: MapFlagStatus;
  loaded: boolean;
} {
  const [workerStatus, setWorkerStatus] = useState<MapFlagStatus>("loading");
  const [restaurantStatus, setRestaurantStatus] = useState<MapFlagStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, r] = await Promise.all([
          supabase.rpc("is_feature_enabled", { _key: "worker_map_enabled" }),
          supabase.rpc("is_feature_enabled", { _key: "restaurant_map_enabled" }),
        ]);
        if (cancelled) return;
        if (w.error) {
          console.warn("[map_enabled] worker flag read failed", w.error);
          setWorkerStatus("error");
        } else {
          setWorkerStatus(w.data === true ? "enabled" : "disabled");
        }
        if (r.error) {
          console.warn("[map_enabled] restaurant flag read failed", r.error);
          setRestaurantStatus("error");
        } else {
          setRestaurantStatus(r.data === true ? "enabled" : "disabled");
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[map_enabled] flag read threw", e);
          setWorkerStatus("error");
          setRestaurantStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loaded = workerStatus !== "loading" && restaurantStatus !== "loading";
  return { workerStatus, restaurantStatus, loaded };
}

/**
 * Stato del flag Mappa per il ruolo corrente. Admin bypassa i flag (mantiene
 * l'accesso agli strumenti amministrativi legati alla mappa).
 */
export function useMapEnabledForRole(role: string | null | undefined): MapFlagStatus {
  const { workerStatus, restaurantStatus } = useMapEnabled();
  if (role === "admin") return "enabled";
  if (role === "worker") return workerStatus;
  if (role === "restaurant") return restaurantStatus;
  // Utenti anonimi / ruoli sconosciuti: non abilitare mai.
  return "disabled";
}