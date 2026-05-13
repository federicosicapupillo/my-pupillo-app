import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrls } from "@/lib/avatars.functions";

// Signed URLs expire after 1h server-side; refresh cache after 50min.
const TTL_MS = 50 * 60 * 1000;
type Entry = { url: string | null; at: number };
const cache = new Map<string, Entry>();

function isFresh(e: Entry | undefined): e is Entry {
  return !!e && Date.now() - e.at < TTL_MS;
}

export function useAvatarUrls(userIds: Array<string | null | undefined>) {
  const fetchUrls = useServerFn(getAvatarUrls);
  const [urls, setUrls] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const id of userIds) {
      const e = id ? cache.get(id) : undefined;
      if (id && isFresh(e)) init[id] = e.url;
    }
    return init;
  });

  const key = userIds.filter(Boolean).sort().join(",");

  useEffect(() => {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    const missing = ids.filter((id) => !isFresh(cache.get(id)));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchUrls({ data: { userIds: missing } })
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        for (const [id, url] of Object.entries(res.urls)) cache.set(id, { url, at: now });
        setUrls((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = cache.get(id)?.url ?? null;
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function useAvatarUrl(userId: string | null | undefined) {
  const map = useAvatarUrls(userId ? [userId] : []);
  return userId ? map[userId] ?? null : null;
}