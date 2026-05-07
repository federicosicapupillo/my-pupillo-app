import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  vat_number: z.string().trim().min(4).max(20),
});

function normalizeIT(raw: string): { country: string; number: string } {
  const cleaned = raw.replace(/[\s\-\.]/g, "").toUpperCase();
  const m = cleaned.match(/^([A-Z]{2})?(\d{6,15})$/);
  if (!m) return { country: "IT", number: cleaned.replace(/^IT/, "") };
  return { country: m[1] ?? "IT", number: m[2] };
}

/**
 * Verifies a VAT number via the EU VIES REST API and updates the caller's
 * profile with the result.
 */
export const verifyVat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { country, number } = normalizeIT(data.vat_number);

    // Mark as pending immediately
    await supabaseAdmin
      .from("profiles")
      .update({ vat_number: `${country}${number}`, vat_status: "pending" })
      .eq("id", userId);

    let status: "valid" | "invalid" | "error" = "error";
    let companyName: string | null = null;
    let errorMessage: string | null = null;

    try {
      const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        errorMessage = `VIES HTTP ${res.status}`;
      } else {
        const json = (await res.json()) as { isValid?: boolean; name?: string; userError?: string };
        if (json.userError && json.userError !== "VALID") {
          // e.g. INVALID_INPUT, MS_UNAVAILABLE, SERVICE_UNAVAILABLE
          status = json.userError === "INVALID" ? "invalid" : "error";
          errorMessage = json.userError;
        } else if (json.isValid) {
          status = "valid";
          companyName = (json.name ?? "").trim() || null;
        } else {
          status = "invalid";
        }
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({
        vat_status: status,
        vat_company_name: companyName,
        vat_verified_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (updErr) throw new Error(updErr.message);

    return { status, companyName, error: errorMessage };
  });