/**
 * Pupillo Academy — unico punto in cui è definita la destinazione dei link.
 * Indirizzo pubblico confermato dal titolare il 23/11/2026.
 */
export const ACADEMY_EXTERNAL_URL: string | null = "https://accademy.pupillo.life/";
export const ACADEMY_INFO_PATH = "/academy" as const;

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const pendingKey = (userId: string) => `pupillo_academy_invite_pending:${userId}`;
const dismissedKey = (userId: string) => `pupillo_academy_invite_dismissed:${userId}`;

function store(s?: KV): KV | null {
  if (s) return s;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** Il lavoratore `userId` ha appena completato davvero il profilo. */
export function markAcademyInvitePending(userId: string, s?: KV): void {
  const st = store(s); if (!st || !userId) return;
  try {
    if (st.getItem(dismissedKey(userId)) === "true") return;
    st.setItem(pendingKey(userId), "true");
  } catch { /* storage non disponibile: nessun invito */ }
}

export function isAcademyInvitePending(userId: string, s?: KV): boolean {
  const st = store(s); if (!st || !userId) return false;
  try {
    return st.getItem(pendingKey(userId)) === "true" && st.getItem(dismissedKey(userId)) !== "true";
  } catch { return false; }
}

/** «Scopri» o «Più tardi»: l'invito non viene più riproposto a questo utente. */
export function dismissAcademyInvite(userId: string, s?: KV): void {
  const st = store(s); if (!st || !userId) return;
  try {
    st.removeItem(pendingKey(userId));
    st.setItem(dismissedKey(userId), "true");
  } catch { /* ignore */ }
}
