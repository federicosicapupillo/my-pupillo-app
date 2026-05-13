import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrls } from "@/lib/avatars.functions";

const cache = new Map<string, string | null>();

export function useAvatarUrls(userIds: Array<string | null | undefined>) {
  const fetchUrls = useServerFn(getAvatarUrls);
  const [urls, setUrls] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const id of userIds) {
      if (id && cache.has(id)) init[id] = cache.get(id) ?? null;
    }
    return init;
  });

  const key = userIds.filter(Boolean).sort().join(",");

  useEffect(() => {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchUrls({ data: { userIds: missing } })
      .then((res) => {
        if (cancelled) return;
        for (const [id, url] of Object.entries(res.urls)) cache.set(id, url);
        setUrls((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = cache.get(id) ?? null;
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