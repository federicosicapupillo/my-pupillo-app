import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BACKUP_BUCKET = "admin-backups";

// Tabelle in ordine sicuro di INSERIMENTO (le figlie/derivate vengono dopo le
// genitori). L'eliminazione segue l'ordine inverso. Allineato a TABLES in
// backup-system.functions.ts + le tabelle aggiuntive richieste.
const RESTORE_ORDER = [
  "profiles",
  "user_roles",
  "discount_codes",
  "job_requests",
  "announcements",
  "applications",
  "shifts",
  "messages",
  "proposal_responses",
  "notifications",
  "reviews",
  "required_reviews",
  "worker_badges",
  "worker_incidents",
  "restaurant_worker_favorites",
  "favorites",
  "credit_transactions",
  "subscriptions",
  "referral_invites",
  "discount_redemptions",
  "phone_verifications",
  "activity_logs",
] as const;
type RestorableTable = (typeof RESTORE_ORDER)[number];

type BackupDump = {
  generated_at?: string;
  tables: Record<string, unknown>;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) {
    throw new Response("Operazione non autorizzata.", { status: 403 });
  }
}

// --------------------------------------------------------------------------
// List runs
// --------------------------------------------------------------------------
export type BackupRun = {
  logId: string | null;
  stamp: string; // cartella runs/<stamp>
  createdAt: string;
  status: string | null;
  type: string | null;
  databasePath: string;
  databaseSize: number | null;
  hasStorageManifest: boolean;
  includesFiles: boolean;
};

export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runs: BackupRun[] }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: folders, error: listErr } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .list("runs", { limit: 200, sortBy: { column: "name", order: "desc" } });
    if (listErr) throw new Response(listErr.message, { status: 500 });

    // Mappa stamp -> log row per riconciliare metadata (status, type, autore).
    const { data: logs } = await supabaseAdmin
      .from("backup_logs")
      .select("id, status, type, created_at, metadata, storage_backup_status")
      .order("created_at", { ascending: false })
      .limit(200);
    const logByStamp = new Map<string, any>();
    for (const l of (logs ?? []) as any[]) {
      const s = (l.metadata as any)?.stamp;
      if (typeof s === "string") logByStamp.set(s, l);
    }

    const runs: BackupRun[] = [];
    for (const folder of folders ?? []) {
      const stamp = folder.name;
      if (!stamp) continue;
      const { data: files } = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .list(`runs/${stamp}`, { limit: 50 });
      const db = files?.find((f) => f.name === "database.json");
      if (!db) continue;
      const manifest = files?.find((f) => f.name === "storage-manifest.json");
      const log = logByStamp.get(stamp);
      runs.push({
        logId: log?.id ?? null,
        stamp,
        createdAt: log?.created_at ?? (db.created_at as string) ?? stamp,
        status: log?.status ?? null,
        type: log?.type ?? "full",
        databasePath: `runs/${stamp}/database.json`,
        databaseSize: ((db.metadata as any)?.size as number | undefined) ?? null,
        hasStorageManifest: !!manifest,
        includesFiles: log?.storage_backup_status === "completed" && !!manifest,
      });
    }
    return { runs };
  });

// --------------------------------------------------------------------------
// Download (signed URL)
// --------------------------------------------------------------------------
export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ stamp: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const path = `runs/${data.stamp}/database.json`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(path, 60 * 30, { download: `pupillo-backup-${data.stamp}.json` });
    if (error || !signed) throw new Response(error?.message ?? "URL non disponibile", { status: 500 });
    return { url: signed.signedUrl };
  });

// --------------------------------------------------------------------------
// Delete
// --------------------------------------------------------------------------
export const deleteBackupRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        stamp: z.string().min(1).max(120),
        confirm: z.literal("ELIMINA BACKUP"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const prefix = `runs/${data.stamp}`;
    const { data: list, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .list(prefix, { limit: 50 });
    if (error) throw new Response(error.message, { status: 500 });
    const paths = (list ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length > 0) {
      const { error: delErr } = await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(paths);
      if (delErr) throw new Response(delErr.message, { status: 500 });
    }
    // marca il log come "deleted" se presente
    await supabaseAdmin
      .from("backup_logs")
      .update({ status: "deleted" })
      .contains("metadata", { stamp: data.stamp });
    return { deleted: paths.length };
  });

// --------------------------------------------------------------------------
// Validate
// --------------------------------------------------------------------------
type ValidationResult = {
  ok: boolean;
  reason?: string;
  tableCounts: Record<string, number>;
  hasAdmin: boolean;
  includesFiles: boolean;
};

