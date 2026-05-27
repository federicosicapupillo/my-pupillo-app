import { supabase } from "@/integrations/supabase/client";

export const CANCELLATION_REASONS = [
  { value: "non_necessario", label: "Turno non più necessario" },
  { value: "errore_pubblicazione", label: "Errore nella pubblicazione" },
  { value: "modifica_orario", label: "Orario o data da modificare" },
  { value: "personale_trovato", label: "Personale già trovato" },
  { value: "problema_organizzativo", label: "Problema organizzativo del locale" },
  { value: "altro", label: "Altro" },
] as const;

export type CancellationReasonValue = (typeof CANCELLATION_REASONS)[number]["value"];

export function reasonLabel(value: string | null | undefined): string {
  return CANCELLATION_REASONS.find((r) => r.value === value)?.label ?? "Motivo non specificato";
}

/** Statuses considered "open" for an application — should be closed on cancellation. */
const OPEN_APP_STATUSES = ["pending", "interested", "counter_offer"] as const;

export type CancelAnnouncementInput = {
  announcementId: string;
  restaurantId: string;
  reason: CancellationReasonValue;
  note?: string | null;
  venueName?: string | null;
  serviceDate?: string | null;
  serviceTime?: string | null;
  professionalProfile?: string | null;
};

function buildNotifBody(input: CancelAnnouncementInput): string {
  const role = input.professionalProfile?.trim();
  const date = input.serviceDate
    ? new Date(input.serviceDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long" })
    : null;
  const time = input.serviceTime ? input.serviceTime.slice(0, 5) : null;
  const venue = input.venueName?.trim();

  const parts: string[] = ["Il turno"];
  if (role) parts.push(role);
  if (venue) parts.push(`presso ${venue}`);
  if (date) parts.push(`del ${date}`);
  if (time) parts.push(`alle ${time}`);
  parts.push("è stato annullato dal ristoratore.");
  return parts.join(" ");
}

/**
 * Cancels an announcement from the restaurant side and notifies all open
 * (non-finalised) candidates via a chat message + a notification.
 *
 * Returns the number of candidates notified.
 */
export async function cancelAnnouncementWithNotifications(
  input: CancelAnnouncementInput,
): Promise<{ notified: number }> {
  const { announcementId, restaurantId, reason, note } = input;

  // Idempotency: refuse to cancel twice.
  const { data: current, error: fetchErr } = await supabase
    .from("announcements")
    .select("id, status, assigned_worker_id, cancelled_at")
    .eq("id", announcementId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!current) throw new Error("Annuncio non trovato.");
  if ((current as any).status === "cancelled" || (current as any).cancelled_at) {
    return { notified: 0 };
  }

  const nowIso = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("announcements")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_note: note?.trim() || null,
      cancelled_at: nowIso,
      cancelled_by: restaurantId,
    } as never)
    .eq("id", announcementId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "cancelled");
  if (updErr) throw new Error(updErr.message);

  // Fetch open applications (not yet finalised).
  const { data: openApps, error: appsErr } = await supabase
    .from("applications")
    .select("id, worker_id, status")
    .eq("announcement_id", announcementId)
    .in("status", OPEN_APP_STATUSES as unknown as string[]);
  if (appsErr) throw new Error(appsErr.message);

  const apps = (openApps ?? []) as Array<{ id: string; worker_id: string; status: string }>;
  if (apps.length === 0) return { notified: 0 };

  // Close applications.
  await supabase
    .from("applications")
    .update({ status: "cancelled", last_message_preview: "Turno annullato dal ristoratore", last_message_at: nowIso } as never)
    .in("id", apps.map((a) => a.id));

  // Build notification + chat message bodies.
  const notifBody = buildNotifBody(input);
  const chatBody = "Il ristoratore ha annullato questo turno. La candidatura è stata chiusa automaticamente.";

  // Insert one notification per worker.
  const notifRows = apps.map((a) => ({
    user_id: a.worker_id,
    title: "Turno annullato",
    body: notifBody,
    link: `/messages/${a.id}`,
  }));
  try {
    await supabase.from("notifications").insert(notifRows as never);
  } catch (e) {
    console.error("[cancelAnnouncement] notifications insert failed", e);
  }

  // Insert one system message per application chat.
  const msgRows = apps.map((a) => ({
    application_id: a.id,
    sender_id: restaurantId,
    receiver_id: a.worker_id,
    body: chatBody,
    message_type: "system",
    action_type: "announcement_cancelled",
    created_at: nowIso,
  }));
  try {
    await supabase.from("messages").insert(msgRows as never);
  } catch (e) {
    console.error("[cancelAnnouncement] chat messages insert failed", e);
  }

  return { notified: apps.length };
}