import { describe, it, expect } from "vitest";
import {
  getAuthMethods, hasPasswordLogin, hasSocialIdentity, isSocialOnlyAccount,
  mapPasswordError, providerLabel, PASSWORD_SET_METADATA_KEY,
} from "@/lib/auth-methods";

const ids = (...p: string[]) => p.map((provider) => ({ provider }));

describe("getAuthMethods", () => {
  it("account solo Google: nessuna password, cambio password nascosto", () => {
    const m = getAuthMethods(ids("google"));
    expect(m.hasPasswordLogin).toBe(false);
    expect(m.isSocialOnlyAccount).toBe(true);
    expect(m.socialProviders).toEqual(["google"]);
  });
  it("account solo email/password", () => {
    const m = getAuthMethods(ids("email"));
    expect(m.hasPasswordLogin).toBe(true);
    expect(m.hasSocialIdentity).toBe(false);
    expect(m.isSocialOnlyAccount).toBe(false);
  });
  it("account ibrido google + email", () => {
    const m = getAuthMethods(ids("google", "email"));
    expect(m.hasPasswordLogin).toBe(true);
    expect(m.hasSocialIdentity).toBe(true);
    expect(m.isSocialOnlyAccount).toBe(false);
  });
  it("due provider social senza password", () => {
    const m = getAuthMethods(ids("google", "apple"));
    expect(m.hasPasswordLogin).toBe(false);
    expect(m.isSocialOnlyAccount).toBe(true);
    expect(m.socialProviders).toEqual(["apple", "google"]);
  });
  it("metadata password_set copre il caso in cui manchi l'identità email", () => {
    const m = getAuthMethods(ids("google"), { [PASSWORD_SET_METADATA_KEY]: true });
    expect(m.hasPasswordLogin).toBe(true);
    expect(m.isSocialOnlyAccount).toBe(false);
  });
  it("identità assenti o vuote non abilitano il cambio password", () => {
    expect(hasPasswordLogin(null)).toBe(false);
    expect(hasSocialIdentity(undefined)).toBe(false);
    expect(isSocialOnlyAccount([])).toBe(false);
    expect(getAuthMethods([]).providers).toEqual([]);
  });
  it("normalizza e deduplica i provider", () => {
    expect(getAuthMethods(ids("Google", "google", " EMAIL ")).providers).toEqual(["email", "google"]);
  });
  it("phone non conta come social né come password", () => {
    const m = getAuthMethods(ids("phone"));
    expect(m.hasSocialIdentity).toBe(false);
    expect(m.hasPasswordLogin).toBe(false);
  });
});

describe("mapPasswordError", () => {
  it("messaggi italiani, mai testo tecnico Supabase", () => {
    expect(mapPasswordError({ code: "reauthentication_needed" })).toContain("codice");
    expect(mapPasswordError({ message: "Auth session missing!" })).toContain("sessione è scaduta");
    expect(mapPasswordError({ code: "same_password" })).toContain("diversa");
    expect(mapPasswordError({ code: "weak_password" })).toContain("debole");
    expect(mapPasswordError({ message: "Failed to fetch" })).toContain("Connessione");
    expect(mapPasswordError({ message: "not_allowed" })).toContain("non consentita");
    expect(mapPasswordError({ message: "boom 500" })).toBe("Non è stato possibile aggiornare la password. Riprova.");
    expect(mapPasswordError(null)).not.toMatch(/supabase|jwt|gotrue/i);
  });
});

describe("providerLabel", () => {
  it("etichette leggibili", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("apple")).toBe("Apple");
    expect(providerLabel("email")).toBe("Email e password");
  });
});
