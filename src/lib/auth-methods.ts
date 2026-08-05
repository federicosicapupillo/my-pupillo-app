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

/**
 * Metodo con cui l'account è stato CREATO (non l'ultimo login usato).
 * Fonte canonica: `public.profiles.signup_method`, valorizzato dal trigger
 * `handle_new_user` e retro-compilato dalla prima identità di `auth.identities`.
 */
export type SignupMethod = "email" | "google" | "apple" | "facebook" | "oauth";

const SIGNUP_METHODS: SignupMethod[] = ["email", "google", "apple", "facebook", "oauth"];

function normalizeSignupMethod(value: unknown): SignupMethod | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!v) return null;
  if (v === "phone") return "email";
  if ((SIGNUP_METHODS as string[]).includes(v)) return v as SignupMethod;
  return "oauth";
}

export type SignupSourceUser = {
  app_metadata?: Record<string, unknown> | null;
  identities?: IdentityLike[] | null;
} | null | undefined;

export type SignupSourceProfile = { signup_method?: unknown } | null | undefined;

/**
 * Fonte canonica del metodo di registrazione, con fallback deterministici:
 * profilo → provider originario dell'account → prima identità → "email".
 * Non si basa mai sull'indirizzo email.
 */
export function getOriginalSignupMethod(
  user?: SignupSourceUser,
  profile?: SignupSourceProfile,
): SignupMethod {
  const fromProfile = normalizeSignupMethod(profile?.signup_method);
  if (fromProfile) return fromProfile;

  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const fromProvider = normalizeSignupMethod(appMeta["provider"]);
  if (fromProvider) return fromProvider;

  const providers = Array.isArray(appMeta["providers"]) ? (appMeta["providers"] as unknown[]) : [];
  const fromProviders = normalizeSignupMethod(providers[0]);
  if (fromProviders) return fromProviders;

  const fromIdentity = normalizeSignupMethod(user?.identities?.[0]?.provider);
  if (fromIdentity) return fromIdentity;

  return "email";
}

/** L'account è nato tramite un provider social/OAuth. */
export function isSocialSignup(user?: SignupSourceUser, profile?: SignupSourceProfile): boolean {
  return getOriginalSignupMethod(user, profile) !== "email";
}

/**
 * Unica regola per la gestione password dentro Pupillo: consentita solo agli
 * account creati con email e password. Gli account social accedono sempre e
 * solo tramite il loro provider.
 */
export function canManagePassword(user?: SignupSourceUser, profile?: SignupSourceProfile): boolean {
  return !isSocialSignup(user, profile);
}

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

/**
 * Decisione UI derivata dalle identità: quale form mostrare e con quali testi.
 * Vive qui (non nel componente) per essere testabile e non duplicabile.
 */
export type SecurityUi = {
  mode: "change-password" | "set-password" | "password-only" | "social-only";
  heading: string;
  providerLines: string[];
  socialNotice: string | null;
  showCurrentPassword: boolean;
  actionLabel: string | null;
};

export function securityUiFor(methods: AuthMethods, signupMethod?: SignupMethod): SecurityUi {
  const socialLines = methods.socialProviders.map((p) => `${providerLabel(p)} collegato`);
  const lines = [...socialLines];
  if (methods.hasPasswordLogin) lines.push("Email e password attivi");

  // Account nato da social login: nessuna gestione password, in nessuna forma.
  if (signupMethod && signupMethod !== "email") {
    const label = providerLabel(signupMethod === "oauth" ? "il tuo provider" : signupMethod);
    return {
      mode: "social-only",
      heading: "Metodo di accesso",
      providerLines: socialLines.length ? socialLines : [`${label} collegato`],
      socialNotice: `Accedi a Pupillo tramite ${label}. La password è gestita direttamente da ${label}: dentro Pupillo non esiste alcuna password per il tuo account.`,
      showCurrentPassword: false,
      actionLabel: null,
    };
  }

  if (methods.isSocialOnlyAccount) {
    return {
      mode: "set-password",
      heading: methods.socialProviders.length > 1 ? "Metodi di accesso" : "Metodo di accesso",
      providerLines: lines,
      socialNotice: `Accedi a Pupillo tramite ${methods.socialProviders.map(providerLabel).join(" o ")}.`,
      showCurrentPassword: false,
      actionLabel: "Imposta una password",
    };
  }

  return {
    mode: methods.hasSocialIdentity ? "change-password" : "password-only",
    heading: methods.hasSocialIdentity ? "Metodi di accesso" : "Metodo di accesso",
    providerLines: lines.length ? lines : ["Email e password attivi"],
    socialNotice: null,
    showCurrentPassword: true,
    actionLabel: "Cambia password",
  };
}
