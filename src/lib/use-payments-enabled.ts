import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the global `payments_enabled` feature flag.
 *
 * Fallback SICURO: `true` (pagamenti attivi) sia mentre carica sia se la RPC
 * fallisce. Meglio mostrare il paywall per errore che regalare le conferme
 * per un problema di rete. Speculare al pattern `require_id_document` (C2).
 *
 * Il backend (`public.consume_credits`) legge lo stesso flag e, se OFF, non
 * scala crediti e scrive una riga di audit `delta=0` per l'idempotenza. Il
 * frontend deve solo evitare i gate lato UI (check saldo, dialog crediti
 * insufficienti, bottoni disabilitati, schede acquisto) quando il flag è OFF.
 */
export function usePaymentsEnabled(): { enabled: boolean; loaded: boolean } {
  const [enabled, setEnabled] = useState<boolean>(true); // SAFE-ON
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_feature_enabled", {
          _key: "payments_enabled",
        });
        if (cancelled) return;
        if (error) {
          console.warn("[payments_enabled] flag read failed", error);
          setLoaded(true);
          return; // keep SAFE-ON default
        }
        setEnabled(data === false ? false : true);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          console.warn("[payments_enabled] flag read threw", e);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loaded };
}