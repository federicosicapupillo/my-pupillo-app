/**
 * Gate centralizzato dell'onboarding.
 *
 * Finché il profilo obbligatorio non è stato salvato correttamente in DB
 * (flag `profile_completed` + identità minima), l'utente può usare solo un
 * insieme ristretto di rotte. Il blocco è applicato a livello di guardia di
 * rotta (`RequireAuth`), quindi vale anche per URL diretti, refresh, tasto
 * Indietro e link provenienti dalle notifiche — non solo via CSS.
 */
import { isEffectivelyComplete, type IdentityProfile } from "@/lib/profile-completion";

export const ONBOARDING_LOCKED_MESSAGE =
  "Completa e salva il profilo per accedere a questa sezione.";

/** Rotte sempre raggiungibili anche con onboarding incompleto. */
const ALWAYS_ALLOWED_PREFIXES = [
  "/onboarding",
  "/auth",
  "/choose-role",
  "/verify-phone",
  "/reset-password",
  "/registration-success",
  "/account-error",
  "/forbidden",
  "/terms",
  "/privacy",
  "/come-funziona",
  "/support",
  "/assistenza",
];

export function isPathAllowedDuringOnboarding(pathname: string): boolean {
  if (pathname === "/") return true;
  return ALWAYS_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * `true` quando le aree riservate devono restare bloccate.
 * Gli admin non sono mai soggetti al gate.
 */
export function isOnboardingLocked(
  profile: IdentityProfile,
  role?: string | null,
): boolean {
  if (role === "admin") return false;
  return !isEffectivelyComplete(profile, role);
}
