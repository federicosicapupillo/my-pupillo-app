import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BACKUP_BUCKET = "admin-backups";

// Tables to snapshot. Keep in sync with public schema.
const TABLES = [
  "profiles", "user_roles", "announcements", "applications", "messages",
  "reviews", "shifts", "notifications", "credit_transactions",
  "subscriptions", "activity_logs", "discount_codes", "discount_redemptions",
  "referral_invites", "required_reviews", "restaurant_worker_favorites",
  "favorites", "job_requests", "worker_badges", "worker_incidents",
  "proposal_responses", "phone_verifications",
] as const;

export type BackupLogRow = {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  type: string;
  triggered_by: string | null;
  database_backup_status: string | null;
  storage_backup_status: string | null;
  github_backup_status: string | null;
  file_url: string | null;
  github_commit_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Response("Forbidden", { status: 403 });
}

export const listBackupLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ logs: BackupLogRow[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabaseAdmin
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Response(error.message, { status: 500 });
    return { logs: (data ?? []) as BackupLogRow[] };
  });

export const runFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ logId: string; status: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const startedAt = new Date();
    const stamp = startedAt.toISOString().replace(/[:.]/g, "-");

    // Create the log row (running)
    const { data: log, error: insErr } = await supabaseAdmin
      .from("backup_logs")
      .insert({
        status: "running",
        type: "full",
        triggered_by: userId,
        started_at: startedAt.toISOString(),
      })
      .select("*")
      .single();
    if (insErr || !log) throw new Response(insErr?.message ?? "insert failed", { status: 500 });

    const logId = log.id as string;
    const errors: string[] = [];
    let dbStatus: "completed" | "failed" = "failed";
    let storageStatus: "completed" | "failed" = "failed";
    let githubStatus: "completed" | "failed" | "skipped" = "skipped";
    let fileUrl: string | null = null;
    let githubCommitUrl: string | null = null;

    // === 1. Database snapshot ===
    const dbDump: Record<string, unknown> = {
      generated_at: startedAt.toISOString(),
      tables: {} as Record<string, unknown>,
    };
    try {
      for (const table of TABLES) {
        const { data, error } = await supabaseAdmin.from(table).select("*").limit(50000);
        if (error) {
          (dbDump.tables as any)[table] = { error: error.message };
          errors.push(`db:${table}:${error.message}`);
        } else {
          (dbDump.tables as any)[table] = data ?? [];
        }
      }
      const dbPath = `runs/${stamp}/database.json`;
      const dbBlob = new Blob([JSON.stringify(dbDump)], { type: "application/json" });
      const { error: upErr } = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .upload(dbPath, dbBlob, { contentType: "application/json", upsert: true });
      if (upErr) throw new Error(upErr.message);
      dbStatus = "completed";
      const { data: signed } = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .createSignedUrl(dbPath, 60 * 60 * 24);
      fileUrl = signed?.signedUrl ?? null;
    } catch (e) {
      errors.push(`database:${e instanceof Error ? e.message : String(e)}`);
    }

    // === 2. Storage manifest ===
    try {
      const buckets = ["avatars", "documents", "announcements", BACKUP_BUCKET];
      const manifest: Record<string, unknown> = { generated_at: startedAt.toISOString(), buckets: {} };
      for (const b of buckets) {
        try {
          const { data: list, error } = await supabaseAdmin.storage.from(b).list("", { limit: 1000 });
          if (error) {
            (manifest.buckets as any)[b] = { error: error.message };
          } else {
            (manifest.buckets as any)[b] = (list ?? []).map((o) => ({
              name: o.name,
              size: (o.metadata as any)?.size ?? null,
              updated_at: o.updated_at,
            }));
          }
        } catch (err) {
          (manifest.buckets as any)[b] = { error: err instanceof Error ? err.message : String(err) };
        }
      }
      const stPath = `runs/${stamp}/storage-manifest.json`;
      const stBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const { error: upErr } = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .upload(stPath, stBlob, { contentType: "application/json", upsert: true });
      if (upErr) throw new Error(upErr.message);
      storageStatus = "completed";
    } catch (e) {
      errors.push(`storage:${e instanceof Error ? e.message : String(e)}`);
    }

    // === 3. GitHub backup (optional, requires secrets) ===
    const ghToken = process.env.GITHUB_TOKEN;
    const ghRepo = process.env.GITHUB_REPO; // e.g. "owner/repo"
    if (ghToken && ghRepo) {
      try {
        // Get default branch HEAD SHA
        const repoRes = await fetch(`https://api.github.com/repos/${ghRepo}`, {
          headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
        });
        if (!repoRes.ok) throw new Error(`github repo: ${repoRes.status}`);
        const repo = await repoRes.json();
        const branch = repo.default_branch as string;
        const refRes = await fetch(`https://api.github.com/repos/${ghRepo}/git/ref/heads/${branch}`, {
          headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
        });
        if (!refRes.ok) throw new Error(`github ref: ${refRes.status}`);
        const ref = await refRes.json();
        const sha = ref.object.sha as string;
        const tagName = `backup-${stamp}`;
        const tagRes = await fetch(`https://api.github.com/repos/${ghRepo}/git/refs`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: `refs/tags/${tagName}`, sha }),
        });
        if (!tagRes.ok && tagRes.status !== 422) throw new Error(`github tag: ${tagRes.status}`);
        githubStatus = "completed";
        githubCommitUrl = `https://github.com/${ghRepo}/releases/tag/${tagName}`;
      } catch (e) {
        githubStatus = "failed";
        errors.push(`github:${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const completedAt = new Date();
    const overall =
      dbStatus === "completed" && storageStatus === "completed" && githubStatus !== "failed"
        ? "completed"
        : dbStatus === "failed" && storageStatus === "failed"
        ? "failed"
        : "partial";

    await supabaseAdmin
      .from("backup_logs")
      .update({
        status: overall,
        completed_at: completedAt.toISOString(),
        database_backup_status: dbStatus,
        storage_backup_status: storageStatus,
        github_backup_status: githubStatus,
        file_url: fileUrl,
        github_commit_url: githubCommitUrl,
        error_message: errors.length ? errors.join(" | ").slice(0, 4000) : null,
        metadata: { stamp, tables: TABLES.length },
      })
      .eq("id", logId);

    return { logId, status: overall };
  });