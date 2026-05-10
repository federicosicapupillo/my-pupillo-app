import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    userId?: string;
    discountCode?: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    if (data.discountCode && !/^[A-Za-z0-9_-]{2,32}$/.test(data.discountCode)) throw new Error("Invalid discountCode");
    return data;
  })
  .handler(async ({ data }) => {
    const stripe = createStripeClient(data.environment);
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId], expand: ["data.product"] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    // Resolve discount code (Stripe coupon) when provided.
    let discounts: { coupon: string }[] | undefined;
    if (data.discountCode) {
      try {
        const { data: row } = await supabaseAdmin
          .from("discount_codes")
          .select("code, discount_type, discount_value, applies_to, is_active, valid_from, valid_until, max_uses, used_count")
          .ilike("code", data.discountCode)
          .maybeSingle();
        const now = new Date();
        const valid =
          row && row.is_active &&
          (!row.valid_from || new Date(row.valid_from) <= now) &&
          (!row.valid_until || new Date(row.valid_until) >= now) &&
          (row.max_uses == null || row.used_count < row.max_uses) &&
          (row.applies_to === "all" || (isRecurring && row.applies_to === "premium") || (!isRecurring && row.applies_to === "credits"));
        if (valid && row) {
          const coupon = row.discount_type === "percentage"
            ? await stripe.coupons.create({ percent_off: Number(row.discount_value), duration: "once", name: `Sconto ${row.code}` })
            : row.discount_type === "fixed_amount"
              ? await stripe.coupons.create({ amount_off: Math.round(Number(row.discount_value) * 100), currency: stripePrice.currency, duration: "once", name: `Sconto ${row.code}` })
              : null;
          if (coupon) discounts = [{ coupon: coupon.id }];
        }
      } catch (e) {
        console.error("[checkout] discount resolution failed", e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(discounts && { discounts }),
      ...(data.customerEmail && { customer_email: data.customerEmail }),
      ...(data.userId && {
        metadata: { userId: data.userId, priceId: data.priceId, ...(data.discountCode && { discountCode: data.discountCode }) },
        ...(isRecurring && { subscription_data: { metadata: { userId: data.userId, priceId: data.priceId, ...(data.discountCode && { discountCode: data.discountCode }) } } }),
      }),
    });

    return session.client_secret;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("No subscription found");
    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });