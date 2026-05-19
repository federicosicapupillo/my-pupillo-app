import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrls } from "@/lib/avatars.functions";

// Signed URLs expire after 1h server-side; refresh cache after 50min.
const TTL_MS = 50 * 60 * 1000;
const STORAGE_KEY = "avatar-url-cache:v1";
type Entry = { url: string | null; name?: string | null; at: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();

// Hydrate cache from sessionStorage so SPA reloads don't re-fetch.
if (typeof window !== "undefined") {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Entry>;
      const now = Date.now();
      for (const [id, e] of Object.entries(parsed)) {
        if (e && typeof e.at === "number" && now - e.at < TTL_MS) cache.set(id, e);
      }
    }
  } catch {
    /* ignore */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const obj: Record<string, Entry> = {};
      for (const [id, e] of cache) obj[id] = e;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* ignore quota errors */
    }
  }, 250);
}

function isFresh(e: Entry | undefined): e is Entry {
  return !!e && Date.now() - e.at < TTL_MS;
}

export function useAvatarUrls(userIds: Array<string | null | undefined>) {
  const fetchUrls = useServerFn(getAvatarUrls);
  const [urls, setUrls] = useState<Record<string, string | null | undefined>>(() => {
    const init: Record<string, string | null | undefined> = {};
    for (const id of userIds) {
      const e = id ? cache.get(id) : undefined;
      if (id && isFresh(e)) init[id] = e.url;
    }
    return init;
  });

  const key = userIds.filter(Boolean).sort().join(",");

  useEffect(() => {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    let cancelled = false;
    const missing = ids.filter((id) => !isFresh(cache.get(id)));
    const toFetch = missing.filter((id) => !inflight.has(id));
    const waits: Promise<void>[] = [];
    if (toFetch.length > 0) {
      // Server fn validates max 100 ids per call. Chunk to avoid validation
      // failure when many markers are visible at once (e.g. the map view).
      const CHUNK = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < toFetch.length; i += CHUNK) {
        chunks.push(toFetch.slice(i, i + CHUNK));
      }
      const p = Promise.all(
        chunks.map((chunk) =>
          fetchUrls({ data: { userIds: chunk } })
            .then((res) => {
              const now = Date.now();
              const names = (res as { names?: Record<string, string | null> }).names ?? {};
              for (const [id, url] of Object.entries(res.urls)) {
                cache.set(id, { url, name: names[id] ?? null, at: now });
              }
              for (const id of chunk) {
                if (!cache.has(id)) cache.set(id, { url: null, name: null, at: now });
              }
            })
            .catch(() => {
              const now = Date.now();
              for (const id of chunk) {
                if (!cache.has(id)) cache.set(id, { url: null, name: null, at: now });
              }
            })
        ),
      )
        .then(() => {
          schedulePersist();
        })
        .finally(() => {
          for (const id of toFetch) inflight.delete(id);
        });
      for (const id of toFetch) inflight.set(id, p);
    }
    for (const id of missing) {
      const p = inflight.get(id);
      if (p) waits.push(p);
    }
    if (waits.length === 0) {
      // Sync cache → state in case other hook instances populated it.
      setUrls((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of ids) {
          const v = cache.get(id)?.url;
          if (next[id] !== v) { next[id] = v ?? null; changed = true; }
        }
        return changed ? next : prev;
      });
      return;
    }
    Promise.all(waits).then(() => {
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = cache.get(id)?.url ?? null;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function useAvatarUrl(userId: string | null | undefined) {
  const map = useAvatarUrls(userId ? [userId] : []);
  if (!userId) return null;
  return map[userId];
}

export function useUserName(userId: string | null | undefined): string | null {
  // Trigger fetch via the same shared cache.
  useAvatarUrls(userId ? [userId] : []);
  if (!userId) return null;
  return cache.get(userId)?.name ?? null;
}