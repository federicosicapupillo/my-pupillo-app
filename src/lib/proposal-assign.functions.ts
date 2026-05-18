import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeProposalStatus, computeAssignButtonState } from "./proposal-status";

const PROPOSAL_TEMPLATE_ID = "shift_proposal";

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
      .select("id, status, restaurant_id, worker_id, announcement_id, response_deadline")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (appErr) return { canAssign: false, reason: appErr.message };
    if (!app) return { canAssign: false, reason: "Conversazione non trovata." };
    if (app.restaurant_id !== userId) return { canAssign: false, reason: "Non autorizzato." };

    // Most recent proposal message in this conversation
    const { data: lastProposal } = await supabase
      .from("messages")
      .select("id, created_at")
      .eq("application_id", app.id)
      .eq("template_id", PROPOSAL_TEMPLATE_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const base = {
      applicationId: app.id,
      announcementId: app.announcement_id,
      workerId: app.worker_id,
      proposalId: lastProposal?.id ?? null,
    };

    let latestProposalStatus: ReturnType<typeof computeProposalStatus> | null = null;
    if (lastProposal) {
      const { data: response } = await supabase
        .from("proposal_responses")
        .select("status, responder_id, created_at")
        .eq("message_id", lastProposal.id)
        .eq("application_id", app.id)
        .eq("responder_id", app.worker_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      latestProposalStatus = computeProposalStatus({
        response: response ? { status: response.status as "accepted" | "rejected" } : null,
        applicationStatus: app.status,
        responseDeadline: (app as any).response_deadline ?? null,
        // The "lastProposal" query already returns the newest one, so it is by
        // definition not superseded by a newer proposal in this conversation.
        supersededByNewer: false,
      });
    }

    const btn = computeAssignButtonState({
      role: "restaurant",
      applicationStatus: app.status,
      latestProposalStatus,
      // The application row itself represents the worker's candidature on the
      // published announcement. When there is no explicit shift_proposal, this
      // worker-initiated candidature counts as the implicit proposal.
      workerApplied: true,
    });
    return { canAssign: btn.enabled, reason: btn.reason, ...base, latestProposalStatus };
  });