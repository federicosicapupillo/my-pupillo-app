import { describe, it, expect } from "vitest";
import {
  getAuthMethods, hasPasswordLogin, hasSocialIdentity, isSocialOnlyAccount,
  mapPasswordError, providerLabel, PASSWORD_SET_METADATA_KEY, securityUiFor,
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

describe("securityUiFor", () => {
  const ui = (...p: string[]) => securityUiFor(getAuthMethods(ids(...p)));

  it("solo Google → 'Imposta una password', nessuna password attuale", () => {
    const u = ui("google");
    expect(u.mode).toBe("set-password");
    expect(u.actionLabel).toBe("Imposta una password");
    expect(u.showCurrentPassword).toBe(false);
    expect(u.providerLines).toEqual(["Google collegato"]);
    expect(u.socialNotice).toBe("Accedi a Pupillo tramite Google.");
  });
  it("solo email → 'Cambia password' con password attuale", () => {
    const u = ui("email");
    expect(u.mode).toBe("password-only");
    expect(u.actionLabel).toBe("Cambia password");
    expect(u.showCurrentPassword).toBe(true);
    expect(u.heading).toBe("Metodo di accesso");
    expect(u.providerLines).toEqual(["Email e password attivi"]);
  });
  it("google + email → entrambi i metodi elencati, cambio password", () => {
    const u = ui("google", "email");
    expect(u.mode).toBe("change-password");
    expect(u.heading).toBe("Metodi di accesso");
    expect(u.providerLines).toEqual(["Google collegato", "Email e password attivi"]);
    expect(u.socialNotice).toBeNull();
  });
  it("google + apple senza password → 'Imposta una password'", () => {
    const u = ui("google", "apple");
    expect(u.actionLabel).toBe("Imposta una password");
    expect(u.providerLines).toEqual(["Apple collegato", "Google collegato"]);
    expect(u.socialNotice).toContain("Apple o Google");
  });
  it("social con password_set → cambio password", () => {
    const u = securityUiFor(getAuthMethods(ids("google"), { [PASSWORD_SET_METADATA_KEY]: true }));
    expect(u.actionLabel).toBe("Cambia password");
    expect(u.providerLines).toEqual(["Google collegato", "Email e password attivi"]);
  });
});
