import { supabase } from "@/integrations/supabase/client";
import type { SignupMethod } from "@/lib/auth-methods";

/**
 * Guardia unica per QUALSIASI flusso password di Pupillo.
 *
 * Regola (fail closed): solo gli account nati con email/password possono
 * impostare, cambiare o recuperare una password dentro Pupillo. Ogni altro
 * valore — google, apple, facebook, oauth, mancante o ambiguo — è negato.
 */

export const PASSWORD_MANAGEMENT_ERROR_CODE = "PASSWORD_MANAGEMENT_NOT_ALLOWED_FOR_SOCIAL_ACCOUNT";

export const PASSWORD_MANAGEMENT_ERROR_MESSAGE =
  "Il tuo account utilizza l'accesso tramite Google. La password non è gestita da Pupillo.";

/** Messaggio anti-enumerazione usato nei flussi di login/recupero. */
export const GENERIC_LOGIN_ERROR_MESSAGE =
  "Metodo di accesso non valido o credenziali non corrette.";

export class PasswordManagementNotAllowedError extends Error {
  readonly code = PASSWORD_MANAGEMENT_ERROR_CODE;
  constructor(message: string = PASSWORD_MANAGEMENT_ERROR_MESSAGE) {
    super(message);
    this.name = "PasswordManagementNotAllowedError";
  }
}

/** Unica regola applicativa: `email` → true, tutto il resto → false. */
export function canManagePassword(signupMethod: SignupMethod | string | null | undefined): boolean {
  if (typeof signupMethod !== "string") return false;
  return signupMethod.trim().toLowerCase() === "email";
}

/** Variante che solleva l'errore applicativo tipizzato. */
export function assertCanManagePassword(signupMethod: SignupMethod | string | null | undefined): void {
  if (!canManagePassword(signupMethod)) throw new PasswordManagementNotAllowedError();
}

/**
 * Metodo di registrazione canonico letto dal database (RPC `my_signup_method`,
 * security definer, sola lettura). Fail closed su errore o valore mancante.
 */
export async function fetchMySignupMethod(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_signup_method" as never);
  if (error) return null;
  const v = typeof data === "string" ? data.trim().toLowerCase() : "";
  return v.length > 0 ? v : null;
}

/** Verifica server-side (non la UI) prima di ogni scrittura password. */
export async function canManagePasswordServerSide(): Promise<boolean> {
  return canManagePassword(await fetchMySignupMethod());
}
