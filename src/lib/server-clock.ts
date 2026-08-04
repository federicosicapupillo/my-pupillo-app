/**
 * Offset fra orologio del server (fonte di verità) e orologio del dispositivo.
 *
 * Il database resta l'unica autorità sulla scadenza (trigger + RPC), ma la UI
 * deve mostrare lo stato corretto anche su un dispositivo con l'ora sbagliata.
 * All'avvio leggiamo `server_now()` e memorizziamo la differenza; tutti i
 * confronti temporali di prodotto usano `serverNow()` invece di `new Date()`.
 */
let offsetMs = 0;
let synced = false;

/** Differenza (ms) da sommare all'orologio locale per ottenere l'ora server. */
export function getClockOffsetMs(): number {
  return offsetMs;
}

export function isClockSynced(): boolean {
  return synced;
}

/**
 * Registra l'offset a partire dall'ora server osservata.
 * `roundTripMs` compensa metà latenza di rete.
 */
export function setServerNow(serverNowIso: string | number | Date, roundTripMs = 0): number {
  const serverMs = new Date(serverNowIso as any).getTime();
  if (!Number.isFinite(serverMs)) return offsetMs;
  offsetMs = serverMs + roundTripMs / 2 - Date.now();
  synced = true;
  return offsetMs;
}

/** Solo per i test. */
export function resetServerClock(): void {
  offsetMs = 0;
  synced = false;
}

/** Ora corrente corretta con l'offset del server. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}
