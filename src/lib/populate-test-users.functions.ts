import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resetAndReseedDemo, completeDemoProfiles, type ResetReport, type CompleteDemoReport } from "./demo-seed.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Errore verifica ruolo: " + error.message, { status: 500 });
  if (!data) throw new Response("Forbidden — admin only", { status: 403 });
}

export const countExistingTestProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_demo", true);
    return { existing: count ?? 0 };
  });

export type PopulateReport = {
  seed: ResetReport;
  complete: CompleteDemoReport;
  password: string;
  sampleAccounts: string[];
};

export const populateTestUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workers?: number; restaurants?: number }) => ({
    workers: typeof input?.workers === "number" ? Math.max(1, Math.min(500, Math.floor(input.workers))) : 300,
    restaurants: typeof input?.restaurants === "number" ? Math.max(1, Math.min(200, Math.floor(input.restaurants))) : 100,
  }))
  .handler(async ({ data, context }): Promise<PopulateReport> => {
    await assertAdmin(context.userId);

    const seed = await resetAndReseedDemo(
      { emails: [], phones: [] },
      { restaurants: data.restaurants, workers: data.workers },
    );

    const complete = await completeDemoProfiles(context.userId);

    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: context.userId,
        action: "admin.populate_test_users",
        entity_type: "profiles",
        metadata: {
          batchId: seed.batchId,
          workers: data.workers,
          restaurants: data.restaurants,
          createdRestaurants: seed.createdPerTable.restaurants ?? 0,
          createdWorkers: seed.createdPerTable.workers ?? 0,
          createdAnnouncements: seed.createdPerTable.announcements ?? 0,
          updatedWorkers: complete.updatedWorkers,
          updatedRestaurants: complete.updatedRestaurants,
          errors: seed.errors.length + complete.errors.length,
        },
      });
    } catch {/* log best-effort */}

    return {
      seed,
      complete,
      password: "Test1234!",
      sampleAccounts: [
        "lavoratore-001@pupillo.test",
        "ristoratore-001@pupillo.test",
      ],
    };
  });