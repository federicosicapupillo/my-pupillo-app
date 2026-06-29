import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the "chat con messaggi da leggere" counter.
 *
 * Counts distinct conversation threads (applications) where the current user
 * has received at least one message that is NOT sent by them and NOT yet
 * marked as read. Mirrors exactly the metric computed by `/messages`
 * (see `totalUnread` in `src/routes/messages.tsx`) so the dashboard, the
 * navbar badge and the inbox stay in sync.
 *
 * Rules enforced here:
 *  - recipient is the current user (RLS scopes `messages` to chats the user
 *    is part of, plus we constrain by `application_id` of the user's own
 *    applications row);
 *  - sender is NOT the current user (no self-sent messages, including
 *    system messages emitted as the user — they would only inflate the
 *    counter against the user themselves);
 *  - message is truly unread (`read_at IS NULL`);
 *  - one chat = one application row, deduped via `Set`.
 *
 * Returns 0 when there is no user / no role / no applications.
 */
export async function countUnreadChats(
  userId: string | null | undefined,
  role: string | null | undefined,
): Promise<number> {
  if (!userId) return 0;
  const col = role === "restaurant" ? "restaurant_id" : "worker_id";
  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq(col, userId);
  const ids = (apps ?? []).map((a: { id: string }) => a.id);
  if (ids.length === 0) return 0;
  const { data: rows } = await supabase
    .from("messages")
    .select("application_id")
    .in("application_id", ids)
    .neq("sender_id", userId)
    .is("read_at", null);
  return new Set((rows ?? []).map((r: { application_id: string }) => r.application_id)).size;
}