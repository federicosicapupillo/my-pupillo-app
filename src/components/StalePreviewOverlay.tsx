import { useEffect, useState } from "react";

const SIGNATURE = "Worker bundle not found";
const COUNTDOWN_SECONDS = 5;

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.endsWith(".lovable.app") && h.includes("preview");
}

export function StalePreviewOverlay() {
  const [stale, setStale] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!isPreviewHost()) return;

    const trigger = () => setStale((s) => s || true);

    // Wrap fetch to detect proxy 404s mentioning the missing worker bundle.
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      try {
        if (res.status === 404) {
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("text/html") || ct.includes("text/plain") || ct.includes("application/json")) {
            const clone = res.clone();
            const text = await clone.text();
            if (text.includes(SIGNATURE)) trigger();
          }
        }
      } catch {
        // ignore
      }
      return res;
    };

    const onError = (e: ErrorEvent) => {
      if (e.message && e.message.includes(SIGNATURE)) trigger();
    };
    window.addEventListener("error", onError);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if (!stale) return;
    if (seconds <= 0) {
      // Force-refresh bypassing cache.
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.toString());
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stale, seconds]);

  if (!stale) return null;

  const reloadNow = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anteprima non aggiornata"
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-background/95 backdrop-blur px-4"
    >
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Anteprima non aggiornata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Il bundle di anteprima non è più disponibile. Aggiornamento automatico tra {seconds}s…
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={reloadNow}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ricarica ora
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Torna alla home
          </a>
        </div>
      </div>
    </div>
  );
}