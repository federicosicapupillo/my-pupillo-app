/**
 * Pure helpers for the realtime inbox in src/routes/messages.tsx.
 *
 * Extracted so we can unit-test the dedup / debounce guarantees without
 * mounting the route or stubbing Supabase channels. Used in production by
 * the messages list realtime subscription.
 */

export type InboxThread = {
  id: string;
  status: string;
  lastBody: string | null;
  lastAt: string | null;
  // The merge helper is agnostic to the other fields; callers keep them.
  [k: string]: unknown;
};

export type ApplicationRow = {
  id: string;
  status?: string | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
};

/**
 * Apply an application UPDATE payload to the current thread list WITHOUT
 * duplicating the row. If the row doesn't exist yet, the list is returned
 * unchanged — a full reload (debounced) is expected to bring it in.
 */
export function mergeThreadUpdate(
  threads: InboxThread[],
  row: ApplicationRow,
): InboxThread[] {
  let touched = false;
  const next = threads.map((t) => {
    if (t.id !== row.id) return t;
    touched = true;
    return {
      ...t,
      status: row.status ?? t.status,
      lastBody: row.last_message_preview ?? t.lastBody,
      lastAt: row.last_message_at ?? t.lastAt,
    };
  });
  // No-op when the row isn't tracked yet → keep referential equality so
  // React doesn't re-render needlessly.
  return touched ? next : threads;
}

/**
 * Returns true if an application UPDATE actually changed the inbox preview
 * (preview text or timestamp). Status-only changes do not need a reload
 * because mergeThreadUpdate already patches them locally.
 */
export function previewChanged(
  oldRow: ApplicationRow | null | undefined,
  newRow: ApplicationRow,
): boolean {
  if (!oldRow) return false;
  return (
    oldRow.last_message_at !== newRow.last_message_at ||
    oldRow.last_message_preview !== newRow.last_message_preview
  );
}

/**
 * Coalesce a burst of realtime events (application INSERT + message INSERT
 * + application UPDATE for preview) into a single reload call. Returns a
 * `schedule` to (re)arm the timer and a `cancel` to drop a pending call.
 */
export function createDebouncedReload(
  fn: () => void,
  delay = 120,
  setTimer: (cb: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  clearTimer: (h: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (handle) clearTimer(handle);
      handle = setTimer(() => {
        handle = null;
        fn();
      }, delay);
    },
    cancel() {
      if (handle) {
        clearTimer(handle);
        handle = null;
      }
    },
    get pending() {
      return handle !== null;
    },
  };
}