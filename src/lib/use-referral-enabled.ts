import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag "Presenta un amico". Comportamento FAIL-CLOSED:
 * loading / error → NON "enabled". La UI non monta card né CTA,
 * nessuna query referral parte.
 *
 * Cache:
 *  - TTL breve (30s) sul valore risolto.
 *  - Deduplica RPC concorrenti: la stessa Promise pending viene condivisa,
 *    ma viene rimossa non appena si risolve (niente Promise "eterne").
 *  - Invalidazione manuale via `invalidateReferralFeatureFlags()`
 *    (chiamata dal pannello admin dopo il toggle).
 *  - Invalidazione automatica su SIGNED_OUT.
 *  - Nessun fallback a "enabled" in caso di errore.
 */
export type ReferralFlagStatus = "loading" | "enabled" | "disabled" | "error";

type State = {
  workerStatus: ReferralFlagStatus;
  restaurantStatus: ReferralFlagStatus;
};

const TTL_MS = 30_000;

type CacheEntry = { value: State; expiresAt: number };
let cached: CacheEntry | null = null;
let inflight: Promise<State> | null = null;
const listeners = new Set<(s: State) => void>();

function notify(s: State) {
  listeners.forEach((l) => l(s));
}

async function fetchFlagsFromServer(): Promise<State> {
  let workerStatus: ReferralFlagStatus = "error";
  let restaurantStatus: ReferralFlagStatus = "error";
  try {
    const [w, r] = await Promise.all([
      supabase.rpc("is_feature_enabled", { _key: "worker_referral_enabled" }),
      supabase.rpc("is_feature_enabled", { _key: "restaurant_referral_enabled" }),
    ]);
    if (w.error) {
      console.warn("[referral_enabled] worker flag read failed", w.error);
    } else {
      workerStatus = w.data === true ? "enabled" : "disabled";
    }
    if (r.error) {
      console.warn("[referral_enabled] restaurant flag read failed", r.error);
    } else {
      restaurantStatus = r.data === true ? "enabled" : "disabled";
    }
  } catch (e) {
    console.warn("[referral_enabled] flag read threw", e);
  }
  return { workerStatus, restaurantStatus };
}

async function getFlags(force = false): Promise<State> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const next = await fetchFlagsFromServer();
      cached = { value: next, expiresAt: Date.now() + TTL_MS };
      notify(next);
      return next;
    } finally {
      // La Promise pending NON deve restare in cache oltre la sua risoluzione.
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Invalidazione esplicita: azzera la cache e forza una nuova RPC al prossimo
 * consumo. Da usare dopo il salvataggio di un flag nel pannello admin
 * o quando si vuole "vedere" subito un cambio remoto.
 */
export function invalidateReferralFeatureFlags(): void {
  cached = null;
  inflight = null;
  // Forziamo un refetch immediato per aggiornare i consumer già montati.
  void getFlags(true);
}

// Invalida automaticamente la cache al logout (o al cambio utente),
// così un nuovo login non eredita un valore altrui / stantio.
if (typeof window !== "undefined") {
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        cached = null;
        inflight = null;
        // In SIGNED_OUT non facciamo refetch: attendiamo il prossimo mount.
        if (event !== "SIGNED_OUT") void getFlags(true);
        else notify({ workerStatus: "loading", restaurantStatus: "loading" });
      }
    });
  } catch {
    /* no-op */
  }
}

export function useReferralEnabled(): State & { loaded: boolean } {
  const [state, setState] = useState<State>(() => {
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return { workerStatus: "loading", restaurantStatus: "loading" };
  });

  useEffect(() => {
    let cancelled = false;
    const onChange = (s: State) => {
      if (!cancelled) setState(s);
    };
    listeners.add(onChange);

    // Rilettura al mount / navigazione se la cache è scaduta o assente.
    const fresh = cached && cached.expiresAt > Date.now();
    if (fresh) {
      setState(cached!.value);
    } else {
      void getFlags().then((s) => {
        if (!cancelled) setState(s);
      });
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
 * Admin: bypass (per amministrare la funzionalità).
 * Altri ruoli o ruolo non definito: sempre "disabled".
 */
export function useReferralEnabledForRole(
  role: string | null | undefined,
): ReferralFlagStatus {
  const { workerStatus, restaurantStatus } = useReferralEnabled();
  if (role === "admin") return "enabled";
  if (role === "worker") return workerStatus;
  if (role === "restaurant") return restaurantStatus;
  return "disabled";
}
