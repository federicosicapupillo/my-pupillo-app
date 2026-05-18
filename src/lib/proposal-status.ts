/**
 * Pure helpers describing the lifecycle of a shift proposal and the
 * coherence rule for the restaurant's "Assegna" button.
 *
 * These functions are intentionally side-effect-free so they can be unit-tested
 * and reused both server-side (canAssignShift) and client-side (chat UI).
 */

export type ProposalState =
  | "pending"    // "In attesa di risposta"
  | "accepted"   // "Accettata"
  | "rejected"   // "Rifiutata"
  | "expired"    // "Scaduta"
  | "cancelled"; // "Annullata"

export const TERMINAL_APP_STATUSES = ["accepted", "rejected", "not_interested"] as const;

export type ProposalInput = {
  /** Whether a newer proposal exists in the same conversation (supersedes this one). */
  supersededByNewer?: boolean;
  /** Worker response to THIS proposal, if any. */
  response?: { status: "accepted" | "rejected" } | null;
  /** Application-level status (closes the whole conversation). */
  applicationStatus?: string | null;
  /** Deadline for the worker to respond. */
  responseDeadline?: Date | string | null;
  /** Reference "now" — defaults to Date.now() for production calls. */
  now?: Date;
};

/** Derive the canonical state of a single proposal. */
export function computeProposalStatus(input: ProposalInput): ProposalState {
  const now = input.now ?? new Date();

  // A recorded response is the strongest signal — it wins over expiration/cancellation.
  if (input.response?.status === "accepted") return "accepted";
  if (input.response?.status === "rejected") return "rejected";

  // Newer proposal supersedes this one → annullata.
  if (input.supersededByNewer) return "cancelled";

  // Conversation closed at application level → annullata.
  const appStatus = input.applicationStatus ?? null;
  if (appStatus === "rejected" || appStatus === "not_interested") return "cancelled";

  // Deadline passed without a response → scaduta.
  if (input.responseDeadline) {
    const deadline =
      input.responseDeadline instanceof Date
        ? input.responseDeadline
        : new Date(input.responseDeadline);
    if (!Number.isNaN(deadline.getTime()) && now.getTime() >= deadline.getTime()) {
      return "expired";
    }
  }

  return "pending";
}

export type AssignButtonInput = {
  role: "restaurant" | "worker" | string | null | undefined;
  applicationStatus?: string | null;
  /** State of the most recent proposal in the conversation, or null if no proposal yet. */
  latestProposalStatus: ProposalState | null;
  /** Restaurant blocked because of pending mandatory reviews. */
  isBlocked?: boolean;
  /**
   * True when an application (worker candidature) exists for this conversation.
   * A worker candidature counts as an implicit proposal: the worker has already
   * shown interest in the published announcement, so the restaurant can
   * accept directly without sending a separate proposal.
   */
  workerApplied?: boolean;
};

export type AssignButtonState = {
  enabled: boolean;
  reason: string | null;
};

/**
 * Single source of truth for the "Assegna" button. The button is enabled ONLY
 * when the latest proposal of the chat is in state "accepted" AND the restaurant
 * is not blocked by overdue reviews AND the application is not already closed.
 */
export function computeAssignButtonState(input: AssignButtonInput): AssignButtonState {
  if (input.role !== "restaurant") {
    return { enabled: false, reason: null };
  }

  const appStatus = input.applicationStatus ?? null;
  if (appStatus && (TERMINAL_APP_STATUSES as readonly string[]).includes(appStatus)) {
    if (appStatus === "accepted") {
      return { enabled: false, reason: "Il turno è già stato assegnato." };
    }
    return { enabled: false, reason: "La candidatura è già chiusa." };
  }

  if (input.latestProposalStatus == null) {
    // Case 1 — worker candidature: the application itself is the proposal.
    // Restaurant can accept directly (subject to the review-blocker guard).
    if (input.workerApplied) {
      if (input.isBlocked) {
        return {
          enabled: false,
          reason: "Prima di assegnare nuovi turni devi chiudere e recensire i turni conclusi.",
        };
      }
      return { enabled: true, reason: null };
    }
    // Case 2 — no candidature and no proposal: restaurant must send a proposal first.
    return { enabled: false, reason: "Invia una proposta di lavoro per poter assegnare il turno." };
  }

  switch (input.latestProposalStatus) {
    case "pending":
      return { enabled: false, reason: "In attesa che il lavoratore accetti la proposta." };
    case "rejected":
      return { enabled: false, reason: "Il lavoratore ha rifiutato la proposta." };
    case "expired":
      return { enabled: false, reason: "La proposta è scaduta. Inviane una nuova per assegnare il turno." };
    case "cancelled":
      return { enabled: false, reason: "La proposta è stata annullata. Inviane una nuova per assegnare il turno." };
    case "accepted":
      if (input.isBlocked) {
        return {
          enabled: false,
          reason: "Prima di assegnare nuovi turni devi chiudere e recensire i turni conclusi.",
        };
      }
      return { enabled: true, reason: null };
  }
}