import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_shifts",
  title: "I miei turni",
  description:
    "Elenca i turni Pupillo dell'utente autenticato (visibili come lavoratore o come ristoratore, secondo le policy RLS).",
  inputSchema: {
    status: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Filtra per stato (es. 'confirmed', 'completed', 'cancelled')."),
    limit: z.number().int().min(1).max(100).optional().describe("Max risultati (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non autenticato." }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("shifts")
      .select("id, shift_date, hours, amount, status, announcement_id, restaurant_id, worker_id, created_at")
      .order("shift_date", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { shifts: data ?? [] },
    };
  },
});