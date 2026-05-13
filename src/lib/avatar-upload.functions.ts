import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { imageSize } from "image-size";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 500;

export const AVATAR_ERRORS = {
  missing: "Nessun file ricevuto.",
  format: "Formato non supportato. Usa JPG, PNG o WEBP.",
  size: "File troppo grande. Massimo 5MB.",
  corrupt: "Immagine non valida o corrotta.",
  dim: `Immagine troppo piccola: minimo ${MIN_DIM}×${MIN_DIM} px.`,
  upload: "Caricamento foto profilo non riuscito.",
} as const;

/** Detect MIME from magic bytes — never trust client-provided type. */
function sniffMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  return null;
}

export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Response(AVATAR_ERRORS.missing, { status: 400 });
    }
    const file = data.get("file");
    if (!(file instanceof File)) {
      throw new Response(AVATAR_ERRORS.missing, { status: 400 });
    }
    return { file };
  })
  .handler(async ({ data, context }) => {
    const { file } = data;
    const { userId } = context;

    if (file.size === 0) throw new Response(AVATAR_ERRORS.missing, { status: 400 });
    if (file.size > MAX_BYTES) throw new Response(AVATAR_ERRORS.size, { status: 400 });

    const buf = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed || !ALLOWED.has(sniffed)) {
      throw new Response(AVATAR_ERRORS.format, { status: 400 });
    }

    let dims: { width?: number; height?: number; type?: string };
    try {
      dims = imageSize(buf);
    } catch {
      throw new Response(AVATAR_ERRORS.corrupt, { status: 400 });
    }
    if (!dims.width || !dims.height) {
      throw new Response(AVATAR_ERRORS.corrupt, { status: 400 });
    }
    if (dims.width < MIN_DIM || dims.height < MIN_DIM) {
      throw new Response(AVATAR_ERRORS.dim, { status: 400 });
    }

    const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upErr } = await admin.storage
      .from("avatars")
      .upload(path, buf, { contentType: sniffed, upsert: true });
    if (upErr) {
      throw new Response(`${AVATAR_ERRORS.upload} ${upErr.message}`, { status: 500 });
    }

    return { path, mime: sniffed, width: dims.width, height: dims.height };
  });