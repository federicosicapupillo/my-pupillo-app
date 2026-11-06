import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CURRICULUM_BUCKET, CURRICULUM_MAX_BYTES, validateCurriculumBytes } from "@/lib/curriculum-file";

export const uploadCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input instanceof FormData ? input.get("file") : null;
    return { file: value instanceof File ? value : null };
  })
  .handler(async ({ data, context }) => {
    const { file } = data;
    if (!file || !file.size) return { ok: false as const, error: "Seleziona un curriculum." };
    if (file.size > CURRICULUM_MAX_BYTES) return { ok: false as const, error: "Il curriculum supera il limite di 5 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateCurriculumBytes(bytes);
    if (validation) return { ok: false as const, error: validation };
    const { data: worker, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "worker" });
    if (roleError || !worker) return { ok: false as const, error: "Il curriculum è disponibile solo per i lavoratori." };
    const { data: old, error: readError } = await context.supabase.from("worker_curricula").select("storage_path").eq("user_id", context.userId).maybeSingle();
    if (readError) return { ok: false as const, error: "Impossibile leggere il curriculum. Riprova." };
    const path = `${context.userId}/${crypto.randomUUID()}.pdf`;
    const storage = context.supabase.storage.from(CURRICULUM_BUCKET);
    const { error: uploadError } = await storage.upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) return { ok: false as const, error: "Caricamento del curriculum non riuscito. Riprova." };
    const name = file.name.slice(0, 200) || "Curriculum.pdf";
    const { error: saveError } = await context.supabase.from("worker_curricula").upsert({ user_id: context.userId, storage_path: path, file_name: name, file_size: file.size, updated_at: new Date().toISOString() });
    if (saveError) {
      await storage.remove([path]);
      return { ok: false as const, error: "Salvataggio del curriculum non riuscito. Il precedente documento è rimasto invariato." };
    }
    if (old?.storage_path) await storage.remove([old.storage_path]);
    return { ok: true as const, name };
  });