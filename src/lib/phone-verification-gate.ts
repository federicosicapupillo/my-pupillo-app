/**
 * Pure decision logic for the WhatsApp/phone verification gate that protects
 * operational routes (everything beyond auth/onboarding/profile/...).
 *
 * Mirrors the runtime behavior of `PhoneVerificationGate` in
 * `src/components/PhoneVerificationGate.tsx` so it can be exercised in an
 * end-to-end test WITHOUT spinning up the full React router.
 *
 * Decision rules (must stay in sync with the component):
 *   - `loading` or auth extras not loaded → wait (no decision yet).
 *   - No authenticated user → no redirect (public visitor).
 *   - Deleted account → redirect to /auth with deleted flag.
 *   - Path under /api/ or in ALLOWED_PATHS → pass-through.
 *   - role === "admin" → pass-through (admins are never gated by phone).
 *   - profile.phone_verified === false → redirect to /onboarding (block).
 *   - Otherwise → pass-through.
 */

export const PHONE_GATE_ALLOWED_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/auth",
  "/verify-phone",
  "/registration-success",
  "/reset-password",
  "/account-error",
  "/terms",
  "/forbidden",
  "/onboarding",
  "/profile",
]);

export type PhoneGateInput = {
  loading: boolean;
  extrasLoaded: boolean;
  user: { id: string } | null;
  profile:
    | {
        phone_verified: boolean | null;
        is_deleted?: boolean | null;
        deleted_at?: string | null;
      }
    | null;
  role: "admin" | "restaurant" | "worker" | null | undefined;
  pathname: string;
};

export type PhoneGateDecision =
  | { action: "wait" }
  | { action: "pass"; reason: string }
  | { action: "redirect"; to: "/onboarding" | "/auth"; reason: string };

export function evaluatePhoneGate(input: PhoneGateInput): PhoneGateDecision {
  if (input.loading) return { action: "wait" };
  if (!input.user) return { action: "pass", reason: "no-user" };
  if (!input.extrasLoaded) return { action: "wait" };

  if (input.profile && (input.profile.is_deleted || input.profile.deleted_at)) {
    return { action: "redirect", to: "/auth", reason: "deleted-account" };
  }
  if (input.pathname.startsWith("/api/")) {
    return { action: "pass", reason: "api-route" };
  }
  if (PHONE_GATE_ALLOWED_PATHS.has(input.pathname)) {
    return { action: "pass", reason: "allowed-path" };
  }
  if (input.role === "admin") {
    return { action: "pass", reason: "admin-bypass" };
  }
  if (input.profile && input.profile.phone_verified === false) {
    return { action: "redirect", to: "/onboarding", reason: "phone-not-verified" };
  }
  return { action: "pass", reason: "ok" };
}

/**
 * Mirror of the in-onboarding submit guard at `src/routes/onboarding.tsx`.
 * Returns true if the operational "Salva profilo" submit is allowed to proceed.
 */
export function canSubmitOnboarding(args: {
  role: "admin" | "restaurant" | "worker";
  phoneVerifiedFromProfile: boolean | null | undefined;
  phoneVerifiedOptimistic: boolean;
}): boolean {
  if (args.role === "admin") return true;
  return args.phoneVerifiedFromProfile === true || args.phoneVerifiedOptimistic === true;
}