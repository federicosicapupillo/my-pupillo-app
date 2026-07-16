import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag globali per "Presenta un amico". Comportamento FAIL-CLOSED:
 * durante il caricamento e in caso di errore RPC lo stato NON è "enabled",
 * così la UI non monta né card né CTA e nessuna query referral parte.
 *
 * Stati esposti per ciascun ruolo:
 *  - "loading"  → RPC ancora in corso
 *  - "enabled"  → flag confermato attivo
 *  - "disabled" → flag confermato disattivato
 *  - "error"    → lettura RPC fallita (trattare come disattivato)
 */
export type ReferralFlagStatus = "loading" | "enabled" | "disabled" | "error";

type State = {
  workerStatus: ReferralFlagStatus;
  restaurantStatus: ReferralFlagStatus;
};

// Cache modulo condivisa: la stessa risposta viene riusata da tutti i consumer
// nello stesso ciclo di vita dell'app, evitando RPC duplicate.
let cached: State | null = null;
let inflight: Promise<State> | null = null;
const listeners = new Set<(s: State) => void>();

async function fetchFlags(): Promise<State> {
  if (inflight) return inflight;
  inflight = (async () => {
    let workerStatus: ReferralFlagStatus = "error";
    let restaurantStatus: ReferralFlagStatus = "error";
    try {
      const [w, r] = await Promise.all([
        supabase.rpc("is_feature_enabled", { _key: "worker_referral_enabled" }),
        supabase.rpc("is_feature_enabled", { _key: "restaurant_referral_enabled" }),
      ]);
      if (w.error) {
        console.warn("[referral_enabled] worker flag read failed", w.error);
        workerStatus = "error";
      } else {
        workerStatus = w.data === true ? "enabled" : "disabled";
      }
      if (r.error) {
        console.warn("[referral_enabled] restaurant flag read failed", r.error);
        restaurantStatus = "error";
      } else {
        restaurantStatus = r.data === true ? "enabled" : "disabled";
      }
    } catch (e) {
      console.warn("[referral_enabled] flag read threw", e);
      workerStatus = "error";
      restaurantStatus = "error";
    }
    const next: State = { workerStatus, restaurantStatus };
    cached = next;
    listeners.forEach((l) => l(next));
    return next;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useReferralEnabled(): State & { loaded: boolean } {
  const [state, setState] = useState<State>(() =>
    cached ?? { workerStatus: "loading", restaurantStatus: "loading" }
  );

  useEffect(() => {
    let cancelled = false;
    const onChange = (s: State) => {
      if (!cancelled) setState(s);
    };
    listeners.add(onChange);
    if (cached) {
      setState(cached);
    } else {
      void fetchFlags();
    }
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, []);

  const loaded =
    state.workerStatus !== "loading" && state.restaurantStatus !== "loading";
  return { ...state, loaded };
}

/**
 * Stato del flag "Presenta un amico" per il ruolo corrente.
 * Admin: bypass consentito, per poter verificare/amministrare la funzionalità.
 * Altri ruoli o ruolo non definito: sempre "disabled".
 */
export function useReferralEnabledForRole(
  role: string | null | undefined
): ReferralFlagStatus {
  const { workerStatus, restaurantStatus } = useReferralEnabled();
  if (role === "admin") return "enabled";
  if (role === "worker") return workerStatus;
  if (role === "restaurant") return restaurantStatus;
  return "disabled";
}