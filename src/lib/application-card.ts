/**
 * Helpers per la card "Nuova candidatura ricevuta" mostrata nel thread
 * messaggi. Estratti come funzioni pure per essere testabili senza React.
 */

export type ApplicationStatus =
  | "pending"
  | "interested"
  | "not_interested"
  | "accepted"
  | "rejected"
  | "cancelled";

export type Role = "restaurant" | "worker";

export type DecisionAction = "accepted" | "rejected";

/**
 * La card decisionale "Nuova candidatura" deve essere visibile SOLO al
 * ristoratore e SOLO finché la candidatura è in stato `pending`.
 */
export function shouldShowNewApplicationCard(params: {
  role: Role;
  status: ApplicationStatus | null | undefined;
  hasWorkerReputation: boolean;
}): boolean {
  return (
    params.role === "restaurant" &&
    params.status === "pending" &&
    params.hasWorkerReputation === true
  );
}

/**
 * Calcola lo stato successivo della candidatura dopo Accetta/Rifiuta.
 * Ritorna `null` se la transizione non è ammessa (es. azione su una
 * candidatura non più in pending).
 */
export function nextApplicationStatus(
  current: ApplicationStatus | null | undefined,
  action: DecisionAction,
): ApplicationStatus | null {
  if (current !== "pending") return null;
  return action;
}