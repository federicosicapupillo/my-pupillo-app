import { CalendarClock, Gift, Repeat2, Tag } from "lucide-react";
import { LAUNCH_PRICING, formatLaunchDate } from "@/lib/launch-pricing";

/**
 * Comunicazione informativa (NON un avviso di pagamento attivo) sulle
 * condizioni economiche che entreranno in vigore dopo il lancio gratuito.
 * Tutti i valori arrivano da `src/lib/launch-pricing.ts`: nessun dato hardcoded.
 * Non mostra mai pulsanti di acquisto o checkout.
 */
export function LaunchPricingNotice({ className = "" }: { className?: string }) {
  const c = LAUNCH_PRICING.copy;

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-card ${className}`}
      aria-labelledby="launch-pricing-title"
    >
      {/* Blocco 1 — periodo GRATUITO in corso */}
      <div className="border-b bg-emerald-500/5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Gift className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {c.freeBadge}
            </span>
            <h3 id="launch-pricing-title" className="mt-2 text-lg font-semibold leading-snug text-foreground">
              {c.title}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.intro}</p>
          </div>
        </div>
      </div>

      {/* Blocco 2 — tariffazione FUTURA, visivamente separata */}
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">In futuro</div>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.switchDate}</p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
              {c.priceBadge}
            </span>
            <span className="text-xs text-muted-foreground">stima, non ancora attiva</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{c.priceDetail}</p>
        </div>

        {LAUNCH_PRICING.freeRecontact && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Repeat2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Ricontatti gratis i lavoratori che hai già trovato
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.recontact}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {c.disclaimer} Nessun importo verrà addebitato prima del{" "}
          {formatLaunchDate(LAUNCH_PRICING.paidFrom)}.
        </p>
      </div>
    </section>
  );
}