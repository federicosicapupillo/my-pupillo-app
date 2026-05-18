// Helpers to mask precise restaurant addresses from workers until the
// application is accepted / the shift assigned. Workers should only see
// "Città · Zona" (or just city) for unassigned offers — never via, civico
// or coordinates.

export type PublicLocationInput = {
  job_city?: string | null;
  job_province?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  district?: string | null;
};

/** Returns "Città · Zona", "Città" or "—" — never an exact address. */
export function publicLocationLabel(input: PublicLocationInput): string {
  const city = (input.job_city || input.city || "").trim();
  const district = (input.district || input.neighborhood || "").trim();
  if (city && district) return `${city} · ${district}`;
  if (city) return city;
  if (district) return district;
  return "Zona non specificata";
}

export type AddressVisibilityCtx = {
  isOwner?: boolean;
  isAdmin?: boolean;
  applicationStatus?: string | null;
  assignedWorkerId?: string | null;
  userId?: string | null;
};

/** True when the viewer is allowed to see the precise address. */
export function canSeePreciseAddress(ctx: AddressVisibilityCtx): boolean {
  if (ctx.isOwner || ctx.isAdmin) return true;
  if (ctx.applicationStatus === "accepted") return true;
  if (ctx.userId && ctx.assignedWorkerId && ctx.assignedWorkerId === ctx.userId) return true;
  return false;
}

export const PRECISE_ADDRESS_HINT =
  "L'indirizzo esatto sarà visibile dopo la conferma del turno.";

/** Generic placeholder shown to workers before a restaurant relationship is
 *  confirmed. Keeps the chat usable without leaking the venue identity. */
export const PUBLIC_VENUE_NAME = "Ristorante partner";

const CONFIRMED_APP_STATUSES = new Set([
  "accepted",
  "confirmed",
  "assigned",
]);

/** True if `status` represents a confirmed/accepted worker relationship. */
export function isApplicationConfirmed(status: string | null | undefined): boolean {
  return !!status && CONFIRMED_APP_STATUSES.has(status);
}

/**
 * Mask the restaurant's real name in worker-facing chat UI until the
 * application is confirmed. Restaurants always see the worker's real name.
 */
export function maskPartnerNameForWorker(
  name: string | null | undefined,
  viewerRole: string | null | undefined,
  appStatus: string | null | undefined,
): string {
  if (viewerRole !== "worker") return name ?? "Utente";
  if (isApplicationConfirmed(appStatus)) return name ?? PUBLIC_VENUE_NAME;
  return PUBLIC_VENUE_NAME;
}