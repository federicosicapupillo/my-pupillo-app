import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { normalizeReferralCode, rememberReferralCode, readReferralCode, clearReferralCode } from "../referral-capture";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

describe("referral capture", () => {
  it("normalizza e rifiuta codici non validi", () => {
    expect(normalizeReferralCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeReferralCode("x")).toBeNull();
    expect(normalizeReferralCode("<script>")).toBeNull();
  });
  it("salva e rilegge il codice", () => {
    rememberReferralCode("abc123");
    expect(readReferralCode()).toBe("ABC123");
    clearReferralCode();
    expect(readReferralCode()).toBeNull();
  });
  it("scarta codici scaduti", () => {
    rememberReferralCode("abc123");
    expect(readReferralCode(Date.now() + 8 * 86400000)).toBeNull();
  });
});
