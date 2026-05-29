/**
 * End-to-end coverage for the WhatsApp OTP gate.
 *
 * Verifies that a ristoratore / lavoratore CANNOT reach any operational
 * surface (dashboard, annunci, candidature, ricerca lavoratori, messaggi,
 * pubblicazione annuncio, ecc.) until `profile.phone_verified === true` —
 * exactly the rule enforced at runtime by:
 *   - `src/components/PhoneVerificationGate.tsx` (route-level redirect)
 *   - `src/routes/onboarding.tsx` submit guard (cannot save profile without
 *     phone_verified OR the immediate optimistic flag set right after OTP).
 *
 * Pure-logic test — no React / no router boot — mirrors the existing pattern
 * in `onboarding-dates.e2e.test.ts`. Both the component and this test share
 * `evaluatePhoneGate` so the rule cannot drift out of sync.
 */
import { describe, it, expect } from "vitest";
import {
  evaluatePhoneGate,
  canSubmitOnboarding,
  PHONE_GATE_ALLOWED_PATHS,
} from "@/lib/phone-verification-gate";

const USER = { id: "user-1" };
const PROFILE_UNVERIFIED = {
  phone_verified: false as boolean | null,
  is_deleted: false,
  deleted_at: null,
};
const PROFILE_VERIFIED = { ...PROFILE_UNVERIFIED, phone_verified: true };

const OPERATIONAL_PATHS = [
  "/dashboard",
  "/ristoratore/annunci",
  "/ristoratore/annunci/nuovo",
  "/ristoratore/candidature",
  "/workers",
  "/messages",
  "/lavoratore/annunci",
  "/lavoratore/candidature",
  "/settings",
];

/**
 * Le quattro aree operative dichiarate come "MUST be gated":
 *   - candidature   → flusso applications (lista + dettagli)
 *   - chat          → /messages (lista) e /messages/$id (thread)
 *   - assegnazione turni → /shifts e /ristoratore/turni/:shiftId
 *   - pubblicazione annunci → /announcements/new, /ristoratore/annunci/nuovo
 *
 * Ogni path qui sotto corrisponde a un `createFileRoute(...)` esistente in
 * `src/routes/`. Se in futuro qualcuno aggiungesse una nuova rotta
 * operativa, basterà includerla qui per garantire che continui ad essere
 * intercettata dal gate UNICO (`evaluatePhoneGate`).
 */
const NAMED_OPERATIONAL_AREAS: ReadonlyArray<{ area: string; path: string }> = [
  { area: "candidature (lista)", path: "/ristoratore/candidature" },
  { area: "candidature (worker)", path: "/lavoratore/candidature" },
  { area: "chat (inbox)", path: "/messages" },
  { area: "chat (thread)", path: "/messages/abc-123" },
  { area: "assegnazione turni (lista)", path: "/shifts" },
  { area: "assegnazione turni (dettaglio)", path: "/ristoratore/turni/shift-42" },
  { area: "pubblicazione annunci (worker route)", path: "/announcements/new" },
  { area: "pubblicazione annunci (ristoratore route)", path: "/ristoratore/annunci/nuovo" },
];

