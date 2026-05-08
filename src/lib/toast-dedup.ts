import { toast } from "sonner";

type SonnerToastFn = (message: string, options?: Parameters<typeof toast>[1]) => string | number;

type Variant = "message" | "success" | "error" | "warning" | "info";

const VARIANT_FN: Record<Variant, SonnerToastFn> = {
  message: toast.message as unknown as SonnerToastFn,
  success: toast.success as unknown as SonnerToastFn,
  error: toast.error as unknown as SonnerToastFn,
  warning: toast.warning as unknown as SonnerToastFn,
  info: toast.info as unknown as SonnerToastFn,
};

export type ToastDedupScope = "session" | "memory";

export interface ToastDedupOptions {
  /** Unique key. Same key = same toast, won't repeat. */
  key: string;
  /** Persist key across reloads (sessionStorage) or only in-memory until full reload. */
  scope?: ToastDedupScope;
  /** Optional TTL in ms — after this the same key can fire again. */
  ttlMs?: number;
  /** sonner variant. Defaults to "message". */
  variant?: Variant;
  /** Skip showing if guard returns false (re-evaluated each call). */
  guard?: () => boolean;
}

const memorySeen = new Map<string, number>();

function isFresh(stamp: number | null, ttlMs?: number): boolean {
  if (stamp == null) return false;
  if (!ttlMs) return true;
  return Date.now() - stamp < ttlMs;
}

function readStamp(key: string, scope: ToastDedupScope): number | null {
  if (scope === "memory") return memorySeen.get(key) ?? null;
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(key);
  return v ? Number(v) || null : null;
}

function writeStamp(key: string, scope: ToastDedupScope): void {
  const now = Date.now();
  if (scope === "memory") {
    memorySeen.set(key, now);
    return;
  }
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, String(now));
}

/**
 * Show a toast at most once per key (per session by default, or per memory).
 * Returns `true` if the toast was shown, `false` if deduped/guarded out.
 */
export function toastOnce(
  message: string,
  options: ToastDedupOptions & Parameters<typeof toast>[1] = { key: message },
): boolean {
  const { key, scope = "session", ttlMs, variant = "message", guard, ...sonnerOpts } = options;

  if (guard && !guard()) return false;

  const stamp = readStamp(key, scope);
  if (isFresh(stamp, ttlMs)) return false;

  VARIANT_FN[variant](message, sonnerOpts);
  writeStamp(key, scope);
  return true;
}

/** Clear a deduped toast key so it can fire again. */
export function resetToastOnce(key: string, scope: ToastDedupScope = "session"): void {
  if (scope === "memory") {
    memorySeen.delete(key);
    return;
  }
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}
