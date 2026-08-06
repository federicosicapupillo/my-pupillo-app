/**
 * Ruolo scelto in fase di registrazione prima di un login social.
 *
 * Google/Apple/Facebook non trasportano metadati applicativi: il ruolo
 * selezionato nella UI viene memorizzato (con scadenza breve) prima del
 * redirect e "reclamato" al ritorno tramite la RPC `claim_signup_role`.
 *
 * Regole:
 * - payload versionato con role, provider, createdAt e nonce casuale;
 * - scadenza 15 minuti: valori scaduti/corrotti vengono ignorati e rimossi;
 * - il valore viene cancellato SOLO dopo una claim riuscita o quando il DB
 *   possiede già un ruolo autorevole (in caso di errore resta recuperabile).
 */

export type SignupRole = "restaurant" | "worker";
export type SignupProvider = "google" | "apple" | "facebook" | "email";

export const PENDING_SIGNUP_ROLE_KEY = "pupillo-pending-signup-role";
export const PENDING_SIGNUP_ROLE_VERSION = 1;
export const PENDING_SIGNUP_ROLE_TTL_MS = 15 * 60 * 1000;

export type PendingSignupRole = {
  v: number;
  role: SignupRole;
  provider: SignupProvider;
  createdAt: number;
  nonce: string;
};

function randomNonce(): string {
  try {
    const c = globalThis.crypto;
    if (c && "randomUUID" in c) return c.randomUUID();
  } catch {
    /* crypto non disponibile */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPendingSignupRole(
  role: SignupRole,
  provider: SignupProvider,
  now: number = Date.now(),
): PendingSignupRole {
  return { v: PENDING_SIGNUP_ROLE_VERSION, role, provider, createdAt: now, nonce: randomNonce() };
}

/** Valida un payload sconosciuto (parsing difensivo, nessuna eccezione). */
export function parsePendingSignupRole(raw: unknown, now: number = Date.now()): PendingSignupRole | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<PendingSignupRole>;
  if (p.v !== PENDING_SIGNUP_ROLE_VERSION) return null;
  if (p.role !== "restaurant" && p.role !== "worker") return null;
  if (p.provider !== "google" && p.provider !== "apple" && p.provider !== "facebook" && p.provider !== "email") {
    return null;
  }
  if (typeof p.createdAt !== "number" || !Number.isFinite(p.createdAt)) return null;
  if (typeof p.nonce !== "string" || p.nonce.length < 6) return null;
  if (now - p.createdAt > PENDING_SIGNUP_ROLE_TTL_MS || p.createdAt > now + 60_000) return null;
  return { v: p.v, role: p.role, provider: p.provider, createdAt: p.createdAt, nonce: p.nonce };
}

export function rememberPendingSignupRole(role: SignupRole, provider: SignupProvider): PendingSignupRole | null {
  const payload = buildPendingSignupRole(role, provider);
  try {
    sessionStorage.setItem(PENDING_SIGNUP_ROLE_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function readPendingSignupRole(now: number = Date.now()): PendingSignupRole | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_SIGNUP_ROLE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const parsed = parsePendingSignupRole(raw, now);
  // Valori corrotti o scaduti non devono restare in giro.
  if (!parsed) clearPendingSignupRole();
  return parsed;
}

export function clearPendingSignupRole() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_ROLE_KEY);
  } catch {
    /* storage non disponibile */
  }
}
