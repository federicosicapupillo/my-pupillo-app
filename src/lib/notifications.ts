import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Idempotent notification insert.
 *
 * Builds a stable `dedupe_key` of the form `<kind>:<entityId>:<userId>` and
 * upserts on the partial unique index `(user_id, dedupe_key)`. If a row with
 * the same key already exists, the duplicate insert is silently ignored —
 * the database enforces "one notification per (user, event)".
 *
 * Use for every notification that maps to a single logical event for the
 * user (shift completed, review reminder, shift cancelled, ...). Skip only
 * for genuinely repeatable notifications (e.g. one per chat message).
 */
export type NotificationInput = {
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Logical event kind, e.g. "shift_completed", "worker_review_required". */
  kind: string;
  /** Stable entity id this notification refers to (shift_id, application_id, ...). */
  entityId: string;
};

export function buildDedupeKey(kind: string, entityId: string, userId: string): string {
  return `${kind}:${entityId}:${userId}`;
}

export async function insertNotification(
  supabase: Pick<SupabaseClient, "from">,
  input: NotificationInput,
): Promise<{ inserted: boolean; error: string | null }> {
  const dedupe_key = buildDedupeKey(input.kind, input.entityId, input.userId);
  const metadata = { ...(input.metadata ?? {}), kind: input.kind };
  const { error } = await (supabase.from("notifications") as any).upsert(
    {
      user_id: input.userId,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata,
      dedupe_key,
    },
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
  );
  if (error) return { inserted: false, error: error.message };
  return { inserted: true, error: null };
}

export async function insertNotifications(
  supabase: Pick<SupabaseClient, "from">,
  rows: NotificationInput[],
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null };
  const payload = rows.map((r) => ({
    user_id: r.userId,
    title: r.title,
    body: r.body ?? null,
    link: r.link ?? null,
    metadata: { ...(r.metadata ?? {}), kind: r.kind },
    dedupe_key: buildDedupeKey(r.kind, r.entityId, r.userId),
  }));
  const { error } = await (supabase.from("notifications") as any).upsert(payload, {
    onConflict: "user_id,dedupe_key",
    ignoreDuplicates: true,
  });
  return { error: error?.message ?? null };
}