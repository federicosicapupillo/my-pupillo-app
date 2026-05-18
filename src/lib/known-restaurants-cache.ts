// Cache locale dei ristoranti "conosciuti" da un lavoratore (turni effettuati
// o candidature accettate). Serve a evitare due query a Supabase ogni volta
// che la pagina Mappa viene aperta. La cache è per-utente e ha un TTL breve.
//
// Sicurezza: contiene solo UUID di ristoranti; nessun dato sensibile.

const KEY_PREFIX = "pupillo.knownRestaurants.v1.";
const TTL_MS = 5 * 60 * 1000; // 5 minuti

type Payload = { ids: string[]; ts: number };

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function readKnownRestaurantsCache(userId: string): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Payload;
    if (!p || !Array.isArray(p.ids) || typeof p.ts !== "number") return null;
    if (Date.now() - p.ts > TTL_MS) return null;
    return new Set(p.ids);
  } catch {
    return null;
  }
}

export function writeKnownRestaurantsCache(userId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Payload = { ids: Array.from(ids), ts: Date.now() };
    window.localStorage.setItem(key(userId), JSON.stringify(payload));
  } catch {
    /* quota / disabled storage: ignora */
  }
}

export function clearKnownRestaurantsCache(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.removeItem(key(userId));
      return;
    }
    // Pulisce tutte le voci v1 (es. al logout di utenti multipli)
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    /* ignora */
  }
}
