import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteAccountInput = z.object({
  reason: z.enum([
    "non_uso_piu",
    "lavoro_altro_modo",
    "problemi_piattaforma",
    "problemi_notifiche_chat",
    "problemi_pagamenti_crediti",
    "cancellare_dati",
    "altro",
  ]),
  customReason: z.string().trim().max(500).optional(),
});

type DeleteAccountResult = {
  ok: boolean;
  error_code?: string;
  message?: string;
};

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteAccountInput.parse(input))
  .handler(async ({ data, context }): Promise<DeleteAccountResult> => {
    const { supabase, userId } = context;

    if (data.reason === "altro" && !data.customReason?.trim()) {
      return { ok: false, error_code: "missing_custom_reason" };
    }

    const { data: deletionResult, error } = await supabase.rpc("delete_my_account", {
      _reason: data.reason,
      _custom_reason: data.reason === "altro" ? data.customReason?.trim() : undefined,
    });

    if (error) {
      console.error("[deleteAccount] profile anonymization failed", error);
      return { ok: false, error_code: "delete_failed" };
    }

    const result = (deletionResult as DeleteAccountResult | null) ?? null;
    if (!result?.ok) return result ?? { ok: false, error_code: "delete_failed" };

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[deleteAccount] auth user deletion failed", authError);
    }

    return { ok: true };
  });