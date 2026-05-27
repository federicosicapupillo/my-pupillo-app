import { supabase } from "@/integrations/supabase/client";

export const DELAY_REASONS = [
  { value: "traffico", label: "Traffico" },
  { value: "mezzi_pubblici", label: "Problema mezzi pubblici" },
  { value: "imprevisto_personale", label: "Imprevisto personale" },
  { value: "problema_salute", label: "Problema di salute" },
  { value: "altro", label: "Altro" },
] as const;

export const CANCEL_REASONS = [
  { value: "problema_personale", label: "Problema personale" },
  { value: "problema_salute", label: "Problema di salute" },
  { value: "impossibilita_raggiungere", label: "Impossibilità a raggiungere il locale" },
  { value: "errore_disponibilita", label: "Errore nella disponibilità" },
  { value: "accettato_sbaglio", label: "Ho accettato per sbaglio" },
  { value: "altro", label: "Altro" },
] as const;

export const DELAY_MINUTE_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

export function delayReasonLabel(v: string | null | undefined): string {
  return DELAY_REASONS.find((r) => r.value === v)?.label ?? "Motivo non specificato";
}
export function cancelReasonLabel(v: string | null | undefined): string {
  return CANCEL_REASONS.find((r) => r.value === v)?.label ?? "Motivo non specificato";
}

function fmtMinutes(min: number): string {
  return min >= 60 ? "60+ minuti" : `${min} minuti`;
}

function buildShiftDescriptor(input: {
  role?: string | null;
  date?: string | null;
  time?: string | null;
}): string {
  const parts: string[] = ["turno"];
  if (input.role) parts.push(input.role);
  if (input.date) {
    parts.push(
      `del ${new Date(input.date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long" })}`,
    );
  }
  if (input.time) parts.push(`alle ${input.time.slice(0, 5)}`);
  return parts.join(" ");
}

export type ReportDelayInput = {
  workerId: string;
  restaurantId: string;
  shiftId: string;
  applicationId?: string | null;
  announcementId?: string | null;
  estimatedMinutes: number;
  reason: string;
  customReason?: string | null;
  context: { role?: string | null; date?: string | null; time?: string | null };
};

/** Insert (or update existing) delay incident, post chat + notification. */
export async function reportDelay(input: ReportDelayInput): Promise<void> {
  const {
    workerId, restaurantId, shiftId, applicationId, announcementId,
    estimatedMinutes, reason, customReason, context,
  } = input;

  const reasonText = reason === "altro" ? (customReason?.trim() || "Altro") : delayReasonLabel(reason);
  const descriptor = buildShiftDescriptor(context);

  // Upsert: if a pending delay already exists for this shift, update it.
  const { data: existing } = await supabase
    .from("worker_incidents")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("kind", "delay")
    .maybeSingle();

  const payload: any = {
    worker_id: workerId,
    restaurant_id: restaurantId,
    shift_id: shiftId,
    application_id: applicationId ?? null,
    kind: "delay",
    incident_type: "delay",
    status: "pending",
    estimated_delay_minutes: estimatedMinutes,
    reason,
    custom_reason: reason === "altro" ? (customReason?.trim() || null) : null,
    description: `Ritardo stimato ${fmtMinutes(estimatedMinutes)} — ${reasonText}`,
    affects_reputation: true,
    affects_compensation: false,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("worker_incidents")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("worker_incidents").insert(payload);
    if (error) throw new Error(error.message);
  }

  // Chat message (only if a conversation exists).
  if (applicationId) {
    const chatBody = `Il lavoratore ha segnalato un ritardo stimato di ${fmtMinutes(estimatedMinutes)}. Motivazione: ${reasonText}.`;
    await supabase.from("messages").insert({
      application_id: applicationId,
      sender_id: workerId,
      receiver_id: restaurantId,
      body: chatBody,
      message_type: "system",
      action_type: "worker_delay_reported",
    } as never);
  }

  // Notification to restaurant.
  await supabase.from("notifications").insert({
    user_id: restaurantId,
    title: "Ritardo segnalato dal lavoratore",
    body: `Il lavoratore ha segnalato un ritardo per il ${descriptor}.`,
    link: applicationId ? `/messages/${applicationId}` : `/shifts?shift=${shiftId}`,
    metadata: {
      kind: "worker_delay_reported",
      shift_id: shiftId,
      estimated_delay_minutes: estimatedMinutes,
      reason,
    },
  } as never);

  // Activity log.
  await supabase.from("activity_logs").insert({
    user_id: workerId,
    action: "worker_delay_reported",
    entity_type: "shift",
    entity_id: shiftId,
    metadata: {
      shift_id: shiftId,
      application_id: applicationId,
      announcement_id: announcementId,
      estimated_delay_minutes: estimatedMinutes,
      reason,
      custom_reason: customReason ?? null,
    },
  } as never);
}

