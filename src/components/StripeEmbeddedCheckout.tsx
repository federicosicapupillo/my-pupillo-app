import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

export function StripeEmbeddedCheckout({ priceId, customerEmail, userId, returnUrl }: {
  priceId: string; customerEmail?: string; userId?: string; returnUrl?: string;
}) {
  const fetchClientSecret = async () =>
    createCheckoutSession({ data: { priceId, customerEmail, userId, returnUrl: returnUrl || window.location.href, environment: getStripeEnvironment() } }) as Promise<string>;
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}