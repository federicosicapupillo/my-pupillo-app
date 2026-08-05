/**
 * Bridge esplicito "notifica → conversazione".
 *
 * Quando l'utente clicca "Apri" sul toast/popup di una notifica e si trova
 * già sulla stessa route `/messages/$id`, TanStack Router non rimonta nulla:
 * la pagina resterebbe con lo stato precedente (es. "Richiesta inviata")
 * anche se il turno è stato appena confermato. Questo canale permette di
 * chiedere un refetch completo del thread senza ricaricare la pagina.
 */
const EVENT = "pupillo:thread-refresh";

export function requestThreadRefresh(applicationId?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { applicationId: applicationId ?? null } }));
}

export function onThreadRefresh(
  applicationId: string,
  cb: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ applicationId: string | null }>).detail;
    if (!detail?.applicationId || detail.applicationId === applicationId) cb();
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
