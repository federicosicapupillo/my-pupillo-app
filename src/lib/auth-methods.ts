/**
 * Fonte unica di verità sui metodi di accesso di un account Pupillo.
 *
 * Perché non basta `user.app_metadata.provider`: indica solo il provider
 * usato per l'ultimo login (o il primo registrato). Un account può avere più
 * identità collegate (es. google + email). L'unica fonte autorevole sono le
 * identità: `supabase.auth.getUserIdentities()` (fallback: `user.identities`).
 *
 * Distinzione email-password vs email-passwordless: Pupillo NON usa magic link
 * né OTP email (registrazione = signUp con password, login = signInWithPassword
 * oppure OAuth). Quindi la presenza di un'identità `email` implica che una
 * password esiste. Per gli account social che impostano la password in un
 * secondo momento marchiamo anche `user_metadata.password_set = true`, così la
 * UI resta corretta anche se GoTrue non dovesse creare l'identità `email`.
 */

export const PASSWORD_SET_METADATA_KEY = "password_set";

export type IdentityLike = { provider?: string | null };

export type AuthMethods = {
  /** Provider collegati, normalizzati e deduplicati (es. ["email","google"]). */
  providers: string[];
  /** Provider social (tutto ciò che non è `email`/`phone`). */
  socialProviders: string[];
  /** L'account può accedere con email + password. */
  hasPasswordLogin: boolean;
  /** L'account ha almeno un'identità social collegata. */
  hasSocialIdentity: boolean;
  /** Solo social: nessuna password impostata. */
  isSocialOnlyAccount: boolean;
};

const PASSWORDLESS_PROVIDERS = new Set(["phone", "anonymous"]);

export function normalizeProviders(identities: IdentityLike[] | null | undefined): string[] {
  const out: string[] = [];
  for (const i of identities ?? []) {
    const p = (i?.provider ?? "").trim().toLowerCase();
    if (p && !out.includes(p)) out.push(p);
  }
  return out.sort();
}

export function hasPasswordLogin(
  identities: IdentityLike[] | null | undefined,
  userMetadata?: Record<string, unknown> | null,
): boolean {
  if (userMetadata?.[PASSWORD_SET_METADATA_KEY] === true) return true;
  return normalizeProviders(identities).includes("email");
}

export function hasSocialIdentity(identities: IdentityLike[] | null | undefined): boolean {
  return socialProvidersOf(identities).length > 0;
}

export function socialProvidersOf(identities: IdentityLike[] | null | undefined): string[] {
  return normalizeProviders(identities).filter(
    (p) => p !== "email" && !PASSWORDLESS_PROVIDERS.has(p),
  );
}

export function isSocialOnlyAccount(
  identities: IdentityLike[] | null | undefined,
  userMetadata?: Record<string, unknown> | null,
): boolean {
  return hasSocialIdentity(identities) && !hasPasswordLogin(identities, userMetadata);
}

export function getAuthMethods(
  identities: IdentityLike[] | null | undefined,
  userMetadata?: Record<string, unknown> | null,
): AuthMethods {
  const providers = normalizeProviders(identities);
  const socialProviders = socialProvidersOf(identities);
  const password = hasPasswordLogin(identities, userMetadata);
  return {
    providers,
    socialProviders,
    hasPasswordLogin: password,
    hasSocialIdentity: socialProviders.length > 0,
    isSocialOnlyAccount: socialProviders.length > 0 && !password,
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  microsoft: "Microsoft",
  azure: "Microsoft",
  email: "Email e password",
  phone: "Telefono",
};

export function providerLabel(provider: string): string {
  const key = provider.trim().toLowerCase();
  return PROVIDER_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Messaggi utente in italiano: mai errori tecnici Supabase. */
export function mapPasswordError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "");
  const code = (error as { code?: string } | null)?.code ?? "";
  const m = `${code} ${raw}`.toLowerCase();

  if (m.includes("reauthentication") || m.includes("nonce")) {
    return "Per motivi di sicurezza devi confermare la tua identità: ti abbiamo inviato un codice via email.";
  }
  if (m.includes("session") && (m.includes("missing") || m.includes("expired"))) {
    return "La sessione è scaduta. Accedi di nuovo e riprova.";
  }
  if (m.includes("jwt") || m.includes("token")) {
    return "La sessione è scaduta. Accedi di nuovo e riprova.";
  }
  if (m.includes("same_password") || m.includes("should be different")) {
    return "La nuova password deve essere diversa da quella attuale.";
  }
  if (m.includes("weak_password") || m.includes("password should be") || m.includes("pwned")) {
    return "La password è troppo debole o troppo comune. Scegline una più sicura.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Connessione non riuscita. Controlla la rete e riprova.";
  }
  if (m.includes("not_allowed") || m.includes("not allowed") || m.includes("forbidden") || m.includes("403")) {
    return "Operazione non consentita per questo account.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Troppi tentativi. Attendi qualche minuto e riprova.";
  }
  return "Non è stato possibile aggiornare la password. Riprova.";
}

export const IDENTITIES_LOAD_ERROR =
  "Non è stato possibile caricare i tuoi metodi di accesso. Riprova più tardi.";
