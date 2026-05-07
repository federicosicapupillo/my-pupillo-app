export type GeocodeError =
  | { kind: "empty_query" }
  | { kind: "no_results" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "network"; message: string }
  | { kind: "aborted" };

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; displayName: string }
  | { ok: false; error: GeocodeError };

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

async function attempt(address: string, signal?: AbortSignal): Promise<GeocodeResult> {
  const url = `${ENDPOINT}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "Accept-Language": "it" }, signal });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: { kind: "aborted" } };
    }
    return { ok: false, error: { kind: "network", message: e instanceof Error ? e.message : "Errore di rete" } };
  }
  if (res.status === 429 || res.status === 503) {
    const retry = parseInt(res.headers.get("retry-after") ?? "1", 10);
    return { ok: false, error: { kind: "rate_limited", retryAfterMs: Math.max(1, retry) * 1000 } };
  }
  if (!res.ok) {
    return { ok: false, error: { kind: "network", message: `HTTP ${res.status}` } };
  }
  let data: Array<{ lat: string; lon: string; display_name: string }>;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: { kind: "network", message: "Risposta non valida dal servizio mappe" } };
  }
  if (!data[0]) return { ok: false, error: { kind: "no_results" } };
  return { ok: true, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}

/**
 * Geocode an address with up to `maxAttempts` retries (exponential backoff).
 * Empty queries and "no results" do NOT retry — they are deterministic.
 */
export async function geocodeAddressWithRetry(
  address: string,
  opts: { maxAttempts?: number; signal?: AbortSignal; onAttempt?: (n: number) => void } = {},
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (trimmed.length < 3) return { ok: false, error: { kind: "empty_query" } };

  const maxAttempts = opts.maxAttempts ?? 3;
  let lastError: GeocodeError = { kind: "network", message: "Sconosciuto" };

  for (let i = 1; i <= maxAttempts; i++) {
    opts.onAttempt?.(i);
    const r = await attempt(trimmed, opts.signal);
    if (r.ok) return r;
    if (r.error.kind === "empty_query" || r.error.kind === "no_results" || r.error.kind === "aborted") {
      return r;
    }
    lastError = r.error;
    if (i < maxAttempts) {
      const wait = r.error.kind === "rate_limited" ? r.error.retryAfterMs : 500 * 2 ** (i - 1);
      await new Promise((res) => setTimeout(res, wait));
      if (opts.signal?.aborted) return { ok: false, error: { kind: "aborted" } };
    }
  }
  return { ok: false, error: lastError };
}

export function describeGeocodeError(err: GeocodeError): string {
  switch (err.kind) {
    case "empty_query": return "Inserisci un indirizzo più completo.";
    case "no_results": return "Indirizzo non trovato. Aggiungi città o CAP.";
    case "rate_limited": return "Servizio mappe sovraccarico, riprovo…";
    case "network": return `Errore di rete: ${err.message}. Riprovo…`;
    case "aborted": return "";
  }
}

// Backwards-compatible helper (no retry, returns null on failure)
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const r = await geocodeAddressWithRetry(address, { maxAttempts: 1 });
  return r.ok ? { lat: r.lat, lng: r.lng } : null;
}