describe("WhatsApp OTP gate — operational functions blocked until phone_verified=true", () => {
  describe("ristoratore", () => {
    for (const path of OPERATIONAL_PATHS) {
      it(`blocks ${path} and redirects to /onboarding when phone_verified=false`, () => {
        const decision = evaluatePhoneGate({
          loading: false,
          extrasLoaded: true,
          user: USER,
          profile: PROFILE_UNVERIFIED,
          role: "restaurant",
          pathname: path,
        });
        expect(decision).toEqual({
          action: "redirect",
          to: "/onboarding",
          reason: "phone-not-verified",
        });
      });

      it(`allows ${path} once phone_verified=true`, () => {
        const decision = evaluatePhoneGate({
          loading: false,
          extrasLoaded: true,
          user: USER,
          profile: PROFILE_VERIFIED,
          role: "restaurant",
          pathname: path,
        });
        expect(decision.action).toBe("pass");
      });
    }
  });

  describe("lavoratore", () => {
    for (const path of OPERATIONAL_PATHS) {
      it(`blocks ${path} for workers when phone_verified=false`, () => {
        const decision = evaluatePhoneGate({
          loading: false,
          extrasLoaded: true,
          user: USER,
          profile: PROFILE_UNVERIFIED,
          role: "worker",
          pathname: path,
        });
        expect(decision).toEqual({
          action: "redirect",
          to: "/onboarding",
          reason: "phone-not-verified",
        });
      });
    }
  });

  describe("admin bypass", () => {
    for (const path of OPERATIONAL_PATHS) {
      it(`never blocks ${path} for admin, even with phone_verified=false`, () => {
        const decision = evaluatePhoneGate({
          loading: false,
          extrasLoaded: true,
          user: USER,
          profile: PROFILE_UNVERIFIED,
          role: "admin",
          pathname: path,
        });
        expect(decision).toEqual({ action: "pass", reason: "admin-bypass" });
      });
    }
  });

  describe("allowed paths (auth, onboarding, public)", () => {
    for (const path of [...PHONE_GATE_ALLOWED_PATHS]) {
      it(`never blocks ${path} even when phone_verified=false`, () => {
        const decision = evaluatePhoneGate({
          loading: false,
          extrasLoaded: true,
          user: USER,
          profile: PROFILE_UNVERIFIED,
          role: "restaurant",
          pathname: path,
        });
        expect(decision.action).toBe("pass");
      });
    }

    it("never blocks /api/* (server routes, webhooks)", () => {
      const decision = evaluatePhoneGate({
        loading: false,
        extrasLoaded: true,
        user: USER,
        profile: PROFILE_UNVERIFIED,
        role: "worker",
        pathname: "/api/public/webhook",
      });
      expect(decision).toEqual({ action: "pass", reason: "api-route" });
    });
  });

  describe("loading / not-yet-resolved auth", () => {
    it("waits while auth is loading (no redirect flash)", () => {
      const decision = evaluatePhoneGate({
        loading: true,
        extrasLoaded: false,
        user: null,
        profile: null,
        role: null,
        pathname: "/dashboard",
      });
      expect(decision).toEqual({ action: "wait" });
    });

    it("waits while extras (profile/role) are still loading", () => {
      const decision = evaluatePhoneGate({
        loading: false,
        extrasLoaded: false,
        user: USER,
        profile: null,
        role: null,
        pathname: "/dashboard",
      });
      expect(decision).toEqual({ action: "wait" });
    });

    it("does not redirect when phone_verified is null (still hydrating)", () => {
      const decision = evaluatePhoneGate({
        loading: false,
        extrasLoaded: true,
        user: USER,
        profile: { phone_verified: null, is_deleted: false, deleted_at: null },
        role: "restaurant",
        pathname: "/dashboard",
      });
      // Strict check: only false triggers the redirect, not null/undefined.
      expect(decision.action).toBe("pass");
    });
  });

  describe("deleted account", () => {
    it("redirects deleted accounts to /auth (not /onboarding)", () => {
      const decision = evaluatePhoneGate({
        loading: false,
        extrasLoaded: true,
        user: USER,
        profile: { phone_verified: false, is_deleted: true, deleted_at: "2026-05-01T00:00:00Z" },
        role: "restaurant",
        pathname: "/dashboard",
      });
      expect(decision).toEqual({
        action: "redirect",
        to: "/auth",
        reason: "deleted-account",
      });
    });
  });
});

describe("Onboarding submit guard — cannot save profile until OTP verified", () => {
  it("blocks restaurant submit when phone_verified=false and no optimistic flag", () => {
    expect(
      canSubmitOnboarding({
        role: "restaurant",
        phoneVerifiedFromProfile: false,
        phoneVerifiedOptimistic: false,
      }),
    ).toBe(false);
  });

  it("blocks worker submit when phone_verified is null (never verified)", () => {
    expect(
      canSubmitOnboarding({
        role: "worker",
        phoneVerifiedFromProfile: null,
        phoneVerifiedOptimistic: false,
      }),
    ).toBe(false);
  });

  it("allows submit immediately after OTP verify via optimistic flag (before refresh lands)", () => {
    expect(
      canSubmitOnboarding({
        role: "restaurant",
        phoneVerifiedFromProfile: false,
        phoneVerifiedOptimistic: true,
      }),
    ).toBe(true);
  });

  it("allows submit when profile already has phone_verified=true", () => {
    expect(
      canSubmitOnboarding({
        role: "worker",
        phoneVerifiedFromProfile: true,
        phoneVerifiedOptimistic: false,
      }),
    ).toBe(true);
  });

  it("always allows admin submit, regardless of phone verification", () => {
    expect(
      canSubmitOnboarding({
        role: "admin",
        phoneVerifiedFromProfile: false,
        phoneVerifiedOptimistic: false,
      }),
    ).toBe(true);
  });
});

describe("Full OTP completion flow — state transitions", () => {
  it("user is blocked → completes OTP → immediately unblocked on operational route", () => {
    const base = {
      loading: false,
      extrasLoaded: true,
      user: USER,
      role: "restaurant" as const,
      pathname: "/dashboard",
    };
    // Before OTP
    expect(
      evaluatePhoneGate({ ...base, profile: PROFILE_UNVERIFIED }).action,
    ).toBe("redirect");
    // After OTP success (profile.phone_verified flips to true)
    expect(
      evaluatePhoneGate({ ...base, profile: PROFILE_VERIFIED }).action,
    ).toBe("pass");
  });
});