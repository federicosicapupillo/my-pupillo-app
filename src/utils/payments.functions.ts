import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolve (or create) a Stripe Customer carrying metadata.userId.
 * - search by metadata first, fall back to email, then create.
 * - backfill userId on legacy customers found by email.
 * - persist customer.id on profiles.stripe_customer_id so the Customer
 *   Portal works even for credit-pack-only buyers.
 */
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  let customerId: string | null = null;

  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) customerId = found.data[0].id;
  }

  if (!customerId && options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (options.userId && c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      customerId = c.id;
    }
  }

  if (!customerId) {
    const created = await stripe.customers.create({
      ...(options.email && { email: options.email }),
      ...(options.userId && { metadata: { userId: options.userId } }),
    });
    customerId = created.id;
  }

  if (options.userId && customerId) {
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", options.userId);
  }

  return customerId;
}

/**
 * Create-or-reuse a Stripe coupon for a given discount_codes row.
 * Uses a deterministic id so repeated checkouts share one coupon.
 */
async function resolveCouponForDiscountRow(
  stripe: ReturnType<typeof createStripeClient>,
  row: { id: string; code: string; discount_type: string; discount_value: number },
  currency: string,
): Promise<string | null> {
  const couponId = `pupillo_${row.id.replace(/-/g, "")}`.slice(0, 64);
  try {
    const existing = await stripe.coupons.retrieve(couponId);
    if (existing && !(existing as any).deleted) return existing.id;
  } catch {
    // not found, create below
  }
  try {
    if (row.discount_type === "percentage") {
      const c = await stripe.coupons.create({
        id: couponId,
        percent_off: Number(row.discount_value),
        duration: "once",
        name: `Sconto ${row.code}`,
      });
      return c.id;
    }
    if (row.discount_type === "fixed_amount") {
      const c = await stripe.coupons.create({
        id: couponId,
        amount_off: Math.round(Number(row.discount_value) * 100),
        currency,
        duration: "once",
        name: `Sconto ${row.code}`,
      });
      return c.id;
    }
  } catch (e) {
    console.error("[checkout] coupon creation failed", e);
  }
  return null;
}

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

    // Resolve discount code: reuse a deterministic Stripe coupon per DB row.
    let discounts: { coupon: string }[] | undefined;
    let appliedDiscountCodeId: string | undefined;
    if (data.discountCode) {
      try {
        const { data: row } = await supabaseAdmin
          .from("discount_codes")
          .select("id, code, discount_type, discount_value, applies_to, is_active, valid_from, valid_until, max_uses, used_count")
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
          const couponId = await resolveCouponForDiscountRow(
            stripe,
            { id: row.id, code: row.code, discount_type: row.discount_type, discount_value: Number(row.discount_value) },
            stripePrice.currency,
          );
          if (couponId) {
            discounts = [{ coupon: couponId }];
            appliedDiscountCodeId = row.id;
          }
        }
      } catch (e) {
        console.error("[checkout] discount resolution failed", e);
      }
    }

    // Resolve a Stripe Customer carrying metadata.userId (searchable).
    const customerId = (data.customerEmail || data.userId)
      ? await resolveOrCreateCustomer(stripe, { email: data.customerEmail, userId: data.userId })
      : undefined;

    // For one-off charges, attach product name as PaymentIntent description
    // so the Lovable payments dashboard shows the right label.
    let productDescription: string | undefined;
    if (!isRecurring) {
      const productId = typeof stripePrice.product === "string"
        ? stripePrice.product
        : (stripePrice.product as any).id;
      try {
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      } catch { /* leave undefined */ }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      // End-to-end compliance handling: Stripe handles VAT calc/collection/filing,
      // fraud, disputes and customer support on supported countries.
      // Cast: the param exists on API version 2026-03-25.dahlia but is not yet
      // in the SDK type definitions.
      ...({ managed_payments: { enabled: true } } as any),
      ...(discounts && { discounts }),
      ...(customerId && { customer: customerId }),
      ...(!isRecurring && productDescription && {
        payment_intent_data: { description: productDescription },
      }),
      ...(data.userId && {
        metadata: {
          userId: data.userId,
          priceId: data.priceId,
          ...(data.discountCode && { discountCode: data.discountCode }),
          ...(appliedDiscountCodeId && { discountCodeId: appliedDiscountCodeId }),
        },
        ...(isRecurring && { subscription_data: { metadata: {
          userId: data.userId,
          priceId: data.priceId,
          ...(data.discountCode && { discountCode: data.discountCode }),
          ...(appliedDiscountCodeId && { discountCodeId: appliedDiscountCodeId }),
        } } }),
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
    // Prefer customer id stored on the profile (covers credit-pack buyers).
    // Fall back to the most recent subscription row.
    const { data: prof } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();
    let customerId: string | null = (prof as any)?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      customerId = sub?.stripe_customer_id ?? null;
    }
    if (!customerId) throw new Error("Nessun cliente Stripe collegato. Effettua almeno un acquisto prima di gestire la fatturazione.");
    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });