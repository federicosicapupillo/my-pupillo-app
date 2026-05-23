/**
 * Centralized profile completion check.
 *
 * Single source of truth used by:
 *  - the global route guard (RequireCompleteProfile)
 *  - the dashboard banner (ProfileCompletionBanner)
 *  - the per-action gates (apply, send proposal, publish, send message...)
 *
 * The list of required fields is intentionally conservative and based on
 * what the existing onboarding flow already collects, so a user who has
 * finished onboarding will pass the check.
 */

export type Role = "worker" | "restaurant" | "admin" | null | undefined;

export type MissingItem = {
  key: string;
  label: string;
};

export type CompletionResult = {
  isComplete: boolean;
  percent: number;
  missing: MissingItem[];
  total: number;
  done: number;
};

type AnyProfile = Record<string, unknown> | null | undefined;

function has(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return v === true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function check(profile: AnyProfile, key: string, label: string): MissingItem | null {
  const v = profile ? (profile as Record<string, unknown>)[key] : undefined;
  return has(v) ? null : { key, label };
}

/**
 * Required fields for a worker to be considered "operational".
 */
function workerRequirements(profile: AnyProfile): MissingItem[] {
  const items: (MissingItem | null)[] = [
    profile && (profile as any).phone_verified
      ? null
      : { key: "phone_verified", label: "Numero WhatsApp non verificato" },
    profile && (profile as any).profile_completed
      ? null
      : { key: "profile_completed", label: "Dati obbligatori del profilo mancanti" },
    check(profile, "first_name", "Nome mancante"),
    check(profile, "last_name", "Cognome mancante"),
    check(profile, "birth_date", "Data di nascita mancante"),
    check(profile, "primary_role", "Ruolo professionale mancante"),
    check(profile, "id_document_path", "Documento d'identità mancante"),
    check(profile, "avatar_url", "Foto profilo mancante"),
  ];
  return items.filter((x): x is MissingItem => x !== null);
}

/**
 * Required fields for a restaurant to be considered "operational".
 */
function restaurantRequirements(profile: AnyProfile): MissingItem[] {
  const items: (MissingItem | null)[] = [
    profile && (profile as any).phone_verified
      ? null
      : { key: "phone_verified", label: "Numero WhatsApp non verificato" },
    profile && (profile as any).profile_completed
      ? null
      : { key: "profile_completed", label: "Dati obbligatori del profilo mancanti" },
    check(profile, "business_name", "Nome attività mancante"),
    check(profile, "vat_number", "Partita IVA mancante"),
    check(profile, "venue_type", "Tipo di attività mancante"),
    check(profile, "address", "Indirizzo attività mancante"),
    check(profile, "city", "Città mancante"),
    check(profile, "contact_person_first_name", "Referente mancante"),
    check(profile, "contact_person_phone", "Telefono referente mancante"),
  ];
  return items.filter((x): x is MissingItem => x !== null);
}

const TOTAL_BY_ROLE: Record<"worker" | "restaurant", number> = {
  worker: 8,
  restaurant: 9,
};

export function getProfileCompletion(profile: AnyProfile, role: Role): CompletionResult {
  if (role !== "worker" && role !== "restaurant") {
    return { isComplete: true, percent: 100, missing: [], total: 0, done: 0 };
  }
  const missing =
    role === "worker" ? workerRequirements(profile) : restaurantRequirements(profile);
  const total = TOTAL_BY_ROLE[role];
  const done = Math.max(0, total - missing.length);
  const percent = total === 0 ? 100 : Math.round((done / total) * 100);
  return {
    isComplete: missing.length === 0,
    percent,
    missing,
    total,
    done,
  };
}

export function isProfileComplete(profile: AnyProfile, role: Role): boolean {
  return getProfileCompletion(profile, role).isComplete;
}

/**
 * Where to send the user to finish onboarding, based on their role.
 */
export function getCompleteProfileRoute(_role: Role): string {
  // Both roles currently complete via /onboarding; the page renders the
  // right form based on the user's role.
  return "/onboarding";
}

/**
 * Path prefixes that are ALWAYS reachable, even when the profile is not
 * complete. Everything else, for worker/restaurant roles, is considered
 * an "operational" surface and gated by the profile completion check.
 */
const ALWAYS_ALLOWED_PREFIXES: string[] = [
  "/", // homepage and any exact root match handled separately
  "/auth",
  "/reset-password",
  "/registration-success",
  "/verify-phone",
  "/onboarding",
  "/dashboard",
  "/profile",
  "/billing",
  "/notifications",
  "/terms",
  "/forbidden",
  "/come-funziona",
  "/admin",
];

export function isOperativePath(pathname: string): boolean {
  // Normalize: drop trailing slash (except root) and querystring.
  const clean = pathname.split("?")[0].replace(/\/$/, "") || "/";
  if (clean === "/") return false;
  for (const p of ALWAYS_ALLOWED_PREFIXES) {
    if (p === "/") continue;
    if (clean === p || clean.startsWith(p + "/")) return false;
  }
  return true;
}