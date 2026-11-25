import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AcademyProgress {
  started: boolean;
  completed_lessons: number;
  total_lessons: number;
  percentuale: number;
  last_activity_at: string | null;
  completed_modules: string[];
}

const ENDPOINT = "https://accademy.pupillo.life/api/public/progress";

/** Avanzamento Academy del lavoratore collegato (solo il proprio). */
export const getMyAcademyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcademyProgress | null> => {
    const token = process.env["PUPILLO_RECOGNITIONS_TOKEN"];
    if (!token) return null;
    try {
      const res = await fetch(`${ENDPOINT}?pupillo_user_id=${encodeURIComponent(context.userId)}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as Partial<AcademyProgress>;
      const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
      return {
        started: j.started === true,
        completed_lessons: n(j.completed_lessons),
        total_lessons: n(j.total_lessons),
        percentuale: Math.min(100, n(j.percentuale)),
        last_activity_at: typeof j.last_activity_at === "string" ? j.last_activity_at : null,
        completed_modules: Array.isArray(j.completed_modules) ? j.completed_modules.filter((m): m is string => typeof m === "string") : [],
      };
    } catch {
      return null;
    }
  });
