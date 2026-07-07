import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_announcements",
  title: "Cerca annunci pubblici",
  description:
    "Cerca annunci di lavoro pubblici Pupillo (turni aperti) filtrando per città, profilo professionale o data. Non richiede autenticazione.",
  inputSchema: {
    city: z.string().trim().min(1).optional().describe("Città (es. 'Milano')."),
    profile: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Profilo professionale (es. 'cameriere', 'cuoco')."),
    from_date: z.string().optional().describe("Data minima ISO YYYY-MM-DD."),
    limit: z.number().int().min(1).max(50).optional().describe("Max risultati (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, profile, from_date, limit }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend non configurato." }], isError: true };
    }
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = client
      .from("announcements_public")
      .select(
        "id, service_date, service_time, end_time, professional_profile, job_city, job_province, tariff_amount, tariff_type, duration_hours",
      )
      .eq("status", "active")
      .order("service_date", { ascending: true })
      .limit(limit ?? 20);
    if (city) q = q.ilike("job_city", `%${city}%`);
    if (profile) q = q.ilike("professional_profile", `%${profile}%`);
    if (from_date) q = q.gte("service_date", from_date);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { announcements: data ?? [] },
    };
  },
});