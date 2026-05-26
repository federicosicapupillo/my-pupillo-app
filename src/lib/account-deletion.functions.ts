import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { softDeleteAccount } from "@/lib/account-deletion.server";

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
    const { userId } = context;

    if (data.reason === "altro" && !data.customReason?.trim()) {
      return { ok: false, error_code: "missing_custom_reason" };
    }

    return softDeleteAccount(userId, data.reason, data.customReason);
  });