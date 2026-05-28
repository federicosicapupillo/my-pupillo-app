import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CREDITS_PER_HIRE } from "@/lib/pricing";

/**
 * Called by the worker right after `cancelPresence` succeeds.
 * Idempotently refunds the assignment credits to the restaurant
 * (one refund per application_id). Uses the admin client because
 * the worker cannot mutate the restaurant's wallet under RLS.
 */
export const refundWorkerCancellationCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: app, error: appErr } = await supabaseAdmin
      .from("applications")
      .select("id, worker_id, restaurant_id, status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appErr || !app) return { refunded: false, reason: "application_not_found" };
    if (app.worker_id !== userId) return { refunded: false, reason: "not_authorized" };
    if (app.status !== "cancelled") return { refunded: false, reason: "not_cancelled" };

    // Idempotency: one refund per application.
    const refRef = `worker_cancel:${app.id}`;
    const { data: existing } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", app.restaurant_id)
      .eq("kind", "refund")
      .eq("reference_id", refRef)
      .maybeSingle();
    if (existing) return { refunded: false, reason: "already_refunded" };

    // Was the restaurant actually charged for this assignment? Look for a
    // matching consume row keyed by the application id.
    const { data: chargeRow } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, delta")
      .eq("user_id", app.restaurant_id)
      .eq("kind", "consume")
      .eq("reason", "assign_worker")
      .eq("reference_id", app.id)
      .maybeSingle();
    if (!chargeRow) return { refunded: false, reason: "no_charge_found" };

    const amount = Math.abs(Number(chargeRow.delta ?? CREDITS_PER_HIRE)) || CREDITS_PER_HIRE;

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", app.restaurant_id)
      .maybeSingle();
    if (profErr || !profile) return { refunded: false, reason: "restaurant_profile_missing" };

    const newBalance = (profile.credits ?? 0) + amount;

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ credits: newBalance })
      .eq("id", app.restaurant_id);
    if (updErr) return { refunded: false, reason: updErr.message };

    const { error: txErr } = await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: app.restaurant_id,
        delta: amount,
        balance_after: newBalance,
        kind: "refund",
        reason: "worker_cancellation_credit_refund",
        reference_id: refRef,
        metadata: { application_id: app.id, worker_id: app.worker_id },
      } as never);
    if (txErr) {
      // Best-effort rollback of the balance.
      await supabaseAdmin
        .from("profiles")
        .update({ credits: profile.credits ?? 0 })
        .eq("id", app.restaurant_id);
      return { refunded: false, reason: txErr.message };
    }

    return { refunded: true, amount };
  });