import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flag `worker_tax_code_enabled` (scope: global).
 *
 * Semantica FAIL-CLOSED rispetto alla VISUALIZZAZIONE del campo:
 *  - `loading` / `error` / `disabled` → NON mostrare né richiedere il
 *    Codice Fiscale (il flusso deve poter proseguire senza).
 *  - `enabled` → il campo viene mostrato e validato come oggi.
 *
 * Un errore nella lettura del flag NON deve bloccare il completamento
 * dell'onboarding, quindi il CF è considerato obbligatorio SOLO se
 * lo stato è `enabled`.
 *
 * Cache allineata a `use-referral-enabled.ts`:
 *  - TTL breve (30s) sul valore risolto.
 *  - Deduplica RPC concorrenti (una sola in flight per la stessa chiave),
 *    con rimozione immediata della Promise pending alla risoluzione.
 *  - Invalidazione manuale via `invalidateWorkerTaxCodeFeatureFlag()`
 *    (chiamata dal pannello admin dopo il toggle).
 *  - Invalidazione automatica su SIGNED_OUT / SIGNED_IN / USER_UPDATED.
 */
export type WorkerTaxCodeFlagStatus =
  | "loading"
  | "enabled"
  | "disabled"
  | "error";

const TTL_MS = 30_000;
const FLAG_KEY = "worker_tax_code_enabled";

type CacheEntry = { value: WorkerTaxCodeFlagStatus; expiresAt: number };
let cached: CacheEntry | null = null;
let inflight: Promise<WorkerTaxCodeFlagStatus> | null = null;
const listeners = new Set<(s: WorkerTaxCodeFlagStatus) => void>();

function notify(s: WorkerTaxCodeFlagStatus) {
  listeners.forEach((l) => l(s));
}

async function fetchFromServer(): Promise<WorkerTaxCodeFlagStatus> {
  try {
    const { data, error } = await supabase.rpc("is_feature_enabled", {
      _key: FLAG_KEY,
    });
    if (error) {
      console.warn("[worker_tax_code_enabled] flag read failed", error);
      return "error";
    }
    return data === true ? "enabled" : "disabled";
  } catch (e) {
    console.warn("[worker_tax_code_enabled] flag read threw", e);
    return "error";
  }
}

async function getFlag(force = false): Promise<WorkerTaxCodeFlagStatus> {
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

/**
 * Azzeramento cache + refetch immediato. Da usare dopo il salvataggio del
 * flag nel pannello admin per propagare subito il nuovo valore ai consumer
 * già montati.
 */
export function invalidateWorkerTaxCodeFeatureFlag(): void {
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

export function useWorkerTaxCodeEnabled(): {
  status: WorkerTaxCodeFlagStatus;
  /** True solo quando il flag è confermato `enabled`. Fail-closed. */
  isEnabled: boolean;
  /** True quando lo stato non è più `loading`. */
  loaded: boolean;
} {
  const [status, setStatus] = useState<WorkerTaxCodeFlagStatus>(() => {
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    return "loading";
  });

  useEffect(() => {
    let cancelled = false;
    const onChange = (s: WorkerTaxCodeFlagStatus) => {
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