import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
import { CREDIT_PACKS } from "@/lib/pricing";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

async function resolvePriceLookupKey(priceId: string, env: StripeEnv): Promise<string | null> {
  try {
    const stripe = createStripeClient(env);
    const price = await stripe.prices.retrieve(priceId);
    return (price.lookup_key as string) || (price.metadata?.lovable_external_id as string) || null;
  } catch {
    return null;
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Persist Stripe customer id on the profile so the Customer Portal works
  // for credit-pack-only buyers too.
  if (session.customer && session.metadata?.userId) {
    await getSupabase()
      .from("profiles")
      .update({ stripe_customer_id: session.customer, updated_at: new Date().toISOString() })
      .eq("id", session.metadata.userId);
  }

  if (session.mode !== "payment") return; // subscriptions handled by customer.subscription.*
  const userId = session.metadata?.userId;
  if (!userId) return;
  // Look up price/lookup_key from line items
  const stripe = createStripeClient(env);
  const items = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price"] });
  const line = items.data[0];
  const priceObj: any = line?.price;
  const lookupKey = priceObj?.metadata?.lovable_external_id || priceObj?.lookup_key || (priceObj?.id ? await resolvePriceLookupKey(priceObj.id, env) : null);
  if (!lookupKey) return;
  const pack = CREDIT_PACKS[lookupKey];
  if (!pack) return;
  const totalCredits = pack.credits * (line?.quantity ?? 1);
  // Idempotency: dedupe by session.id
  const { data: existing } = await getSupabase()
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reference_id", session.id)
    .maybeSingle();
  if (existing) return;
  await getSupabase().rpc("grant_credits", {
    _user_id: userId,
    _amount: totalCredits,
    _kind: "purchase",
    _reason: pack.label,
    _reference_id: session.id,
  });

  // Record discount redemption (one-off)
  await recordDiscountRedemption({
    discountCodeId: session.metadata?.discountCodeId,
    userId,
    orderId: session.id,
    discountAmount: session.total_details?.amount_discount
      ? Number(session.total_details.amount_discount) / 100
      : undefined,
  });
}

/** Insert into discount_redemptions and bump discount_codes.used_count (idempotent on order_id). */
async function recordDiscountRedemption(args: {
  discountCodeId?: string;
  userId: string;
  orderId: string;
  discountAmount?: number;
}) {
  if (!args.discountCodeId) return;
  const supabase = getSupabase();
  const { data: dup } = await supabase
    .from("discount_redemptions")
    .select("id")
    .eq("order_id", args.orderId)
    .maybeSingle();
  if (dup) return;
  const { error: insErr } = await supabase.from("discount_redemptions").insert({
    discount_code_id: args.discountCodeId,
    user_id: args.userId,
    order_id: args.orderId,
    ...(args.discountAmount !== undefined && { discount_amount: args.discountAmount }),
  });
  if (insErr) {
    console.error("[webhook] discount_redemptions insert failed", insErr);
    return;
  }
  // Bump used_count atomically
  const { data: row } = await supabase
    .from("discount_codes")
    .select("used_count")
    .eq("id", args.discountCodeId)
    .maybeSingle();
  if (row) {
    await supabase
      .from("discount_codes")
      .update({ used_count: (row.used_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", args.discountCodeId);
  }
}

async function handleChargeRefunded(charge: any, env: StripeEnv) {
  // Find the original credit-pack credit_transaction by session reference, then revoke.
  const sessionId = charge.payment_intent && (await findSessionIdForPaymentIntent(charge.payment_intent, env));
  if (!sessionId) return;
  const { data: tx } = await getSupabase()
    .from("credit_transactions")
    .select("id, user_id, delta, reference_id")
    .eq("reference_id", sessionId)
    .eq("kind", "purchase")
    .maybeSingle();
  if (!tx) return;
  // Idempotency: only revoke once
  const { data: already } = await getSupabase()
    .from("credit_transactions")
    .select("id")
    .eq("reference_id", `refund:${sessionId}`)
    .maybeSingle();
  if (already) return;
  await getSupabase().rpc("grant_credits", {
    _user_id: tx.user_id,
    _amount: -Number(tx.delta),
    _kind: "refund",
    _reason: "Refund",
    _reference_id: `refund:${sessionId}`,
  });
  await getSupabase().from("notifications").insert({
    user_id: tx.user_id,
    title: "Rimborso ricevuto",
    body: `Il rimborso è stato registrato. Saldo crediti aggiornato.`,
    link: "/billing",
  });
}

async function findSessionIdForPaymentIntent(paymentIntentId: string, env: StripeEnv): Promise<string | null> {
  try {
    const stripe = createStripeClient(env);
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    return sessions.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});