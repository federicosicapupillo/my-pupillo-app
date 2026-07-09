import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the global `available_now_enabled` feature flag.
 *
 * Fallback SAFE-OFF: la sezione "Disponibile ora" resta nascosta finché non
 * confermiamo dal backend che il flag è acceso. Coerente col default di
 * creazione del flag (false) e con l'intento del prodotto di poter nascondere
 * rapidamente questa funzione senza rilasci.
 */
export function useAvailableNowEnabled(): { enabled: boolean; loaded: boolean } {
  const [enabled, setEnabled] = useState<boolean>(false); // SAFE-OFF
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_feature_enabled", {
          _key: "available_now_enabled",
        });
        if (cancelled) return;
        if (error) {
          console.warn("[available_now_enabled] flag read failed", error);
          setLoaded(true);
          return;
        }
        setEnabled(data === true);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          console.warn("[available_now_enabled] flag read threw", e);
          setLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { enabled, loaded };
}
