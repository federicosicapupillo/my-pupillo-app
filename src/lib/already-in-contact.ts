import { supabase } from "@/integrations/supabase/client";

// Status considered "still in active contact" between worker and restaurant
// for a given announcement. Closed states (rejected/cancelled/expired/
// not_interested) free the pair to start a new conversation.
export const ACTIVE_CONTACT_STATUSES = [
  "pending",
  "interested",
  "counter_offer",
  "accepted",
] as const;

export type ActiveContactStatus = (typeof ACTIVE_CONTACT_STATUSES)[number];

export type ExistingContact =
  | { existing: true; applicationId: string }
  | { existing: false };

/**
 * Check whether an active application/proposal already exists between
 * a worker and a restaurant for a given announcement.
 * Returns the existing application id so the UI can route to the chat.
 */
export async function checkExistingContact(params: {
  announcementId: string;
  workerId: string;
}): Promise<ExistingContact> {
  const { announcementId, workerId } = params;
  if (!announcementId || !workerId) return { existing: false };
  const { data } = await supabase
    .from("applications")
    .select("id, status")
    .eq("announcement_id", announcementId)
    .eq("worker_id", workerId)
    .in("status", ACTIVE_CONTACT_STATUSES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) return { existing: true, applicationId: data.id as string };
  return { existing: false };
}

/** Detect a duplicate-key error from the partial unique index. */
export function isDuplicateContactError(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    msg.includes("applications_unique_active_per_ann_worker") ||
    msg.includes("duplicate key value") ||
    msg.includes("unique constraint")
  );
}