// Admin-only: hard-delete all non-admin profiles + related data + auth users + storage files.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Errore verifica ruolo: " + error.message, { status: 500 });
  if (!data) throw new Response("Forbidden — admin only", { status: 403 });
}

export type CleanupReport = {
  adminsKept: number;
  workersDeleted: number;
  restaurantsDeleted: number;
  otherProfilesDeleted: number;
  authUsersDeleted: number;
  storageFilesDeleted: number;
  perTable: Record<string, number>;
  errors: string[];
  durationMs: number;
};

async function listAdminIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  if (error) throw new Response("Errore lettura admin: " + error.message, { status: 500 });
  return new Set((data ?? []).map((r: any) => r.user_id));
}

async function deleteByUserColumn(
  table: string,
  column: string,
  ids: string[],
  report: CleanupReport,
) {
  if (ids.length === 0) return;
  const chunk = 200;
  let total = 0;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error, count } = await (supabaseAdmin.from as any)(table)
      .delete({ count: "exact" })
      .in(column, slice);
    if (error) {
      report.errors.push(`delete ${table}.${column}: ${error.message}`);
      continue;
    }
    total += count ?? 0;
  }
  report.perTable[table] = (report.perTable[table] ?? 0) + total;
}

async function deleteStorageForUsers(
  bucket: string,
  userIds: string[],
  report: CleanupReport,
) {
  for (const uid of userIds) {
    try {
      const { data: files, error } = await supabaseAdmin.storage.from(bucket).list(uid, { limit: 1000 });
      if (error) {
        report.errors.push(`storage.list(${bucket}/${uid}): ${error.message}`);
        continue;
      }
      if (!files || files.length === 0) continue;
      const paths = files.map((f) => `${uid}/${f.name}`);
      const { error: delErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (delErr) {
        report.errors.push(`storage.remove(${bucket}/${uid}): ${delErr.message}`);
        continue;
      }
      report.storageFilesDeleted += paths.length;
    } catch (e: any) {
      report.errors.push(`storage(${bucket}/${uid}): ${e?.message ?? e}`);
    }
  }
}

export const cleanupTestProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "CANCELLA TEST") {
      throw new Response("Conferma mancante: digitare CANCELLA TEST", { status: 400 });
    }
    return { confirm: input.confirm };
  })
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const t0 = Date.now();
    const report: CleanupReport = {
      adminsKept: 0,
      workersDeleted: 0,
      restaurantsDeleted: 0,
      otherProfilesDeleted: 0,
      authUsersDeleted: 0,
      storageFilesDeleted: 0,
      perTable: {},
      errors: [],
      durationMs: 0,
    };

    const adminIds = await listAdminIds();
    report.adminsKept = adminIds.size;

    // List all profiles to delete (non-admin)
    const { data: allProfiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, primary_role");
    if (profErr) throw new Response("Errore lettura profili: " + profErr.message, { status: 500 });

    const toDelete = (allProfiles ?? []).filter((p: any) => !adminIds.has(p.id));
    const targetIds = toDelete.map((p: any) => p.id);

    for (const p of toDelete as any[]) {
      if (p.primary_role === "worker") report.workersDeleted++;
      else if (p.primary_role === "restaurant") report.restaurantsDeleted++;
      else report.otherProfilesDeleted++;
    }

    if (targetIds.length === 0) {
      report.durationMs = Date.now() - t0;
      return report;
    }

    // 1. Storage: avatars + worker-documents (folder = userId)
    await deleteStorageForUsers("avatars", targetIds, report);
    await deleteStorageForUsers("worker-documents", targetIds, report);

    // 2. Get application IDs owned by target users (to clean child rows that don't have user_id)
    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("id")
      .or(`worker_id.in.(${targetIds.join(",")}),restaurant_id.in.(${targetIds.join(",")})`);
    const appIds = (apps ?? []).map((a: any) => a.id);

    // 3. Messages + proposal_responses tied to those applications
    if (appIds.length > 0) {
      await deleteByUserColumn("messages", "application_id", appIds, report);
      await deleteByUserColumn("proposal_responses", "application_id", appIds, report);
    }

    // 4. Delete dependent rows by user columns
    const byUser: Array<[string, string]> = [
      ["activity_logs", "user_id"],
      ["credit_transactions", "user_id"],
      ["discount_redemptions", "user_id"],
      ["notifications", "user_id"],
      ["phone_verifications", "user_id"],
      ["subscriptions", "user_id"],
      ["support_tickets", "user_id"],
      ["favorites", "user_id"],
      ["worker_availability", "worker_id"],
      ["worker_availability_exceptions", "worker_id"],
      ["worker_badges", "worker_id"],
      ["worker_incidents", "worker_id"],
      ["restaurant_worker_favorites", "restaurant_id"],
      ["restaurant_worker_favorites", "worker_id"],
      ["shifts", "worker_id"],
      ["shifts", "restaurant_id"],
      ["applications", "worker_id"],
      ["applications", "restaurant_id"],
      ["job_requests", "user_id"],
      ["announcements", "restaurant_id"],
      ["reviews", "author_id"],
      ["reviews", "target_id"],
      ["required_reviews", "worker_user_id"],
      ["required_reviews", "restaurant_user_id"],
      ["referral_invites", "referrer_user_id"],
      ["referral_invites", "referred_user_id"],
    ];
    for (const [table, col] of byUser) {
      await deleteByUserColumn(table, col, targetIds, report);
    }

    // 5. user_roles (non-admin)
    {
      const chunk = 200;
      for (let i = 0; i < targetIds.length; i += chunk) {
        const slice = targetIds.slice(i, i + chunk);
        const { error, count } = await supabaseAdmin
          .from("user_roles")
          .delete({ count: "exact" })
          .in("user_id", slice)
          .neq("role", "admin");
        if (error) report.errors.push(`delete user_roles: ${error.message}`);
        report.perTable["user_roles"] = (report.perTable["user_roles"] ?? 0) + (count ?? 0);
      }
    }

    // 6. profiles
    await deleteByUserColumn("profiles", "id", targetIds, report);

    // 7. Auth users (skip admins)
    for (const uid of targetIds) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (error) {
          report.errors.push(`auth.deleteUser(${uid}): ${error.message}`);
          continue;
        }
        report.authUsersDeleted++;
      } catch (e: any) {
        report.errors.push(`auth.deleteUser(${uid}): ${e?.message ?? e}`);
      }
    }

    // 8. Activity log
    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: context.userId,
        action: "admin.cleanup_test_profiles",
        entity_type: "profiles",
        metadata: {
          workersDeleted: report.workersDeleted,
          restaurantsDeleted: report.restaurantsDeleted,
          otherProfilesDeleted: report.otherProfilesDeleted,
          authUsersDeleted: report.authUsersDeleted,
          storageFilesDeleted: report.storageFilesDeleted,
          adminsKept: report.adminsKept,
          perTable: report.perTable,
          errors: report.errors.length,
        },
      });
    } catch (e: any) {
      report.errors.push(`activity_log: ${e?.message ?? e}`);
    }

    report.durationMs = Date.now() - t0;
    return report;
  });