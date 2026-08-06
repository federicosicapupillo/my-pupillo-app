/**
 * Ruolo scelto in fase di registrazione prima di un login social.
 *
 * Google/Apple non trasportano metadati applicativi: il ruolo selezionato
 * nella UI va memorizzato prima del redirect e "reclamato" (una sola volta)
 * al ritorno, tramite la RPC `claim_signup_role`.
 */
export type SignupRole = "restaurant" | "worker";

const KEY = "pupillo-pending-signup-role";

export function rememberPendingSignupRole(role: SignupRole) {
  try {
    sessionStorage.setItem(KEY, role);
  } catch {
    /* storage non disponibile */
  }
}

export function readPendingSignupRole(): SignupRole | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "restaurant" || v === "worker" ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingSignupRole() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage non disponibile */
  }
}
