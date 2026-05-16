import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  applicationId: z.string().uuid(),
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