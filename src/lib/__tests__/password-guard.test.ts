import { describe, it, expect } from "vitest";
import {
  canManagePassword,
  assertCanManagePassword,
  PASSWORD_MANAGEMENT_ERROR_CODE,
  PASSWORD_MANAGEMENT_ERROR_MESSAGE,
  GENERIC_LOGIN_ERROR_MESSAGE,
  PasswordManagementNotAllowedError,
} from "@/lib/password-guard";

describe("canManagePassword — guardia unica, fail closed", () => {
  it("consente solo gli account nati con email", () => {
    expect(canManagePassword("email")).toBe(true);
    expect(canManagePassword(" EMAIL ")).toBe(true);
  });
  it("nega tutti i provider social", () => {
    for (const m of ["google", "apple", "facebook", "oauth", "GOOGLE", "azure", "phone"]) {
      expect(canManagePassword(m)).toBe(false);
    }
  });
  it("nega valori mancanti o ambigui", () => {
    expect(canManagePassword(null)).toBe(false);
    expect(canManagePassword(undefined)).toBe(false);
    expect(canManagePassword("")).toBe(false);
    expect(canManagePassword("   ")).toBe(false);
    expect(canManagePassword(42 as unknown as string)).toBe(false);
  });
});

describe("assertCanManagePassword", () => {
  it("solleva l'errore applicativo tipizzato per i social", () => {
    try {
      assertCanManagePassword("google");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PasswordManagementNotAllowedError);
      expect((e as PasswordManagementNotAllowedError).code).toBe(PASSWORD_MANAGEMENT_ERROR_CODE);
      expect((e as Error).message).toBe(PASSWORD_MANAGEMENT_ERROR_MESSAGE);
    }
  });
  it("non solleva per email", () => {
    expect(() => assertCanManagePassword("email")).not.toThrow();
  });
});

describe("messaggi", () => {
  it("il messaggio di login resta generico (anti-enumerazione)", () => {
    expect(GENERIC_LOGIN_ERROR_MESSAGE).toBe("Metodo di accesso non valido o credenziali non corrette.");
    expect(GENERIC_LOGIN_ERROR_MESSAGE).not.toMatch(/google|apple|social|provider/i);
  });
});

describe("call site: nessun flusso password senza guardia", () => {
  it("auth.tsx blocca il login password per i social", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/routes/auth.tsx", "utf8");
    expect(src).toContain("fetchMySignupMethod");
    expect(src).toContain("GENERIC_LOGIN_ERROR_MESSAGE");
  });
  it("reset-password.tsx non chiama updateUser senza guardia", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/routes/reset-password.tsx", "utf8");
    expect(src).toContain("fetchMySignupMethod");
    expect(src).toMatch(/canManagePassword\(await fetchMySignupMethod\(\)\)/);
  });
  it("AccountSecuritySection.tsx passa dalla guardia server-side", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/AccountSecuritySection.tsx", "utf8");
    expect(src).toContain("canManagePasswordServerSide");
    expect((src.match(/assertGuard\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("nessun altro call site updateUser({ password }) fuori dai file protetti", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync("grep -rln \"updateUser\" src --include=*.ts --include=*.tsx || true").toString().trim();
    const files = out ? out.split("\n") : [];
    const allowed = new Set([
      "src/routes/reset-password.tsx",
      "src/components/AccountSecuritySection.tsx",
      "src/lib/account-deletion.server.ts", // admin ban, non password
      "src/lib/__tests__/password-guard.test.ts",
    ]);
    expect(files.filter((f) => !allowed.has(f))).toEqual([]);
  });
});
