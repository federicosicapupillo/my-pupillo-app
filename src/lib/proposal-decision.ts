/**
 * PUPILLO — Fonte di verità unica per le azioni "Accetta candidatura" /
 * "Rifiuta candidatura" mostrate al lavoratore nel dettaglio chat.
 *
 * Esiste una sola implementazione delle azioni (box "Azioni disponibili"):
 * qualsiasi altra superficie deve riusare queste funzioni e non renderizzare
 * una seconda coppia di pulsanti.
 */

export type ProposalBusy = "accept" | "reject" | null;
export type ProposalLockReason = "completed" | "cancelled" | null;

export const PROPOSAL_ACCEPT_LABEL = "Accetta candidatura";
export const PROPOSAL_REJECT_LABEL = "Rifiuta candidatura";
export const PROPOSAL_BUSY_LABEL = "Operazione in corso…";

/**
 * Stato canonico della proposta: la risposta registrata sul database
 * (`proposal_responses`) vince sempre; solo le proposte storiche senza alcuna
 * risposta ricadono sullo stato della candidatura.
 */
export function resolveProposalEffectiveStatus(input: {
  ownStatus?: string | null;
  hasAnyResponse: boolean;
  applicationStatus?: string | null;
}): string {
  return (
    input.ownStatus ??
    (input.hasAnyResponse ? "pending" : (input.applicationStatus ?? "pending"))
  );
}

export function isProposalPending(status: string): boolean {
  return (
    status !== "accepted" &&
    status !== "rejected" &&
    status !== "not_interested" &&
    status !== "expired"
  );
}

export type ProposalDecisionState = {
  accepted: boolean;
  rejected: boolean;
  expired: boolean;
  locked: boolean;
  /** Nessuna transizione ulteriore possibile. */
  decided: boolean;
  /** I pulsanti decisionali sono renderizzati (solo lato lavoratore). */
  showActions: boolean;
  acceptDisabled: boolean;
  rejectDisabled: boolean;
  acceptLabel: string;
  rejectLabel: string;
  outcomeLabel: string | null;
};

export function getProposalDecisionState(input: {
  status: string;
  timeExpired?: boolean;
  lockReason?: ProposalLockReason;
  busy?: ProposalBusy;
  isWorker: boolean;
  /** Disponibilità speciale incompatibile: accetta bloccato, rifiuta attivo. */
  incompatibleSpecial?: boolean;
}): ProposalDecisionState {
  const busy = input.busy ?? null;
  const accepted = input.status === "accepted";
  const rejected = input.status === "rejected" || input.status === "not_interested";
  const expired =
    input.status === "expired" || (!accepted && !rejected && !!input.timeExpired);
  const locked = (input.lockReason ?? null) !== null;
  const decided = accepted || rejected || expired || locked;

  const outcomeLabel = accepted
    ? input.isWorker
      ? "Candidatura accettata"
      : "Proposta accettata"
    : rejected
      ? input.isWorker
        ? "Candidatura rifiutata"
        : "Proposta rifiutata"
      : expired
        ? "Proposta scaduta"
        : null;

  return {
    accepted,
    rejected,
    expired,
    locked,
    decided,
    showActions: input.isWorker && !decided,
    acceptDisabled: decided || busy !== null || !!input.incompatibleSpecial,
    rejectDisabled: decided || busy !== null,
    acceptLabel: busy === "accept" ? PROPOSAL_BUSY_LABEL : PROPOSAL_ACCEPT_LABEL,
    rejectLabel: busy === "reject" ? PROPOSAL_BUSY_LABEL : PROPOSAL_REJECT_LABEL,
    outcomeLabel,
  };
}
