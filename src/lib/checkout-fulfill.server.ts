import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { CREDIT_PACKS, LEGACY_CREDIT_PACKS } from "@/lib/pricing";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Accredita i crediti di una sessione pagata, una sola volta per session.id. */
export async function fulfillCheckoutSession(
  sessionId: string,
  env: StripeEnv,
  userId: string,
): Promise<{ status: "paid" | "pending" | "already" }> {
  const stripe = createStripeClient(env);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.userId !== userId) throw new Error("Sessione non valida");
  if (session.mode !== "payment" || session.payment_status !== "paid") return { status: "pending" };

  if (session.customer) {
    await supabaseAdmin.from("profiles")
      .update({ stripe_customer_id: String(session.customer) })
      .eq("id", userId);
  }
  const { data: existing } = await supabaseAdmin.from("credit_transactions")
    .select("id").eq("user_id", userId).eq("reference_id", session.id).maybeSingle();
  if (existing) return { status: "already" };

  const items = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price"] });
  const line = items.data[0];
  const price: any = line?.price;
  const key = price?.lookup_key || price?.metadata?.lovable_external_id;
  const pack = key ? (CREDIT_PACKS[key] ?? LEGACY_CREDIT_PACKS[key]) : undefined;
  if (!pack) throw new Error("Pacchetto non riconosciuto");

  await supabaseAdmin.rpc("grant_credits", {
    _user_id: userId,
    _amount: pack.credits * (line?.quantity ?? 1),
    _kind: "purchase",
    _reason: pack.label,
    _reference_id: session.id,
  });

  const discountCodeId = session.metadata?.discountCodeId;
  if (discountCodeId) {
    const { data: red } = await supabaseAdmin.from("discount_redemptions")
      .select("id").eq("order_id", session.id).maybeSingle();
    if (!red) {
      await supabaseAdmin.from("discount_redemptions").insert({
        discount_code_id: discountCodeId,
        user_id: userId,
        order_id: session.id,
        discount_amount: session.total_details?.amount_discount
          ? Number(session.total_details.amount_discount) / 100 : 0,
      } as any);
      const { data: dc } = await supabaseAdmin.from("discount_codes")
        .select("used_count").eq("id", discountCodeId).maybeSingle();
      if (dc) await supabaseAdmin.from("discount_codes")
        .update({ used_count: (dc.used_count ?? 0) + 1 }).eq("id", discountCodeId);
    }
  }
  return { status: "paid" };
}
