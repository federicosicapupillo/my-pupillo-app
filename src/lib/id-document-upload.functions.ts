import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side validation + upload for the worker ID document.
 *
 * Mirrors the client guard (`src/lib/id-document-file.ts`) but is the
 * authoritative check: extension is ignored, only the file's magic bytes
 * decide. Allowed: PDF, JPG/JPEG, PNG. Anything else (DOC/DOCX, HEIC,
 * WEBP, ZIP, RAR, TXT, …) is rejected with the exact user-facing message.
 */
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const ID_DOC_INVALID_FORMAT_MESSAGE =
  "Formato documento non valido. Carica un file PDF, JPG, JPEG o PNG.";
export const ID_DOC_TOO_LARGE_MESSAGE =
  "File troppo grande. Dimensione massima: 10 MB.";
export const ID_DOC_MISSING_MESSAGE = "Nessun file ricevuto.";

/** Detect MIME from magic bytes — never trust the client-provided type. */
function sniffMime(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

type UploadResult =
  | { ok: true; path: string; name: string; mime: string; size: number }
  | { ok: false; error: string };

export const uploadWorkerIdDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) return { file: null as File | null };
    const file = data.get("file");
    return { file: file instanceof File ? file : null };
  })
  .handler(async ({ data, context }): Promise<UploadResult> => {
    const { file } = data;
    if (!file || file.size === 0) {
      return { ok: false, error: ID_DOC_MISSING_MESSAGE };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: ID_DOC_TOO_LARGE_MESSAGE };
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed) {
      return { ok: false, error: ID_DOC_INVALID_FORMAT_MESSAGE };
    }

    const ext = sniffed === "application/pdf" ? "pdf" : sniffed === "image/png" ? "png" : "jpg";
    const path = `${context.userId}/id-${Date.now()}.${ext}`;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upErr } = await admin.storage
      .from("worker-documents")
      .upload(path, buf, { contentType: sniffed, upsert: true });
    if (upErr) {
      return { ok: false, error: `Caricamento documento non riuscito. ${upErr.message}` };
    }

    return {
      ok: true,
      path,
      name: file.name || `documento.${ext}`,
      mime: sniffed,
      size: file.size,
    };
  });