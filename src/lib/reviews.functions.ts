import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScoreSchema = z.number().int().min(1).max(5);

const SubmitInput = z.object({
  shiftId: z.string().uuid(),
  punctuality: ScoreSchema,
  professionalism: ScoreSchema,
  competence: ScoreSchema,
  reliability: ScoreSchema,
  teamwork: ScoreSchema,
  comment: z.string().trim().max(1000).optional().default(""),
});

// Crea la recensione di un lavoratore al termine di un turno completato.
// Richiede autenticazione: l'utente deve essere il ristoratore proprietario
// dello shift, e lo shift deve risultare in stato `completed`.
// Una sola recensione per (autore, target, shift): l'unique index in DB
// blocca i duplicati anche in caso di race.
export const submitWorkerReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, restaurant_id, worker_id, announcement_id, status")
      .eq("id", data.shiftId)
      .maybeSingle();
    if (shiftErr) throw new Error(shiftErr.message);
    if (!shift) throw new Error("Turno non trovato.");
    if (shift.restaurant_id !== userId) throw new Error("Non autorizzato a recensire questo turno.");
    if (shift.status !== "completed") {
      throw new Error("Puoi recensire solo turni completati.");
    }

    // Trova application correlata (best-effort) per agganciare la chat.
    const { data: app } = await supabase
      .from("applications")
      .select("id")
      .eq("announcement_id", shift.announcement_id ?? "")
      .eq("worker_id", shift.worker_id)
      .eq("restaurant_id", shift.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Anti-duplicato esplicito (oltre all'unique index in DB).
    const { data: dup } = await supabase
      .from("reviews")
      .select("id")
      .eq("author_id", userId)
      .eq("target_id", shift.worker_id)
      .eq("shift_id", shift.id)
      .maybeSingle();
    if (dup) {
      throw new Error("Recensione già inviata per questo turno.");
    }

    const trimmed = data.comment.trim();
    const { data: inserted, error: insErr } = await supabase
      .from("reviews")
      .insert({
        author_id: userId,
        target_id: shift.worker_id,
        shift_id: shift.id,
        announcement_id: shift.announcement_id,
        application_id: app?.id ?? null,
        comment: trimmed.length > 0 ? trimmed : null,
        punctuality: data.punctuality,
        professionalism: data.professionalism,
        competence: data.competence,
        reliability: data.reliability,
        teamwork: data.teamwork,
      } as never)
      .select("id, rating")
      .single();
    if (insErr) {
      const m = insErr.message ?? "";
      if (m.includes("duplicate") || m.includes("unique")) {
        throw new Error("Recensione già inviata per questo turno.");
      }
      throw new Error(m || "Errore durante l'invio della recensione.");
    }

    return { id: inserted!.id, rating: inserted!.rating };
  });

// Lettura della recensione per uno shift: usata sia dal ristoratore (per
// vedere se ha già recensito) sia dal lavoratore (per verificare l'ultima
// recensione ricevuta).
export const getReviewForShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shiftId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: shift } = await supabase
      .from("shifts")
      .select("restaurant_id, worker_id")
      .eq("id", data.shiftId)
      .maybeSingle();
    if (!shift) return { review: null };
    if (shift.restaurant_id !== userId && shift.worker_id !== userId) {
      return { review: null };
    }
    const { data: review } = await supabase
      .from("reviews")
      .select(
        "id, rating, comment, punctuality, professionalism, competence, reliability, teamwork, created_at, author_id, target_id",
      )
      .eq("shift_id", data.shiftId)
      .maybeSingle();
    return { review: review ?? null };
  });

// Segna la recensione come vista dal lavoratore. Restituisce wasFirstOpen
// = true solo se prima di questa chiamata seen_by_worker_at era null,
// in modo che l'effetto celebrativo si attivi una sola volta anche tra
// dispositivi diversi.
export const markReviewSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reviewId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("reviews")
      .select("id, target_id, seen_by_worker_at")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (!existing || existing.target_id !== userId) {
      return { wasFirstOpen: false };
    }
    if (existing.seen_by_worker_at) {
      return { wasFirstOpen: false };
    }
    await supabase
      .from("reviews")
      .update({ seen_by_worker_at: new Date().toISOString() } as never)
      .eq("id", data.reviewId)
      .is("seen_by_worker_at", null);
    return { wasFirstOpen: true };
  });

// Per la pagina "Cerca lavoratori": per ciascun worker, l'ultima recensione
// lasciata dal ristoratore loggato (se esiste).
export const getReviewsByRestaurantForWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ workerIds: z.array(z.string().uuid()).min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("reviews")
      .select("id, target_id, rating, comment, created_at")
      .eq("author_id", userId)
      .in("target_id", data.workerIds)
      .order("created_at", { ascending: false });
    const byWorker: Record<
      string,
      { id: string; rating: number; comment: string | null; created_at: string }
    > = {};
    for (const r of (rows ?? []) as any[]) {
      if (!byWorker[r.target_id]) {
        byWorker[r.target_id] = {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
        };
      }
    }
    return { byWorker };
  });