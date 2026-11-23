import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { imageSize } from "image-size";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVATAR_REJECT_MESSAGES, decideAvatarModeration, sniffImageMime } from "@/lib/avatar-moderation/decision";

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIM = 500;
const MAX_ATTEMPTS_PER_HOUR = 20;

export type FacePhotoResult =
  | { ok: true; path: string; signedUrl: string | null }
  | { ok: false; kind: "invalid" | "rejected" | "service"; error: string };

/**
 * Controlla la foto viso del lavoratore lato server PRIMA di salvarla.
 * Solo le foto approvate vengono scritte (percorso privato `<uid>/moderated/…`)
 * e registrate come approvate per quel lavoratore e quel file.
 */
export const moderateWorkerFacePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const file = data instanceof FormData ? data.get("file") : null;
    const original = data instanceof FormData ? data.get("original") : null;
    return { file: file instanceof File ? file : null, original: original instanceof File ? original : null };
  })
  .handler(async ({ data, context }): Promise<FacePhotoResult> => {
    const { file, original } = data;
    if (!file || file.size === 0 || !original || original.size === 0) return { ok: false, kind: "invalid", error: "Nessuna foto ricevuta. Scatta di nuovo la foto." };
    if (file.size > MAX_BYTES || original.size > MAX_BYTES) return { ok: false, kind: "invalid", error: "La foto supera il limite massimo di 5 MB." };

    const { data: isWorker } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "worker" });
    if (!isWorker) return { ok: false, kind: "invalid", error: "Solo i lavoratori possono usare questo controllo." };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    if (!mime) return { ok: false, kind: "invalid", error: "Formato non supportato. Usa una foto JPG, PNG o WEBP." };
    let dims: { width?: number; height?: number };
    try { dims = imageSize(bytes); } catch { return { ok: false, kind: "invalid", error: "Immagine non valida o corrotta." }; }
    if (!dims.width || !dims.height || dims.width < MIN_DIM || dims.height < MIN_DIM) {
      return { ok: false, kind: "invalid", error: "La foto deve essere almeno 500x500 px." };
    }

    const origBytes = new Uint8Array(await original.arrayBuffer());
    const origMime = sniffImageMime(origBytes);
    if (!origMime) return { ok: false, kind: "invalid", error: "Scatto originale non valido. Riprova." };
    // L'associazione registrata è proprietario + scatto originale; il file salvato è la foto finale.
    const digest = await crypto.subtle.digest("SHA-256", origBytes);
    const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin.from("worker_avatar_moderations")
      .select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
      return { ok: false, kind: "service", error: "Hai fatto troppi tentativi. Riprova tra un'ora." };
    }

    const key = process.env["LOVABLE_API_KEY"];
    const { analyzeAvatarImage, AVATAR_MODERATION_MODEL } = await import("@/lib/avatar-moderation/analyze.server");
    const record = (status: "approved" | "rejected" | "error", reason_code: string | null, path: string | null = null) =>
      supabaseAdmin.from("worker_avatar_moderations").insert({ user_id: context.userId, sha256, status, reason_code, path, model: AVATAR_MODERATION_MODEL });

    if (!key) {
      await record("error", "not_configured");
      return { ok: false, kind: "service", error: "Controllo foto non disponibile. Riprova più tardi." };
    }
    let output;
    try {
      // 1) scatto originale: un solo volto, contenuti e gesti; 2) foto finale: stesso controllo, così ciò che diventa attivo è verificato.
      const req = getRequest();
      output = await analyzeAvatarImage(req, key, origBytes, origMime);
      const first = decideAvatarModeration(output);
      if (first.approved) output = await analyzeAvatarImage(req, key, bytes, mime);
    } catch (e) {
      console.error("[PUPILLO_AVATAR_MODERATION]", e);
      await record("error", "service_failure");
      return { ok: false, kind: "service", error: "Non siamo riusciti a controllare la foto. Riprova tra poco: la foto non è stata salvata." };
    }
    const decision = decideAvatarModeration(output);
    if (!decision.approved) {
      await record("rejected", decision.code);
      return { ok: false, kind: "rejected", error: AVATAR_REJECT_MESSAGES[decision.code] };
    }

    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const path = `${context.userId}/moderated/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("avatars").upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) {
      await record("error", "storage_failure");
      return { ok: false, kind: "service", error: "Salvataggio della foto non riuscito. Riprova." };
    }
    const { error: insErr } = await record("approved", null, path);
    if (insErr) {
      await supabaseAdmin.storage.from("avatars").remove([path]);
      return { ok: false, kind: "service", error: "Salvataggio della foto non riuscito. Riprova." };
    }
    const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path, 3600);
    return { ok: true, path, signedUrl: signed?.signedUrl ?? null };
  });
