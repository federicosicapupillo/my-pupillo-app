// Persists the restaurant's last-selected announcement so we can quickly
// reopen the same context (e.g. when returning to Messages).
const KEY_PREFIX = "pupillo:lastAnnouncementId:";

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function getLastAnnouncementId(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function setLastAnnouncementId(userId: string | null | undefined, id: string | null | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(key(userId), id);
    else window.localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
