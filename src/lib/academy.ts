/**
 * Pupillo Academy — unico punto in cui è definita la destinazione dei link.
 * Oggi non esiste un indirizzo pubblico verificato dell'Academy: tutti gli
 * inviti portano alla pagina informativa locale /academy. Quando l'indirizzo
 * pubblico sarà confermato, impostarlo qui (senza dati personali o token).
 */
export const ACADEMY_EXTERNAL_URL: string | null = null;
export const ACADEMY_INFO_PATH = "/academy" as const;

const INVITE_PENDING_KEY = "pupillo_academy_invite_pending";
const INVITE_DISMISSED_KEY = "pupillo_academy_invite_dismissed";

/** Segna che il lavoratore ha appena completato davvero il profilo. */
export function markAcademyInvitePending(): void {
  try {
    if (localStorage.getItem(INVITE_DISMISSED_KEY) === "true") return;
    localStorage.setItem(INVITE_PENDING_KEY, "true");
  } catch { /* storage non disponibile: nessun invito */ }
}

export function isAcademyInvitePending(): boolean {
  try {
    return localStorage.getItem(INVITE_PENDING_KEY) === "true" && localStorage.getItem(INVITE_DISMISSED_KEY) !== "true";
  } catch { return false; }
}

/** «Più tardi» o «Scopri»: l'invito non viene più riproposto. */
export function dismissAcademyInvite(): void {
  try {
    localStorage.removeItem(INVITE_PENDING_KEY);
    localStorage.setItem(INVITE_DISMISSED_KEY, "true");
  } catch { /* ignore */ }
}
