import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { previewReset, resetAndReseedDemo, completeDemoProfiles } from "./demo-seed.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Errore verifica ruolo: " + error.message, { status: 500 });
  if (!data) throw new Response("Forbidden — admin only", { status: 403 });
}

export const previewDemoReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { emails?: string[]; phones?: string[] }) => ({
    emails: Array.isArray(input?.emails) ? input.emails.slice(0, 20) : [],
    phones: Array.isArray(input?.phones) ? input.phones.slice(0, 20) : [],
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return previewReset({ emails: data.emails, phones: data.phones });
  });

export const executeDemoReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    confirm: string;
    emails?: string[];
    phones?: string[];
    restaurants?: number;
    workers?: number;
  }) => {
    if (input?.confirm !== "RESET DEMO") {
      throw new Response("Confirmation phrase missing", { status: 400 });
    }
    return {
      emails: Array.isArray(input.emails) ? input.emails.slice(0, 20) : [],
      phones: Array.isArray(input.phones) ? input.phones.slice(0, 20) : [],
      restaurants: typeof input.restaurants === "number" ? Math.max(1, Math.min(200, input.restaurants)) : 100,
      workers: typeof input.workers === "number" ? Math.max(1, Math.min(500, input.workers)) : 300,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return resetAndReseedDemo(
      { emails: data.emails, phones: data.phones },
      { restaurants: data.restaurants, workers: data.workers },
    );
  });

export const completeDemoProfilesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return completeDemoProfiles(context.userId);
  });