function validateDump(dump: any, includesFiles: boolean): ValidationResult {
  const tableCounts: Record<string, number> = {};
  if (!dump || typeof dump !== "object" || !dump.tables || typeof dump.tables !== "object") {
    return { ok: false, reason: "Formato backup non riconosciuto.", tableCounts, hasAdmin: false, includesFiles };
  }
  for (const t of RESTORE_ORDER) {
    const rows = (dump.tables as any)[t];
    if (rows == null) { tableCounts[t] = 0; continue; }
    if (!Array.isArray(rows)) {
      return { ok: false, reason: `Tabella ${t} non valida nel backup.`, tableCounts, hasAdmin: false, includesFiles };
    }
    tableCounts[t] = rows.length;
  }
  // Tabelle essenziali presenti?
  if (!(dump.tables as any).profiles || !(dump.tables as any).user_roles) {
    return { ok: false, reason: "Backup incompleto: mancano profili o ruoli.", tableCounts, hasAdmin: false, includesFiles };
  }
  const roles = (dump.tables as any).user_roles as any[];
  const hasAdmin = Array.isArray(roles) && roles.some((r) => r && r.role === "admin");
  return { ok: true, tableCounts, hasAdmin, includesFiles };
}

export const validateBackupRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ stamp: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<ValidationResult & { stamp: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const path = `runs/${data.stamp}/database.json`;
    const { data: blob, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(path);
    if (error || !blob) {
      return {
        ok: false,
        reason: "Backup non valido o non compatibile.",
        tableCounts: {},
        hasAdmin: false,
        includesFiles: false,
        stamp: data.stamp,
      };
    }
    let dump: any = null;
    try { dump = JSON.parse(await blob.text()); } catch {
      return {
        ok: false,
        reason: "Backup non valido o non compatibile.",
        tableCounts: {},
        hasAdmin: false,
        includesFiles: false,
        stamp: data.stamp,
      };
    }
    const { data: manifest } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .list(`runs/${data.stamp}`, { limit: 10 });
    const includesFiles = !!manifest?.some((f) => f.name === "storage-manifest.json");
    return { ...validateDump(dump, includesFiles), stamp: data.stamp };
  });

// --------------------------------------------------------------------------
// Restore
// --------------------------------------------------------------------------
export type RestoreReport = {
  ok: boolean;
  stamp: string;
  preRestoreLogId: string | null;
  preRestoreStamp: string | null;
  restored: Record<string, number>;
  errors: string[];
  includesFilesNotice: boolean;
};

const CHUNK = 500;

