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

/**
 * Shift statuses that count as "they have worked together at least once".
 * Any non-cancelled shift is treated as a confirmed past relationship: a row
 * in `shifts` exists only after the restaurant assigns/confirms a worker.
 */
export const WORKED_TOGETHER_SHIFT_STATUSES = [
  "scheduled",
  "confirmed",
  "assigned",
  "completed",
  "closed",
] as const;

/** Extract the first token of a full name (e.g. "Marco Lombardi" → "Marco"). */
export function firstNameOf(fullName: string | null | undefined): string {
  const s = (fullName ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}

/**
 * Centralized privacy helper for the restaurant/locale name visible to a
 * worker (or anyone else) in chat surfaces. Workers see the real venue name
 * only after the application is confirmed/assigned OR if the two parties have
 * already worked together at least once.
 */
export function getDisplayRestaurantName(params: {
  businessName?: string | null;
  fullName?: string | null;
  viewerRole?: string | null;
  appStatus?: string | null;
  hasWorkedTogether?: boolean;
}): string {
  const real = (params.businessName || params.fullName || "").trim();
  if (params.viewerRole !== "worker") return real || "Utente";
  if (params.hasWorkedTogether) return real || PUBLIC_VENUE_NAME;
  if (isApplicationConfirmed(params.appStatus)) return real || PUBLIC_VENUE_NAME;
  return PUBLIC_VENUE_NAME;
}

/**
 * Centralized privacy helper for the worker name visible to a restaurant in
 * chat surfaces. Before assignment/confirmation (and without past shared
 * shifts) only the first name is shown — never the last name.
 */
export function getDisplayWorkerName(params: {
  fullName?: string | null;
  firstName?: string | null;
  viewerRole?: string | null;
  appStatus?: string | null;
  hasWorkedTogether?: boolean;
}): string {
  const full = (params.fullName ?? "").trim();
  const first = (params.firstName ?? "").trim() || firstNameOf(full);
  if (params.viewerRole !== "restaurant") return full || first || "Utente";
  if (params.hasWorkedTogether) return full || first || "Lavoratore";
  if (isApplicationConfirmed(params.appStatus)) return full || first || "Lavoratore";
  return first || "Lavoratore";
}

/**
 * Convenience wrapper: picks the right helper based on which side the
 * viewer is on. Pass `partner` = the other party in the conversation.
 */
export function getDisplayPartnerName(params: {
  viewerRole?: string | null;
  appStatus?: string | null;
  hasWorkedTogether?: boolean;
  partner: {
    businessName?: string | null;
    fullName?: string | null;
    firstName?: string | null;
  };
}): string {
  if (params.viewerRole === "worker") {
    return getDisplayRestaurantName({
      businessName: params.partner.businessName,
      fullName: params.partner.fullName,
      viewerRole: params.viewerRole,
      appStatus: params.appStatus,
      hasWorkedTogether: params.hasWorkedTogether,
    });
  }
  if (params.viewerRole === "restaurant") {
    return getDisplayWorkerName({
      fullName: params.partner.fullName,
      firstName: params.partner.firstName,
      viewerRole: params.viewerRole,
      appStatus: params.appStatus,
      hasWorkedTogether: params.hasWorkedTogether,
    });
  }
  return (params.partner.businessName || params.partner.fullName || params.partner.firstName || "Utente").trim() || "Utente";
}