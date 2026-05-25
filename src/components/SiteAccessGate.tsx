import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifySiteAccess } from "@/lib/site-access.functions";

const STORAGE_KEY = "pupillo-site-access";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 1000; // 60s

type StoredSession = { granted: boolean; expiresAt: number };

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.granted || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function SiteAccessGate({ children }: { children: React.ReactNode }) {
  // Default to true on the server / first paint to avoid SSR flash. After mount we re-check.
  const [granted, setGranted] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const verify = useServerFn(verifySiteAccess);

  // On mount: check stored session.
  useEffect(() => {
    const s = readSession();
    setGranted(Boolean(s));
    setHydrated(true);
  }, []);

  // Tick for lockout countdown.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (hydrated && !granted) {
      inputRef.current?.focus();
    }
  }, [hydrated, granted]);

  if (!hydrated || granted) {
    return <>{children}</>;
  }

  const isLocked = lockedUntil !== null && lockedUntil > now;
  const lockSecondsLeft = isLocked ? Math.ceil((lockedUntil! - now) / 1000) : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isLocked) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await verify({ data: { password } });
      if (res?.ok) {
        const session: StoredSession = {
          granted: true,
          expiresAt: Date.now() + SESSION_DURATION_MS,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setGranted(true);
        setPassword("");
        setAttempts(0);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setPassword("");
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCK_DURATION_MS);
          setAttempts(0);
          setError(`Troppi tentativi. Riprova tra ${Math.ceil(LOCK_DURATION_MS / 1000)} secondi.`);
        } else {
          setError("Password non corretta. Riprova.");
        }
      }
    } catch {
      setError("Impossibile verificare. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2147483645] flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Accesso riservato
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pupillo è attualmente in fase di test privato.
            <br />
            Inserisci la password per accedere alla piattaforma.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label
              htmlFor="site-access-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              ref={inputRef}
              id="site-access-password"
              type="password"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked || submitting}
              className="block w-full rounded-md border border-input bg-background px-4 py-3 text-base text-foreground shadow-sm outline-none ring-primary/30 transition focus:ring-2 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {isLocked ? `Troppi tentativi. Riprova tra ${lockSecondsLeft}s.` : error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLocked || submitting || password.length === 0}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Verifica…" : isLocked ? `Attendi ${lockSecondsLeft}s` : "Accedi"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pupillo · accesso temporaneo per test privato
        </p>
      </div>
    </div>
  );
}