// Crea uno snapshot inline (solo database) del DB corrente, usato come
// pre-restore-backup. Salva su admin-backups/runs/pre-restore-<stamp>/database.json
// e registra un record in backup_logs.
async function createDatabaseSnapshot(
  triggeredBy: string,
  prefix: "pre-restore" | "manual" = "pre-restore",
): Promise<{ logId: string | null; stamp: string }> {
  const startedAt = new Date();
  const stampRaw = startedAt.toISOString().replace(/[:.]/g, "-");
  const stamp = `${prefix}-${stampRaw}`;
  const { data: log } = await supabaseAdmin
    .from("backup_logs")
    .insert({
      status: "running",
      type: prefix,
      triggered_by: triggeredBy,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .maybeSingle();
  const logId = (log as any)?.id as string | undefined;

  const dump: any = { generated_at: startedAt.toISOString(), tables: {} };
  for (const t of RESTORE_ORDER) {
    const { data, error } = await (supabaseAdmin.from as any)(t).select("*").limit(50000);
    dump.tables[t] = error ? [] : (data ?? []);
  }
  const path = `runs/${stamp}/database.json`;
  const blob = new Blob([JSON.stringify(dump)], { type: "application/json" });
  const { error: upErr } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .upload(path, blob, { contentType: "application/json", upsert: true });
  const ok = !upErr;

  if (logId) {
    await supabaseAdmin
      .from("backup_logs")
      .update({
        status: ok ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        database_backup_status: ok ? "completed" : "failed",
        storage_backup_status: "skipped",
        github_backup_status: "skipped",
        error_message: upErr ? upErr.message.slice(0, 4000) : null,
        metadata: { stamp, kind: prefix, tables: RESTORE_ORDER.length },
      })
      .eq("id", logId);
  }
  return { logId: logId ?? null, stamp };
}

async function chunkInsert(
  table: string,
  rows: any[],
  errors: string[],
  restored: Record<string, number>,
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await (supabaseAdmin.from as any)(table).insert(slice);
    if (error) {
      // tentativo per riga per non bloccare l'intero blocco
      for (const r of slice) {
        const { error: rowErr } = await (supabaseAdmin.from as any)(table).insert(r);
        if (rowErr) errors.push(`${table}: ${rowErr.message}`);
        else restored[table] = (restored[table] ?? 0) + 1;
      }
    } else {
      restored[table] = (restored[table] ?? 0) + slice.length;
    }
  }
}

export const restoreBackupRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        stamp: z.string().min(1).max(120),
        confirm: z.literal("RIPRISTINA BACKUP"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RestoreReport> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const report: RestoreReport = {
      ok: false,
      stamp: data.stamp,
      preRestoreLogId: null,
      preRestoreStamp: null,
      restored: {},
      errors: [],
      includesFilesNotice: false,
    };

    // 1. Carica e valida il dump
    const path = `runs/${data.stamp}/database.json`;
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .download(path);
    if (dlErr || !blob) {
      report.errors.push("Backup non valido o non compatibile.");
      return report;
    }
    let dump: BackupDump;
    try {
      dump = JSON.parse(await blob.text());
    } catch {
      report.errors.push("Backup non valido o non compatibile.");
      return report;
    }
    const { data: dirList } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .list(`runs/${data.stamp}`, { limit: 10 });
    const includesFiles = !!dirList?.some((f) => f.name === "storage-manifest.json");
    const validation = validateDump(dump, includesFiles);
    if (!validation.ok) {
      report.errors.push(validation.reason ?? "Backup non valido o non compatibile.");
      return report;
    }
    report.includesFilesNotice = !includesFiles;

    // 2. Garanzia admin: prendi gli admin attuali per non chiudersi fuori
    const { data: currentAdminRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    if (roleErr) {
      report.errors.push("Impossibile verificare gli admin attuali.");
      return report;
    }
    const currentAdminIds = new Set(((currentAdminRows ?? []) as any[]).map((r) => r.user_id as string));
    const backupAdminIds = new Set(
      (((dump.tables as any).user_roles as any[]) ?? [])
        .filter((r) => r && r.role === "admin" && typeof r.user_id === "string")
        .map((r) => r.user_id as string),
    );
    const preservedAdminIds = new Set<string>([...currentAdminIds]);
    if (!validation.hasAdmin && currentAdminIds.size === 0) {
      report.errors.push("Il backup non contiene admin e non esistono admin correnti: ripristino bloccato.");
      return report;
    }

    // 3. Pre-restore snapshot automatico (DB only, inline)
    try {
      const snap = await createDatabaseSnapshot(userId, "pre-restore");
      report.preRestoreLogId = snap.logId;
      report.preRestoreStamp = snap.stamp;
    } catch (e) {
      report.errors.push(`pre-restore: ${e instanceof Error ? e.message : String(e)}`);
      return report; // mai ripristinare senza snapshot
    }

    // 4. Marca il log del restore come "running"
    const startedAt = new Date();
    const { data: restoreLog } = await supabaseAdmin
      .from("backup_logs")
      .insert({
        status: "running",
        type: "restore",
        triggered_by: userId,
        started_at: startedAt.toISOString(),
        metadata: { source_stamp: data.stamp, pre_restore_stamp: report.preRestoreStamp },
      })
      .select("id")
      .maybeSingle();
    const restoreLogId = (restoreLog as any)?.id as string | undefined;

    // 5. DELETE in ordine inverso, preservando gli admin
    const reversed = [...RESTORE_ORDER].reverse();
    for (const table of reversed) {
      try {
        if (table === "user_roles") {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .delete()
            .neq("role", "admin");
          if (error) report.errors.push(`delete user_roles: ${error.message}`);
        } else if (table === "profiles") {
          if (preservedAdminIds.size > 0) {
            const ids = Array.from(preservedAdminIds);
            const { error } = await supabaseAdmin
              .from("profiles")
              .delete()
              .not("id", "in", `(${ids.join(",")})`);
            if (error) report.errors.push(`delete profiles: ${error.message}`);
          } else {
            const { error } = await supabaseAdmin
              .from("profiles")
              .delete()
              .neq("id", "00000000-0000-0000-0000-000000000000");
            if (error) report.errors.push(`delete profiles: ${error.message}`);
          }
        } else {
          const { error } = await (supabaseAdmin.from as any)(table)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) report.errors.push(`delete ${table}: ${error.message}`);
        }
      } catch (e) {
        report.errors.push(`delete ${table}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 6. INSERT in ordine sicuro
    for (const table of RESTORE_ORDER) {
      const rows = ((dump.tables as any)[table] as any[]) ?? [];
      if (rows.length === 0) continue;
      let toInsert = rows;
      // Preserva gli admin attuali: salta righe del backup che entrerebbero
      // in conflitto con profili/ruoli admin già esistenti.
      if (table === "profiles" && preservedAdminIds.size > 0) {
        toInsert = rows.filter((r) => !preservedAdminIds.has(r?.id));
      }
      if (table === "user_roles" && preservedAdminIds.size > 0) {
        toInsert = rows.filter(
          (r) => !(r?.role === "admin" && preservedAdminIds.has(r?.user_id)),
        );
      }
      await chunkInsert(table as RestorableTable, toInsert, report.errors, report.restored);
    }

    const ok = report.errors.length === 0;
    report.ok = ok;
    if (restoreLogId) {
      await supabaseAdmin
        .from("backup_logs")
        .update({
          status: ok ? "completed" : "partial",
          completed_at: new Date().toISOString(),
          database_backup_status: ok ? "completed" : "partial",
          error_message: report.errors.length ? report.errors.join(" | ").slice(0, 4000) : null,
          metadata: {
            source_stamp: data.stamp,
            pre_restore_stamp: report.preRestoreStamp,
            restored: report.restored,
          },
        })
        .eq("id", restoreLogId);
    }
    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        action: "admin.restore_backup",
        entity_type: "backup",
        entity_id: null,
        metadata: {
          source_stamp: data.stamp,
          pre_restore_stamp: report.preRestoreStamp,
          restored: report.restored,
          errors: report.errors.length,
        },
      });
    } catch {/* best-effort */}

    return report;
  });