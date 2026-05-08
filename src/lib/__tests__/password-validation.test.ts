import { describe, it, expect } from "vitest";
import {
  isPasswordStrongEnough,
  doPasswordsMatch,
  validatePasswordPair,
} from "../password-validation";

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
      error: "too_short",
    });
  });
  it("blocks signup when password has no letter", () => {
    expect(validatePasswordPair("12345678", "12345678").ok).toBe(false);
  });
  it("blocks signup when password has no digit", () => {
    expect(validatePasswordPair("abcdefgh", "abcdefgh").ok).toBe(false);
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
