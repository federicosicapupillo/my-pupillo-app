import { supabase } from "@/integrations/supabase/client";
import { formatDateIT, formatTariff } from "@/lib/format";
import {
  checkWorkerShiftConflict,
  CONFLICT_RESTAURANT_REQUEST_MESSAGE,
} from "@/lib/shift-conflict";

export class WorkerBusyError extends Error {
  constructor(message = CONFLICT_RESTAURANT_REQUEST_MESSAGE) {
    super(message);
    this.name = "WorkerBusyError";
  }
}

/**
 * Build a short, unambiguous preview text for the inbox list. Two distinct
 * applications for the same worker+restaurant must be distinguishable, so the
 * preview includes role + date + (optional) time, not just a generic label.
 * Example: "Proposta: Bartender · 27/05 · 19:00 - 23:00".
 */
export function buildProposalPreview(ann: ProposalAnnouncement): string {
  const role = (ann.professional_profile ?? "").trim();
  const parts: string[] = [];
  if (role) parts.push(role.charAt(0).toUpperCase() + role.slice(1));
  if (ann.service_date) {
    const d = new Date(ann.service_date);
    if (!Number.isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }));
    }
  }
  const start = ann.service_time ? String(ann.service_time).slice(0, 5) : "";
  const end = ann.end_time ? String(ann.end_time).slice(0, 5) : "";
  if (start && end) parts.push(`${start} - ${end}`);
  else if (start) parts.push(start);
  return parts.length ? `Proposta: ${parts.join(" · ")}` : "Nuova proposta di lavoro";
}

export const PROPOSAL_TEMPLATE_ID = "shift_proposal";
export const PROPOSAL_ACTION = "propose_shift";

/**
 * Anti-duplicate gate used by the restaurant before sending a proposal from
 * the "Cerca lavoratori" flow. Given the proposal message ids already sent
 * to a worker for a given application, and the message ids that have a
 * response recorded in `proposal_responses`, returns true when at least one
 * proposal is still waiting for the worker's answer — in which case the UI
 * must NOT create a second one and must re-open the existing chat instead.
 */
export function hasUnansweredProposal(
  proposalIds: ReadonlyArray<string>,
  answeredMessageIds: ReadonlyArray<string>,
): boolean {
  if (proposalIds.length === 0) return false;
  const answered = new Set(answeredMessageIds);
  return proposalIds.some((id) => !answered.has(id));
}

export type ProposalAnnouncement = {
  id: string;
  service_date: string | null;
  service_time: string | null;
  end_time?: string | null;
  location_address: string | null;
  job_city?: string | null;
  tariff_amount?: number | string | null;
  tariff_type?: string | null;
  notes?: string | null;
  professional_profile?: string | null;
};

/** Plain-text fallback body for the proposal (also shown if the card UI can't render). */
export function buildProposalBody(ann: ProposalAnnouncement, venueName: string | null): string {
  const clean = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
    return s;
  };
  const lines: string[] = ["Nuova proposta di lavoro", "", "Ciao, sei disponibile per questo turno?", ""];
  lines.push(`Ruolo: ${clean(ann.professional_profile) || "Da definire"}`);
  if (ann.service_date) lines.push(`Data: ${formatDateIT(ann.service_date)}`);
  if (ann.service_time) {
    lines.push(`Orario: ${ann.service_time.slice(0, 5)}${ann.end_time ? " - " + ann.end_time.slice(0, 5) : ""}`);
  }
  lines.push(`Locale: ${clean(venueName) || "Locale da confermare"}`);
  const luogo = clean(ann.location_address) || clean(ann.job_city);
  if (luogo) lines.push(`Luogo: ${luogo}`);
  const amt = ann.tariff_amount == null ? null : Number(ann.tariff_amount);
  if (amt != null && Number.isFinite(amt) && amt > 0) {
    lines.push(`Compenso: ${formatTariff(ann.tariff_amount ?? null, ann.tariff_type ?? null)}`);
  }
  const notes = clean(ann.notes);
  if (notes) lines.push(`Note: ${notes}`);
  lines.push("", "Fammi sapere se puoi esserci.");
  return lines.join("\n");
}

/**
 * Insert a "shift proposal" message in the chat for the given application.
 * Fetches announcement + restaurant name automatically.
 */
export async function sendShiftProposal(params: {
  applicationId: string;
  announcementId: string;
  restaurantId: string;
  workerId: string;
}) {
  const { applicationId, announcementId, restaurantId, workerId } = params;
  const [{ data: ann }, { data: prof }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, service_date, service_time, end_time, location_address, job_city, tariff_amount, tariff_type, notes, professional_profile")
      .eq("id", announcementId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, full_name")
      .eq("id", restaurantId)
      .maybeSingle(),
  ]);
  // PUPILLO: regola di OCCUPAZIONE — non inviare proposta a un lavoratore
  // gia' occupato in quella fascia oraria (con buffer 1h post-fine).
  if (ann) {
    const conflict = await checkWorkerShiftConflict(workerId, ann as any, {
      ignoreApplicationId: applicationId,
    });
    if (conflict) {
      throw new WorkerBusyError();
    }
  }
  const venueName = (prof as any)?.business_name || (prof as any)?.full_name || null;
  const body = buildProposalBody((ann as ProposalAnnouncement) ?? { id: announcementId, service_date: null, service_time: null, location_address: null }, venueName);
  const createdAt = new Date().toISOString();
  await supabase.from("messages").insert({
    application_id: applicationId,
    sender_id: restaurantId,
    receiver_id: workerId,
    body,
    created_at: createdAt,
    read_at: null,
    template_id: PROPOSAL_TEMPLATE_ID,
    message_type: "template",
    action_type: PROPOSAL_ACTION,
  } as never);
  await supabase.from("applications").update({
    last_message_preview: buildProposalPreview((ann as ProposalAnnouncement) ?? { id: announcementId, service_date: null, service_time: null, location_address: null }),
    last_message_at: createdAt,
  } as never).eq("id", applicationId);
}