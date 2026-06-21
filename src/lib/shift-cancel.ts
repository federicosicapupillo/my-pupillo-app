import { supabase } from "@/integrations/supabase/client";

/**
 * Cancels a shift from the restaurant side WITHOUT issuing any credit refund.
 *
 * The restaurant is informed via UI that credits are non-refundable. This
 * helper:
 *  - updates the shift status to "cancelled" (the row is preserved);
 *  - notifies the assigned worker (notification + system chat message);
 *  - writes an activity log entry.
 *
 * It does NOT touch credit_transactions / subscriptions / refunds.
 */
export type CancelShiftInput = {
  shiftId: string;
  restaurantId: string;
  workerId: string | null;
  applicationId?: string | null;
  reason: string;
};

export async function cancelShiftWithNotifications(input: CancelShiftInput): Promise<void> {
  const { shiftId, restaurantId, workerId, applicationId, reason } = input;

  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" } as never)
    .eq("id", shiftId);
  if (error) throw new Error(error.message);

  if (workerId) {
    const notifBody = `Il servizio è stato annullato dal ristoratore.\n\nMotivazione:\n${reason}`;
    supabase.from("notifications").insert({
      user_id: workerId,
      title: "Servizio annullato",
      body: notifBody,
      link: applicationId ? `/messages/${applicationId}` : `/shifts?shift=${shiftId}`,
      metadata: { shift_id: shiftId, reason, kind: "shift_cancelled" },
    } as never).then(() => {}, () => {});

    if (applicationId) {
      const chatBody = `Il ristoratore ha annullato il servizio.\n\nMotivazione:\n${reason}`;
      supabase.from("messages").insert({
        application_id: applicationId,
        sender_id: restaurantId,
        receiver_id: workerId,
        body: chatBody,
        message_type: "system",
        template_id: "shift_cancelled",
      } as never).then(() => {}, () => {});
    }
  }

  supabase.from("activity_logs").insert({
    user_id: restaurantId,
    action: "shift_cancelled_by_restaurant",
    entity_type: "shift",
    entity_id: shiftId,
    metadata: { shift_id: shiftId, worker_id: workerId, reason },
  } as never).then(() => {}, () => {});
}