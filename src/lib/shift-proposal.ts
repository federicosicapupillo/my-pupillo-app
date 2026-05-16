import { supabase } from "@/integrations/supabase/client";
import { formatDateIT, formatTariff } from "@/lib/format";

export const PROPOSAL_TEMPLATE_ID = "shift_proposal";
export const PROPOSAL_ACTION = "propose_shift";

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
    last_message_preview: "Nuova proposta di lavoro",
    last_message_at: createdAt,
  } as never).eq("id", applicationId);
}