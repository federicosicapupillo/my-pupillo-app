import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

export function StripeEmbeddedCheckout({ priceId, customerEmail, userId, returnUrl, discountCode }: {
  priceId: string; customerEmail?: string; userId?: string; returnUrl?: string; discountCode?: string;
}) {
  const fetchClientSecret = async () =>
    createCheckoutSession({ data: { priceId, customerEmail, userId, discountCode, returnUrl: returnUrl || window.location.href, environment: getStripeEnvironment() } }) as Promise<string>;
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}