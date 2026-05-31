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
 * La card decisionale "Nuova candidatura" deve essere visibile al
 * ristoratore finché la candidatura è ancora "aperta" — cioè in stato
 * `pending` (candidatura/proposta non ancora gestita) oppure `interested`
 * (proposta inviata dal ristoratore e lavoratore che ha mostrato
 * interesse). In entrambi i casi il ristoratore deve poter agire
 * (Conferma / Rifiuta / Invia controfferta).
 */
export function shouldShowNewApplicationCard(params: {
  role: Role;
  status: ApplicationStatus | null | undefined;
  hasWorkerReputation: boolean;
}): boolean {
  return (
    params.role === "restaurant" &&
    (params.status === "pending" || params.status === "interested") &&
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