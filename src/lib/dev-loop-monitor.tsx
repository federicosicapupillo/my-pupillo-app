import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Dev-only: misura quante volte vengono eseguiti refetch (TanStack Query)
// e subscribe/unsubscribe ai canali Realtime di Supabase per pagina.
// Output: console.table al cambio di route + window.__loopStats() su richiesta.

type Counter = Record<string, number>;

interface RouteStats {
  path: string;
  enteredAt: number;
  fetches: Counter;          // queryKey -> count
  observersAdded: Counter;
  observersRemoved: Counter;
  channelSubscribes: Counter; // channel topic -> count
  channelRemoves: Counter;
}

function makeStats(path: string): RouteStats {
  return {
    path,
    enteredAt: Date.now(),
    fetches: {},
    observersAdded: {},
    observersRemoved: {},
    channelSubscribes: {},
    channelRemoves: {},
  };
}

function bump(c: Counter, key: string) {
  c[key] = (c[key] ?? 0) + 1;
}

function summarize(s: RouteStats) {
  const dur = ((Date.now() - s.enteredAt) / 1000).toFixed(1) + "s";
  const totalFetches = Object.values(s.fetches).reduce((a, b) => a + b, 0);
  const totalSubs = Object.values(s.channelSubscribes).reduce((a, b) => a + b, 0);
  const totalUnsubs = Object.values(s.channelRemoves).reduce((a, b) => a + b, 0);
  return { path: s.path, durata: dur, refetch_totali: totalFetches, channel_subscribe: totalSubs, channel_remove: totalUnsubs };
}

let current: RouteStats | null = null;
const history: RouteStats[] = [];
let supabasePatched = false;

function patchSupabaseOnce() {
  if (supabasePatched) return;
  supabasePatched = true;
  try {
    // Forza l'inizializzazione del client reale tramite il Proxy
    const real = (supabase as unknown as { channel: Function; removeChannel: Function });
    const origChannel = real.channel.bind(real);
    const origRemove = real.removeChannel.bind(real);

    (real as { channel: Function }).channel = function (topic: string, ...rest: unknown[]) {
      if (current) bump(current.channelSubscribes, topic);
      // eslint-disable-next-line no-console
      console.debug("[loop-monitor] supabase.channel()", topic);
      return origChannel(topic, ...rest);
    };
    (real as { removeChannel: Function }).removeChannel = function (ch: { topic?: string }) {
      const topic = ch?.topic ?? "(unknown)";
      if (current) bump(current.channelRemoves, topic);
      // eslint-disable-next-line no-console
      console.debug("[loop-monitor] supabase.removeChannel()", topic);
      return origRemove(ch);
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[loop-monitor] impossibile patchare supabase channels", e);
  }
}

function keyToString(key: unknown): string {
  try { return JSON.stringify(key); } catch { return String(key); }
}

export function DevLoopMonitor() {
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const prevPath = useRef<string | null>(null);

  // Patch globali una sola volta
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    patchSupabaseOnce();

    const cache = qc.getQueryCache();
    const unsub = cache.subscribe((evt) => {
      if (!current) return;
      const k = keyToString(evt.query.queryKey);
      if (evt.type === "updated") {
        // Conta solo l'inizio di un fetch (fetchStatus passa a "fetching")
        const meta = (evt as unknown as { action?: { type?: string } }).action;
        if (meta?.type === "fetch") bump(current.fetches, k);
      } else if (evt.type === "observerAdded") {
        bump(current.observersAdded, k);
      } else if (evt.type === "observerRemoved") {
        bump(current.observersRemoved, k);
      }
    });

    // Esponi helper in console
    (window as unknown as { __loopStats: () => void }).__loopStats = () => {
      // eslint-disable-next-line no-console
      console.group("[loop-monitor] storico pagine");
      // eslint-disable-next-line no-console
      console.table([...history, current].filter(Boolean).map((s) => summarize(s as RouteStats)));
      // eslint-disable-next-line no-console
      console.log("Dettaglio pagina corrente:", current);
      // eslint-disable-next-line no-console
      console.groupEnd();
    };
    // eslint-disable-next-line no-console
    console.info("[loop-monitor] attivo. In console: __loopStats()");

    return () => { unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotazione delle statistiche al cambio di path
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (prevPath.current === path) return;
    if (current) {
      history.push(current);
      // Avvisa solo se il numero di refetch è anomalo
      const tot = Object.values(current.fetches).reduce((a, b) => a + b, 0);
      const noisy = Object.entries(current.fetches).filter(([, n]) => n >= 5);
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `[loop-monitor] ${current.path} → ${path}  (refetch tot: ${tot}${noisy.length ? ", possibili loop ⚠️" : ""})`,
      );
      // eslint-disable-next-line no-console
      console.table(summarize(current));
      if (noisy.length) {
        // eslint-disable-next-line no-console
        console.warn("Query con ≥5 fetch in una sola pagina:", Object.fromEntries(noisy));
      }
      if (Object.keys(current.channelSubscribes).length) {
        // eslint-disable-next-line no-console
        console.log("Realtime subscribe:", current.channelSubscribes);
        // eslint-disable-next-line no-console
        console.log("Realtime remove:   ", current.channelRemoves);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
    current = makeStats(path);
    prevPath.current = path;
  }, [path]);

  return null;
}