/**
 * Fonte unica di verità sulla completezza del profilo Pupillo.
 *
 * `profile_completed` da solo NON basta: un account può essere stato marcato
 * completo prima che nome e cognome diventassero obbligatori (o essere nato da
 * un login social che non li ha forniti). L'identità minima — nome e cognome —
 * è parte integrante della completezza.
 */

export type IdentityProfile = {
  first_name?: string | null;
  last_name?: string | null;
  profile_completed?: boolean | null;
} | null | undefined;

function filled(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Nome e cognome presenti e non vuoti. */
export function hasCompleteIdentity(profile: IdentityProfile): boolean {
  return filled(profile?.first_name) && filled(profile?.last_name);
}

/** Completezza effettiva: admin sempre ok, altrimenti flag DB + identità. */
export function isEffectivelyComplete(profile: IdentityProfile, role?: string | null): boolean {
  if (role === "admin") return true;
  return profile?.profile_completed === true && hasCompleteIdentity(profile);
}

/** Motivo dell'incompletezza, per instradare l'utente. */
export function missingIdentityFields(profile: IdentityProfile): ("first_name" | "last_name")[] {
  const out: ("first_name" | "last_name")[] = [];
  if (!filled(profile?.first_name)) out.push("first_name");
  if (!filled(profile?.last_name)) out.push("last_name");
  return out;
}
