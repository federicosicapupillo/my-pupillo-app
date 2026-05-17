import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROPOSAL_TEMPLATE_ID = "shift_proposal";
const TERMINAL = ["accepted", "rejected", "not_interested"];

/**
 * Server-side authority: can the calling restaurant assign this shift right now?
 * Rule: enabled ONLY if the most recent proposal sent on this application/announcement
 * to this worker has been explicitly accepted by the worker (proposal_responses.status = 'accepted').
 */
export const canAssignShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, status, restaurant_id, worker_id, announcement_id")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (appErr) return { canAssign: false, reason: appErr.message };
    if (!app) return { canAssign: false, reason: "Conversazione non trovata." };
    if (app.restaurant_id !== userId) return { canAssign: false, reason: "Non autorizzato." };
    if (TERMINAL.includes(app.status)) return { canAssign: false, reason: "La candidatura è già chiusa." };

    // Most recent proposal message in this conversation
    const { data: lastProposal } = await supabase
      .from("messages")
      .select("id, created_at")
      .eq("application_id", app.id)
      .eq("template_id", PROPOSAL_TEMPLATE_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastProposal) {
      return {
        canAssign: false,
        reason: "Invia una proposta di lavoro per poter assegnare il turno.",
        applicationId: app.id,
        announcementId: app.announcement_id,
        workerId: app.worker_id,
      };
    }

    // Response of the worker to that specific proposal
    const { data: response } = await supabase
      .from("proposal_responses")
      .select("status, responder_id, created_at")
      .eq("message_id", lastProposal.id)
      .eq("application_id", app.id)
      .eq("responder_id", app.worker_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const base = {
      applicationId: app.id,
      announcementId: app.announcement_id,
      workerId: app.worker_id,
      proposalId: lastProposal.id,
    };

    if (!response) {
      return { canAssign: false, reason: "In attesa che il lavoratore accetti la proposta.", ...base };
    }
    if (response.status === "rejected") {
      return { canAssign: false, reason: "Il lavoratore ha rifiutato la proposta.", ...base };
    }
    if (response.status !== "accepted") {
      return { canAssign: false, reason: "In attesa che il lavoratore accetti la proposta.", ...base };
    }

    return { canAssign: true, reason: null, ...base };
  });