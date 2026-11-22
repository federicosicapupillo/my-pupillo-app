import { ArrowRight, Check, Coins, Infinity, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreditPackCard({ credits, price, originalPrice, discountCode, onPurchase }: {
  credits: number;
  price: number;
  originalPrice: number;
  discountCode?: string;
  onPurchase: () => void;
}) {
  const amount = (value: number) => value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <article className="overflow-hidden rounded-lg border border-pack-border bg-pack text-pack-foreground shadow-pack">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pack-border px-6 py-4">
        <span className="inline-flex items-center gap-2 text-sm font-bold"><UserCheck className="size-5" aria-hidden />Conferma lavoratore</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pack-highlight px-3 py-1 text-xs font-bold text-pack-highlight-foreground"><Coins className="size-3.5" aria-hidden />{credits} crediti</span>
      </div>
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <p className="text-sm font-semibold text-pack-muted">Un nuovo lavoratore. Un solo acquisto.</p>
        {price !== originalPrice && <p className="mt-3 text-sm text-pack-muted line-through">{amount(originalPrice)} €</p>}
        <p className="mt-3 flex flex-wrap items-baseline gap-2"><span className="text-5xl font-black tabular-nums text-pack-highlight">{amount(price)}</span><span className="text-2xl font-bold text-pack-highlight">€</span></p>
        {discountCode && price !== originalPrice && <p className="mt-2 text-xs text-pack-highlight">Sconto {discountCode}</p>}
        <div className="mt-6 flex items-center gap-3 border-y border-pack-border py-4">
          <Infinity className="size-8 shrink-0 text-pack-highlight" aria-hidden />
          <div><p className="font-bold">Richiami illimitati</p><p className="mt-1 text-sm text-pack-muted">La stessa persona, senza altri costi.</p></div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-pack-muted"><Check className="mt-0.5 size-4 shrink-0 text-pack-highlight" aria-hidden />1 lavoratore confermato, da richiamare ogni volta che vuoi.</p>
        <Button onClick={onPurchase} className="mt-6 h-12 w-full bg-pack-highlight text-pack-highlight-foreground shadow-none hover:bg-pack-highlight/90 hover:text-pack-highlight-foreground hover:shadow-none">
          Acquista a {amount(price)} €<ArrowRight aria-hidden />
        </Button>
      </div>
    </article>
  );
}