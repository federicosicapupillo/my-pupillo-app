import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag `worker_special_availability_enabled` (scope: global).
 *
 * Semantica FAIL-CLOSED:
 *  - `loading` / `error` / `disabled` → sezione "Disponibilità speciali" NON
 *    disponibile (titolo, form, elenco e query non montati).
 *  - `enabled` → sezione "Disponibilità speciali" disponibile.
 *
 * Cache allineata a `use-referral-enabled.ts` / `use-worker-tax-code-enabled.ts`:
 *  - TTL breve (30s).
 *  - Dedup RPC concorrenti (una sola in flight), rimossa nel finally.
 *  - Invalidazione manuale via `invalidateWorkerSpecialAvailabilityFeatureFlag()`.
 *  - Invalidazione automatica su SIGNED_IN / SIGNED_OUT / USER_UPDATED.
 */
export type WorkerSpecialAvailabilityFlagStatus =
  | "loading"
  | "enabled"
  | "disabled"
  | "error";

const TTL_MS = 30_000;
const FLAG_KEY = "worker_special_availability_enabled";

type CacheEntry = { value: WorkerSpecialAvailabilityFlagStatus; expiresAt: number };
let cached: CacheEntry | null = null;
let inflight: Promise<WorkerSpecialAvailabilityFlagStatus> | null = null;
const listeners = new Set<(s: WorkerSpecialAvailabilityFlagStatus) => void>();

function notify(s: WorkerSpecialAvailabilityFlagStatus) {
  listeners.forEach((l) => l(s));
}

async function fetchFromServer(): Promise<WorkerSpecialAvailabilityFlagStatus> {
  try {
    const { data, error } = await supabase.rpc("is_feature_enabled", {
      _key: FLAG_KEY,
    });
    if (error) {
      console.warn("[worker_special_availability_enabled] flag read failed", error);
      return "error";
    }
    return data === true ? "enabled" : "disabled";
  } catch (e) {
    console.warn("[worker_special_availability_enabled] flag read threw", e);
    return "error";
  }
}

async function getFlag(force = false): Promise<WorkerSpecialAvailabilityFlagStatus> {
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

export function invalidateWorkerSpecialAvailabilityFeatureFlag(): void {
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

export function useWorkerSpecialAvailabilityEnabled(): {
  status: WorkerSpecialAvailabilityFlagStatus;
  /** True solo quando il flag è confermato `enabled`. Fail-closed. */
  isEnabled: boolean;
  /** True quando lo stato non è più `loading`. */
  loaded: boolean;
} {
  const [status, setStatus] = useState<WorkerSpecialAvailabilityFlagStatus>(() => {
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return "loading";
  });

  useEffect(() => {
    let cancelled = false;
    const onChange = (s: WorkerSpecialAvailabilityFlagStatus) => {
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