import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

// Apre la pagina di pagamento sicura di Stripe. Un errore resta in questa
// scheda con un messaggio chiaro, senza far cadere tutta la pagina.
export function StripeEmbeddedCheckout({ priceId, returnUrl, discountCode }: {
  priceId: string; customerEmail?: string; userId?: string; returnUrl?: string; discountCode?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createCheckoutSession({
      data: { priceId, discountCode, returnUrl: returnUrl || window.location.href, environment: getStripeEnvironment() },
    })
      .then((url) => { window.location.href = url as string; })
      .catch((e: unknown) => {
        console.error("[checkout] failed", e);
        const msg = e instanceof Error ? e.message : "";
        setError(msg === "Price not found"
          ? "Il pacchetto non è ancora configurato nel tuo account Stripe."
          : "Non è stato possibile aprire il pagamento. Riprova tra poco.");
      });
  }, [priceId, discountCode, returnUrl]);

  if (error) return <p className="p-6 text-center text-sm text-destructive">{error}</p>;
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Apertura del pagamento sicuro…
    </div>
  );
}
