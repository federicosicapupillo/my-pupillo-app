import { describe, expect, it } from "vitest";
import {
  buildPendingSignupRole,
  parsePendingSignupRole,
  PENDING_SIGNUP_ROLE_TTL_MS,
} from "@/lib/signup-role";
import { hasCompleteIdentity, isEffectivelyComplete } from "@/lib/profile-completion";

describe("pending signup role", () => {
  it("round-trips a valid payload", () => {
    const now = Date.now();
    const p = buildPendingSignupRole("restaurant", "google", now);
    expect(parsePendingSignupRole(JSON.stringify(p), now)?.role).toBe("restaurant");
    expect(p.nonce.length).toBeGreaterThan(5);
  });

  it("rejects expired, corrupted, versioned-out and future payloads", () => {
    const now = Date.now();
    const p = buildPendingSignupRole("worker", "apple", now - PENDING_SIGNUP_ROLE_TTL_MS - 1);
    expect(parsePendingSignupRole(JSON.stringify(p), now)).toBeNull();
    expect(parsePendingSignupRole("not-json", now)).toBeNull();
    expect(parsePendingSignupRole({ ...p, v: 99, createdAt: now }, now)).toBeNull();
    expect(parsePendingSignupRole({ ...p, role: "admin", createdAt: now }, now)).toBeNull();
    expect(parsePendingSignupRole({ ...p, createdAt: now + 5 * 60_000 }, now)).toBeNull();
  });
});

describe("profile completion", () => {
  it("requires first and last name", () => {
    expect(hasCompleteIdentity({ first_name: "Ada", last_name: "Lovelace" })).toBe(true);
    expect(hasCompleteIdentity({ first_name: "  ", last_name: "Lovelace" })).toBe(false);
    expect(hasCompleteIdentity(null)).toBe(false);
  });

  it("treats flag-only profiles as incomplete, admins as complete", () => {
    expect(isEffectivelyComplete({ profile_completed: true }, "worker")).toBe(false);
    expect(isEffectivelyComplete({ profile_completed: true, first_name: "A", last_name: "B" }, "worker")).toBe(true);
    expect(isEffectivelyComplete({ profile_completed: false, first_name: "A", last_name: "B" }, "restaurant")).toBe(false);
    expect(isEffectivelyComplete(null, "admin")).toBe(true);
  });
});