export type CancelPresenceInput = {
  workerId: string;
  restaurantId: string;
  shiftId: string;
  applicationId?: string | null;
  announcementId?: string | null;
  reason: string;
  customReason?: string | null;
  note?: string | null;
  context: { role?: string | null; date?: string | null; time?: string | null };
};

/**
 * Worker cancels their presence on a confirmed shift: marks the shift as
 * cancelled, logs the incident, closes the application chat and notifies
 * the restaurant. Reopens the announcement so the restaurant can search a
 * new worker.
 */
export async function cancelPresence(input: CancelPresenceInput): Promise<void> {
  const {
    workerId, restaurantId, shiftId, applicationId, announcementId,
    reason, customReason, note, context,
  } = input;

  const reasonText = reason === "altro" ? (customReason?.trim() || "Altro") : cancelReasonLabel(reason);
  const descriptor = buildShiftDescriptor(context);

  // 1) Mark the shift as cancelled (RLS allows worker, see "Parties update shifts").
  const { error: shiftErr } = await supabase
    .from("shifts")
    .update({ status: "cancelled" } as never)
    .eq("id", shiftId)
    .eq("worker_id", workerId)
    .eq("status", "scheduled");
  if (shiftErr) throw new Error(shiftErr.message);

  // 2) Log the incident.
  const { error: incErr } = await supabase.from("worker_incidents").insert({
    worker_id: workerId,
    restaurant_id: restaurantId,
    shift_id: shiftId,
    application_id: applicationId ?? null,
    kind: "cancellation",
    incident_type: "worker_cancelled",
    status: "pending",
    reason,
    custom_reason: reason === "altro" ? (customReason?.trim() || null) : null,
    description: [`Annullamento presenza — ${reasonText}`, note?.trim() || null]
      .filter(Boolean).join("\n"),
    affects_reputation: true,
    affects_compensation: true,
  } as never);
  if (incErr) throw new Error(incErr.message);

  // 3) Re-open the announcement so the restaurant can search a new worker.
  if (announcementId) {
    await supabase
      .from("announcements")
      .update({ assigned_worker_id: null, status: "active" } as never)
      .eq("id", announcementId)
      .eq("restaurant_id", restaurantId);
  }

  // 4) Close the application (RLS allows the worker through can_update_application).
  if (applicationId) {
    await supabase
      .from("applications")
      .update({
        status: "cancelled",
        last_message_preview: "Presenza annullata dal lavoratore",
        last_message_at: new Date().toISOString(),
      } as never)
      .eq("id", applicationId);

    const chatBody =
      "Il lavoratore ha annullato la propria presenza per questo turno. La candidatura è stata chiusa automaticamente.";
    await supabase.from("messages").insert({
      application_id: applicationId,
      sender_id: workerId,
      receiver_id: restaurantId,
      body: chatBody,
      message_type: "system",
      action_type: "worker_presence_cancelled",
    } as never);
  }

  // 5) Notify restaurant.
  await supabase.from("notifications").insert({
    user_id: restaurantId,
    title: "Presenza annullata dal lavoratore",
    body: `Il lavoratore ha annullato la propria presenza per il ${descriptor}.`,
    link: applicationId ? `/messages/${applicationId}` : `/shifts?shift=${shiftId}`,
    metadata: {
      kind: "worker_presence_cancelled",
      shift_id: shiftId,
      announcement_id: announcementId,
      reason,
    },
  } as never);

  // 6) Activity log.
  await supabase.from("activity_logs").insert({
    user_id: workerId,
    action: "worker_presence_cancelled",
    entity_type: "shift",
    entity_id: shiftId,
    metadata: {
      shift_id: shiftId,
      application_id: applicationId,
      announcement_id: announcementId,
      reason,
      custom_reason: customReason ?? null,
      note: note ?? null,
    },
  } as never);
}