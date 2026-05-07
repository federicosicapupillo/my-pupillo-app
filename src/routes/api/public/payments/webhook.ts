import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
import { CREDIT_PACKS, PLAN_PRICES } from "@/lib/pricing";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  // Update profile.plan
  const planMap = PLAN_PRICES[priceId as string];
  const isActive = ["active", "trialing"].includes(subscription.status);
  if (planMap) {
    await getSupabase()
      .from("profiles")
      .update({ plan: isActive ? planMap.plan : "free", updated_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  const userId = subscription.metadata?.userId;
  if (userId) {
    await getSupabase().from("profiles").update({ plan: "free", updated_at: new Date().toISOString() }).eq("id", userId);
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
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
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
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