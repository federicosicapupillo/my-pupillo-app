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
    for (const row of rows ?? []) {
      const stored = (row as any).avatar_url as string | null;
      if (!stored) {
        result[row.id] = null;
        continue;
      }
      if (stored.startsWith("http")) {
        result[row.id] = stored;
        continue;
      }
      const { data: signed } = await admin.storage
        .from("avatars")
        .createSignedUrl(stored, 60 * 60);
      result[row.id] = signed?.signedUrl ?? null;
    }
    return { urls: result };
  });