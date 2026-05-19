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

export type MessageRow = {
  id?: string;
  application_id: string;
  sender_id: string;
  body?: string | null;
  created_at?: string | null;
  read_at?: string | null;
};

export type ProposalResponseRow = {
  application_id: string;
  status: "accepted" | "rejected" | string;
  created_at?: string | null;
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
 * Increment the unread counter (and refresh preview/order) for the thread
 * that owns this incoming message, when it was sent by someone OTHER than
 * the current viewer and the conversation isn't already open.
 *
 * Returns the same array reference when nothing changed so React skips the
 * re-render.
 */
export function applyIncomingMessage(
  threads: InboxThread[],
  msg: MessageRow,
  viewerId: string,
  openConversationId: string | null,
): InboxThread[] {
  if (msg.sender_id === viewerId) return threads;
  let touched = false;
  const next = threads.map((t) => {
    if (t.id !== msg.application_id) return t;
    touched = true;
    const isOpen = openConversationId === t.id;
    const alreadyRead = !!msg.read_at;
    const bump = isOpen || alreadyRead ? 0 : 1;
    return {
      ...t,
      unread: ((t.unread as number) ?? 0) + bump,
      lastBody: msg.body ?? t.lastBody,
      lastAt: msg.created_at ?? t.lastAt,
    };
  });
  return touched ? next : threads;
}

/**
 * Immediately reflect a proposal response (accept / reject) on the parent
 * application thread, before the debounced reload arrives. Keeps the inbox
 * badge in sync with the chat action.
 */
export function applyProposalResponse(
  threads: InboxThread[],
  resp: ProposalResponseRow,
): InboxThread[] {
  const nextStatus = resp.status === "accepted" || resp.status === "rejected"
    ? resp.status
    : null;
  if (!nextStatus) return threads;
  let touched = false;
  const next = threads.map((t) => {
    if (t.id !== resp.application_id) return t;
    if (t.status === nextStatus) return t;
    touched = true;
    return { ...t, status: nextStatus };
  });
  return touched ? next : threads;
}

/**
 * Decrement unread when the current user has just read messages in a
 * conversation (e.g. after opening the chat or marking them read).
 */
export function clearThreadUnread(
  threads: InboxThread[],
  applicationId: string,
): InboxThread[] {
  let touched = false;
  const next = threads.map((t) => {
    if (t.id !== applicationId) return t;
    if (((t.unread as number) ?? 0) === 0) return t;
    touched = true;
    return { ...t, unread: 0 };
  });
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