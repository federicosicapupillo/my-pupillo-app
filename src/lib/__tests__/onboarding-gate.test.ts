import { describe, expect, it } from "vitest";
import { isOnboardingLocked, isPathAllowedDuringOnboarding } from "@/lib/onboarding-gate";

const complete = { profile_completed: true, first_name: "Mario", last_name: "Rossi" };
const partial = { profile_completed: true, first_name: "Mario", last_name: "" };
const empty = { profile_completed: false, first_name: null, last_name: null };

describe("onboarding gate", () => {
  it("blocca il profilo incompleto", () => {
    expect(isOnboardingLocked(empty, "worker")).toBe(true);
    expect(isOnboardingLocked(partial, "restaurant")).toBe(true);
    expect(isOnboardingLocked(null, "worker")).toBe(true);
  });
  it("sblocca solo dopo salvataggio completo", () => {
    expect(isOnboardingLocked(complete, "worker")).toBe(false);
    expect(isOnboardingLocked(complete, "restaurant")).toBe(false);
  });
  it("non blocca mai gli admin", () => {
    expect(isOnboardingLocked(empty, "admin")).toBe(false);
  });
  it("consente solo onboarding, auth e pagine di servizio", () => {
    for (const p of ["/onboarding", "/auth", "/choose-role", "/terms", "/verify-phone", "/"]) {
      expect(isPathAllowedDuringOnboarding(p)).toBe(true);
    }
    for (const p of ["/dashboard", "/profile", "/billing", "/messages", "/messages/123", "/jobs", "/availability", "/notifications", "/announcements"]) {
      expect(isPathAllowedDuringOnboarding(p)).toBe(false);
    }
  });
});
