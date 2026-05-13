import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const InputSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export const getAvatarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", data.userIds);
    if (error) throw new Response(error.message, { status: 500 });

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result: Record<string, string | null> = {};
    // Strict path validator: <ownerUid>/avatar-<digits>.(jpg|jpeg|png|webp)
    const PATH_RE = /^([0-9a-f-]{36})\/avatar-\d+\.(jpe?g|png|webp)$/i;
    for (const row of rows ?? []) {
      const stored = (row as any).avatar_url as string | null;
      if (!stored || typeof stored !== "string") {
        result[row.id] = null;
        continue;
      }
      // Reject legacy/public URLs and any absolute/external reference.
      if (/^(https?:|data:|blob:|\/\/)/i.test(stored)) {
        result[row.id] = null;
        continue;
      }
      const m = stored.match(PATH_RE);
      // The path's owner folder MUST match the row's user id.
      if (!m || m[1] !== row.id) {
        result[row.id] = null;
        continue;
      }
      const { data: signed } = await admin.storage
        .from("avatars")
        .createSignedUrl(stored, 60 * 60);
      result[row.id] = signed?.signedUrl ?? null;
    }
    return { urls: result };
  });