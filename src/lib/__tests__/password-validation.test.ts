import { describe, it, expect } from "vitest";
import {
  isPasswordStrongEnough,
  doPasswordsMatch,
  validatePasswordPair,
  PASSWORD_RULES,
} from "../password-validation";

describe("PASSWORD_RULES (UI/logic sync contract)", () => {
  // This snapshot fails if rules change without updating UI text.
  // If you change rules: update labels here AND verify auth.tsx renders PASSWORD_RULES.
  it("matches the canonical rule list", () => {
    expect(PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label }))).toEqual([
      { id: "min-length", label: "Almeno 8 caratteri" },
      { id: "has-letter", label: "Almeno una lettera" },
      { id: "has-digit", label: "Almeno un numero" },
    ]);
  });

  it("each rule label is non-empty and human-readable", () => {
    for (const rule of PASSWORD_RULES) {
      expect(rule.label.trim().length).toBeGreaterThan(0);
      expect(rule.label).toMatch(/^[A-ZÀ-Ü]/); // starts with a capital
    }
  });

  it("each rule predicate behaves as expected", () => {
    const map = Object.fromEntries(PASSWORD_RULES.map((r) => [r.id, r]));
    expect(map["min-length"].test("1234567")).toBe(false);
    expect(map["min-length"].test("12345678")).toBe(true);
    expect(map["has-letter"].test("12345678")).toBe(false);
    expect(map["has-letter"].test("abcd1234")).toBe(true);
    expect(map["has-digit"].test("abcdefgh")).toBe(false);
    expect(map["has-digit"].test("abcd1234")).toBe(true);
  });
});

describe("isPasswordStrongEnough", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(isPasswordStrongEnough("Ab1")).toBe(false);
    expect(isPasswordStrongEnough("Abcd123")).toBe(false);
  });
  it("rejects passwords without letters", () => {
    expect(isPasswordStrongEnough("12345678")).toBe(false);
  });
  it("rejects passwords without numbers", () => {
    expect(isPasswordStrongEnough("abcdefgh")).toBe(false);
  });
  it("accepts valid passwords", () => {
    expect(isPasswordStrongEnough("abcd1234")).toBe(true);
    expect(isPasswordStrongEnough("Pupillo99")).toBe(true);
  });
  it("rejects empty string", () => {
    expect(isPasswordStrongEnough("")).toBe(false);
  });
});

describe("doPasswordsMatch", () => {
  it("returns true when both match and not empty", () => {
    expect(doPasswordsMatch("abcd1234", "abcd1234")).toBe(true);
  });
  it("returns false when different", () => {
    expect(doPasswordsMatch("abcd1234", "abcd12345")).toBe(false);
  });
  it("returns false when both empty", () => {
    expect(doPasswordsMatch("", "")).toBe(false);
  });
  it("is case-sensitive", () => {
    expect(doPasswordsMatch("Abcd1234", "abcd1234")).toBe(false);
  });
});

describe("validatePasswordPair (form gating)", () => {
  it("blocks signup when password is too short", () => {
    expect(validatePasswordPair("Ab1", "Ab1")).toEqual({
      ok: false,
      error: "min-length",
    });
  });
  it("blocks signup when password has no letter", () => {
    expect(validatePasswordPair("12345678", "12345678")).toEqual({
      ok: false,
      error: "has-letter",
    });
  });
  it("blocks signup when password has no digit", () => {
    expect(validatePasswordPair("abcdefgh", "abcdefgh")).toEqual({
      ok: false,
      error: "has-digit",
    });
  });
  it("blocks signup when passwords mismatch", () => {
    expect(validatePasswordPair("abcd1234", "abcd9999")).toEqual({
      ok: false,
      error: "mismatch",
    });
  });
  it("allows signup when valid and matching", () => {
    expect(validatePasswordPair("Pupillo99", "Pupillo99")).toEqual({ ok: true });
  });
});

describe("UI sync — auth.tsx must render PASSWORD_RULES", () => {
  it("auth.tsx imports and renders PASSWORD_RULES (no hardcoded hint text)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/routes/auth.tsx", "utf8");
    expect(src).toContain("PASSWORD_RULES");
    expect(src).toMatch(/PASSWORD_RULES\.map/);
    // Hardcoded legacy hint must be gone.
    expect(src).not.toMatch(/lettera maiuscola/i);
  });
});
