import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

function fallbackAvatarUrl(userId: string, name: string | null, isRestaurant: boolean) {
  const seed = encodeURIComponent(name?.trim() || userId);
  // DiceBear: deterministic, free, CDN-hosted. Different style for restaurants
  // so they're visually distinguishable from worker portraits.
  const style = isRestaurant ? "shapes" : "initials";
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear`;
}

export const getAvatarUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("public_profiles")
      .select("id, avatar_url, full_name, business_name")
      .in("id", data.userIds);
    if (error) throw new Response(error.message, { status: 500 });

    // Read only visible public profiles as the viewer; privileged access is
    // limited to signing validated owner paths in the private avatar bucket.
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const result: Record<string, string | null> = {};
    const names: Record<string, string | null> = {};
    // Strict path validator: <ownerUid>/avatar-<digits>.(jpg|jpeg|png|webp)
    const PATH_RE = /^([0-9a-f-]{36})\/avatar-\d+\.(jpe?g|png|webp)$/i;
    for (const row of rows ?? []) {
      if (!row.id) continue;
      const r = row as any;
      const businessName = (r.business_name as string | null) || null;
      const fullName = (r.full_name as string | null) || null;
      const displayName = businessName || fullName;
      const isRestaurant = !!businessName;
      names[row.id] = displayName;
      const stored = (row as any).avatar_url as string | null;
      if (!stored || typeof stored !== "string") {
        result[row.id] = fallbackAvatarUrl(row.id, displayName, isRestaurant);
        continue;
      }
      // Legacy/seed data may store a full http(s) URL (e.g. seed avatars).
      // Pass these through directly so the avatar still renders.
      if (/^https?:\/\//i.test(stored)) {
        result[row.id] = stored;
        continue;
      }
      // Reject other absolute/external schemes (data:, blob:, protocol-relative).
      if (/^(data:|blob:|\/\/)/i.test(stored)) {
        result[row.id] = fallbackAvatarUrl(row.id, displayName, isRestaurant);
        continue;
      }
      const m = stored.match(PATH_RE);
      // The path's owner folder MUST match the row's user id.
      if (!m || m[1] !== row.id) {
        result[row.id] = fallbackAvatarUrl(row.id, displayName, isRestaurant);
        continue;
      }
      const { data: signed } = await admin.storage
        .from("avatars")
        .createSignedUrl(stored, 60 * 60);
      result[row.id] = signed?.signedUrl ?? fallbackAvatarUrl(row.id, displayName, isRestaurant);
    }
    return { urls: result, names };
  });