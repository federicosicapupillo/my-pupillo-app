/**
 * Codice "Presenta un amico" catturato all'arrivo su /auth?ref=...
 * Salvato in localStorage (sopravvive a redirect OAuth e cambio scheda) con
 * scadenza 7 giorni; inviato nei metadati di iscrizione email oppure
 * registrato dopo il ritorno da Google/Apple/Facebook.
 */
import { supabase } from "@/integrations/supabase/client";

const KEY = "pupillo-referral-code";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(c) ? c : null;
}

export function rememberReferralCode(raw: unknown) {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* storage non disponibile */
  }
}

export function readReferralCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { code?: unknown; at?: unknown };
    const code = normalizeReferralCode(p.code);
    if (!code || typeof p.at !== "number" || now - p.at > TTL_MS) {
      clearReferralCode();
      return null;
    }
    return code;
  } catch {
    clearReferralCode();
    return null;
  }
}

export function clearReferralCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** Dopo un login social: collega l'invitante se c'è un codice salvato. */
export async function registerStoredReferral(userId: string) {
  const code = readReferralCode();
  if (!code) return;
  const { data, error } = await supabase.rpc("register_referral" as never, { _new_user: userId, _code: code } as never);
  if (error) {
    console.error("[referral] register_referral failed", error);
    return; // il codice resta per un nuovo tentativo
  }
  console.info("[referral] register_referral:", data);
  clearReferralCode();
}
