import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickRecognitions, type AcademyRecognition } from "./academy-recognitions";

const ENDPOINT = "https://accademy.pupillo.life/api/public/recognitions";

export const getAcademyRecognitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<AcademyRecognition[]> => {
    const token = process.env["PUPILLO_RECOGNITIONS_TOKEN"];
    if (!token) return [];
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjects: [data.workerId] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      return pickRecognitions(await res.json(), data.workerId);
    } catch {
      return [];
    }
  });
