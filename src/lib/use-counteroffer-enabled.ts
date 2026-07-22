import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag `counteroffer_enabled` (scope: global).
 *
 * Semantica FAIL-CLOSED:
 *  - `loading` / `error` / `disabled` → funzionalità controfferta NON
 *    disponibile (bottoni nascosti, dialog non montato, listener non
 *    attivi).
 *  - `enabled` → funzionalità controfferta disponibile.
 *
 * Cache allineata a `use-referral-enabled.ts` / `use-worker-tax-code-enabled.ts`:
 *  - TTL breve (30s).
 *  - Dedup RPC concorrenti (una sola in flight), rimossa nel finally.
 *  - Invalidazione manuale via `invalidateCounterofferFeatureFlag()`.
 *  - Invalidazione automatica su SIGNED_IN / SIGNED_OUT / USER_UPDATED.
 */
export type CounterofferFlagStatus =
  | "loading"
  | "enabled"
  | "disabled"
  | "error";

const TTL_MS = 30_000;
const FLAG_KEY = "counteroffer_enabled";

type CacheEntry = { value: CounterofferFlagStatus; expiresAt: number };
let cached: CacheEntry | null = null;
let inflight: Promise<CounterofferFlagStatus> | null = null;
const listeners = new Set<(s: CounterofferFlagStatus) => void>();

function notify(s: CounterofferFlagStatus) {
  listeners.forEach((l) => l(s));
}

async function fetchFromServer(): Promise<CounterofferFlagStatus> {
  try {
    const { data, error } = await supabase.rpc("is_feature_enabled", {
      _key: FLAG_KEY,
    });
    if (error) {
      console.warn("[counteroffer_enabled] flag read failed", error);
      return "error";
    }
    return data === true ? "enabled" : "disabled";
  } catch (e) {
    console.warn("[counteroffer_enabled] flag read threw", e);
    return "error";
  }
}

async function getFlag(force = false): Promise<CounterofferFlagStatus> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const next = await fetchFromServer();
      cached = { value: next, expiresAt: Date.now() + TTL_MS };
      notify(next);
      return next;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function invalidateCounterofferFeatureFlag(): void {
  cached = null;
  inflight = null;
  void getFlag(true);
}

if (typeof window !== "undefined") {
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_OUT" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        cached = null;
        inflight = null;
        if (event !== "SIGNED_OUT") void getFlag(true);
        else notify("loading");
      }
    });
  } catch {
    /* no-op */
  }
}

export function useCounterofferEnabled(): {
  status: CounterofferFlagStatus;
  /** True solo quando il flag è confermato `enabled`. Fail-closed. */
  isEnabled: boolean;
  /** True quando lo stato non è più `loading`. */
  loaded: boolean;
} {
  const [status, setStatus] = useState<CounterofferFlagStatus>(() => {
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return "loading";
  });

  useEffect(() => {
    let cancelled = false;
    const onChange = (s: CounterofferFlagStatus) => {
      if (!cancelled) setStatus(s);
    };
    listeners.add(onChange);

    const fresh = cached && cached.expiresAt > Date.now();
    if (fresh) {
      setStatus(cached!.value);
    } else {
      void getFlag().then((s) => {
        if (!cancelled) setStatus(s);
      });
    }

    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, []);

  return {
    status,
    isEnabled: status === "enabled",
    loaded: status !== "loading",
  };
}