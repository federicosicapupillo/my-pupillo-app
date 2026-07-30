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
  confirmActiveShifts: z.boolean().optional(),
});

type DeleteAccountResult = {
  ok: boolean;
  error_code?: string;
  message?: string;
  impact?: Record<string, number>;
  cleanup_status?: "complete" | "partial" | "not_applicable";
};

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteAccountInput.parse(input))
  .handler(async ({ data, context }): Promise<DeleteAccountResult> => {
    const { userId } = context;

    if (data.reason === "altro" && !data.customReason?.trim()) {
      return { ok: false, error_code: "missing_custom_reason" };
    }

    return softDeleteAccount(userId, data.reason, data.customReason, {
      confirmActiveShifts: data.confirmActiveShifts === true,
    });
  });

/**
 * Admin-only retry of the restaurant cleanup after a partial failure.
 * Idempotent: notifications are deduped and updates filter on non-final states.
 */
export const retryRestaurantCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    } as never);
    if (error || isAdmin !== true) return { ok: false, error_code: "forbidden" as const, cleanup_status: "partial" as const };
    const { runRestaurantCleanup } = await import("@/lib/account-deletion.server");
    const outcome = await runRestaurantCleanup(data.targetUserId);
    return { ok: outcome.status === "complete", cleanup_status: outcome.status, error: outcome.error };
  });