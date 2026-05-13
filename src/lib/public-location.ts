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