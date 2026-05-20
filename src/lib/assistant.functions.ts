import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { KB_SYSTEM_PROMPT, ctaForRoute, TICKET_CATEGORIES } from "@/lib/assistant-kb";

const askInput = z.object({
  message: z.string().trim().min(1).max(2000),
  role: z.enum(["worker", "restaurant", "admin"]).nullable().optional(),
  pathname: z.string().max(500).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export type AssistantReply = {
  reply: string;
  cta?: { label: string; to: string } | null;
  fallback?: boolean;
};

const SAFE_ROUTES = [
  "/dashboard",
  "/profile",
  "/availability",
  "/browse",
  "/jobs",
  "/announcements",
  "/announcements/new",
  "/workers",
  "/ristoratore/collaboratori",
  "/mappa",
  "/messages",
  "/shifts",
  "/billing",
  "/verify-phone",
];

function extractCta(text: string): { label: string; to: string } | undefined {
  for (const route of SAFE_ROUTES) {
    if (text.includes(route)) {
      const cta = ctaForRoute(route);
      if (cta) return cta;
    }
  }
  const lower = text.toLowerCase();
  const hints: Array<[string, string]> = [
    ["disponibilit", "/availability"],
    ["trova offert", "/browse"],
    ["offerte ricevut", "/jobs"],
    ["miei annunc", "/announcements"],
    ["crea annunc", "/announcements/new"],
    ["cerca lavorator", "/workers"],
    ["collaborator", "/ristoratore/collaboratori"],
    ["mappa", "/mappa"],
    ["messagg", "/messages"],
    ["miei turn", "/shifts"],
    ["credit", "/billing"],
    ["profilo", "/profile"],
    ["verifica telefon", "/verify-phone"],
    ["dashboard", "/dashboard"],
  ];
  for (const [needle, route] of hints) {
    if (lower.includes(needle)) {
      const cta = ctaForRoute(route);
      if (cta) return cta;
    }
  }
  return undefined;
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => askInput.parse(input))
  .handler(async ({ data }): Promise<AssistantReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        reply:
          "L'assistente IA non è configurato. Puoi consultare le domande rapide qui sotto o inviare una segnalazione al supporto.",
        fallback: true,
      };
    }

    const systemContext = `${KB_SYSTEM_PROMPT}\n\nContesto utente:\n- Ruolo: ${data.role ?? "sconosciuto"}\n- Pagina corrente: ${data.pathname ?? "/"}`;

    const messages = [
      { role: "system", content: systemContext },
      ...(data.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ];

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.4,
          max_tokens: 350,
        }),
      });

      if (res.status === 429) {
        return {
          reply: "Troppe richieste in pochi secondi. Riprova tra poco.",
          fallback: true,
        };
      }
      if (res.status === 402) {
        return {
          reply:
            "L'assistente IA ha esaurito i crediti. Nel frattempo puoi usare le domande rapide o segnalare il problema.",
          fallback: true,
        };
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[assistant] gateway error", res.status, detail.slice(0, 300));
        return {
          reply:
            "Non riesco a contattare l'assistente in questo momento. Puoi usare le domande rapide o segnalare il problema.",
          fallback: true,
        };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return {
          reply:
            "Non riesco a verificarlo automaticamente. Puoi inviare una segnalazione al supporto.",
          fallback: true,
        };
      }

      return { reply, cta: extractCta(reply) ?? null };
    } catch (err) {
      console.error("[assistant] fetch failed", err);
      return {
        reply:
          "Non riesco a contattare l'assistente in questo momento. Puoi usare le domande rapide o segnalare il problema.",
        fallback: true,
      };
    }
  });

const ticketInput = z.object({
  category: z.string().trim().min(1).max(100),
  message: z.string().trim().min(5).max(4000),
  pageUrl: z.string().trim().max(500).optional(),
});

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ticketInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const category = (TICKET_CATEGORIES as readonly string[]).includes(data.category)
      ? data.category
      : "Altro";

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        user_role: roleRow?.role ?? null,
        category,
        message: data.message,
        page_url: data.pageUrl ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[support_tickets] insert error", error);
      throw new Error("Impossibile inviare la segnalazione. Riprova più tardi.");
    }

    return { id: inserted.id };
  });

const updateTicketInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["aperto", "in_lavorazione", "risolto", "chiuso"]),
});

export const updateSupportTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateTicketInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) {
      console.error("[support_tickets] update error", error);
      throw new Error("Impossibile aggiornare la segnalazione.");
    }
    return { ok: true };
  });