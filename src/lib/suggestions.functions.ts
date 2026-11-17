import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { suggestionSchema } from "./suggestions-schema";

export const submitSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => suggestionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const { error } = await context.supabase.from("user_suggestions").insert({
      id, user_id: context.userId, message: data.message,
    });
    if (error) throw new Error("Non è stato possibile inviare il suggerimento. Riprova.");
    // Saving is authoritative: a failed owner email must not prompt a duplicate submission.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("suggestion-owner", "federico.sica@gmail.com", {
        templateData: { message: data.message, userId: context.userId },
        idempotencyKey: `suggestion-owner-${id}`,
      });
    } catch {
      console.error("Suggestion owner email failed", { suggestionId: id });
    }
    return { id };
  });