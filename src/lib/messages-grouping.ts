/**
 * Returns the column name on `applications` that identifies the "other" party
 * in a conversation, given the current user's role.
 *
 * - Restaurant viewing messages → other = worker → column "worker_id"
 * - Worker viewing messages → other = restaurant → column "restaurant_id"
 */
export function otherColumnForRole(role: string | null | undefined): "worker_id" | "restaurant_id" {
  return role === "restaurant" ? "worker_id" : "restaurant_id";
}

export type GroupableThread = {
  id: string;
  other: { id: string; name: string };
  lastAt: string | null;
  unread: number;
};

export type ThreadGroup<T extends GroupableThread> = {
  id: string;
  name: string;
  items: T[];
  lastAt: string | null;
  unread: number;
};

/**
 * Visually groups threads by the "other" party id. Each application/chat stays
 * independent in the DB; this only buckets them for display:
 *  - restaurant side: groups by worker
 *  - worker side: groups by restaurant/locale
 */
export function groupThreadsByOther<T extends GroupableThread>(threads: T[]): ThreadGroup<T>[] {
  const m = new Map<string, ThreadGroup<T>>();
  for (const t of threads) {
    const g = m.get(t.other.id) ?? { id: t.other.id, name: t.other.name, items: [], lastAt: null, unread: 0 };
    g.items.push(t);
    if ((t.lastAt ?? "") > (g.lastAt ?? "")) g.lastAt = t.lastAt;
    g.unread += t.unread;
    m.set(t.other.id, g);
  }
  const arr = Array.from(m.values());
  arr.forEach((g) => g.items.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")));
  arr.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name));
  return arr;
}