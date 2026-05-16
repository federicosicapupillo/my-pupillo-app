import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  applicationId: z.string().uuid(),
});

const proposalApplicationSchema = z.object({
  announcementId: z.string().uuid(),
  workerId: z.string().uuid(),
});

const resetPendingPatch = {
  status: "pending",
  worker_response_at: null,
} as const;

export const ensureProposalApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalApplicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing, error: existingError } = await supabase
      .from("applications")
      .select("id")
      .eq("announcement_id", data.announcementId)
      .eq("worker_id", data.workerId)
      .eq("restaurant_id", userId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("applications")
        .update(resetPendingPatch)
        .eq("id", existing.id);

      if (updateError) throw new Error(updateError.message);
      return { applicationId: existing.id, created: false };
    }

    const { data: created, error: createError } = await supabase
      .from("applications")
      .insert({
        announcement_id: data.announcementId,
        worker_id: data.workerId,
        restaurant_id: userId,
        status: "pending",
      })
      .select("id")
      .single();

    if (createError) {
      if (createError.code !== "23505") throw new Error(createError.message);

      const { data: fallback, error: fallbackError } = await supabase
        .from("applications")
        .select("id")
        .eq("announcement_id", data.announcementId)
        .eq("worker_id", data.workerId)
        .eq("restaurant_id", userId)
        .maybeSingle();

      if (fallbackError || !fallback?.id) {
        throw new Error(fallbackError?.message ?? createError.message);
      }

      const { error: updateError } = await supabase
        .from("applications")
        .update(resetPendingPatch)
        .eq("id", fallback.id);

      if (updateError) throw new Error(updateError.message);
      return { applicationId: fallback.id, created: false };
    }

    return { applicationId: created.id, created: true };
  });

// Marca come letti tutti i messaggi della proposta indicati al destinatario corrente.
// RLS garantisce che solo worker_id / restaurant_id dell'application possano aggiornare.
export const markApplicationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: updated, error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("application_id", data.applicationId)
      .neq("sender_id", userId)
      .is("read_at", null)
      .select("id");

    if (error) throw new Error(error.message);
    return { updated: updated?.length ?? 0 };
  });