import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "admin-backups";
const PREFIX = "2026-05-18";

const FILES = [
  { key: "full",     name: "pupillo-full-backup-2026-05-18.zip",        label: "Backup completo (ZIP)" },
  { key: "sha256",   name: "pupillo-full-backup-2026-05-18.zip.sha256", label: "Checksum SHA256" },
  { key: "database", name: "pupillo-backup-database.zip",               label: "Solo database (schema + dati + RLS)" },
  { key: "auth",     name: "pupillo-backup-auth.zip",                   label: "Solo utenti Auth" },
  { key: "storage",  name: "pupillo-backup-storage.zip",                label: "Solo Storage (file + manifest)" },
  { key: "code",     name: "pupillo-backup-code.zip",                   label: "Solo codice progetto" },
] as const;

export type AdminBackupFile = {
  key: string;
  name: string;
  label: string;
  size: number;
  signedUrl: string;
  expiresInSeconds: number;
};

export const listAdminBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBackupFile[]> => {
    const { supabase, userId } = context;
    // Verify the caller has admin role via RLS-safe RPC
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: list, error: listErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(PREFIX, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (listErr) throw new Response(listErr.message, { status: 500 });
    const sizeMap = new Map<string, number>(
      (list ?? []).map((o) => [o.name, (o.metadata?.size as number) ?? 0]),
    );

    const expiresInSeconds = 60 * 30; // 30 minutes
    const out: AdminBackupFile[] = [];
    for (const f of FILES) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(`${PREFIX}/${f.name}`, expiresInSeconds, { download: f.name });
      if (error || !data) continue;
      out.push({
        key: f.key,
        name: f.name,
        label: f.label,
        size: sizeMap.get(f.name) ?? 0,
        signedUrl: data.signedUrl,
        expiresInSeconds,
      });
    }
    return out;
  });