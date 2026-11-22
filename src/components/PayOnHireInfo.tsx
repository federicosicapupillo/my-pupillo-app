import { ShieldCheck, Coins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Comunicazione trasparente: il ristoratore paga solo quando conferma un lavoratore.
 * Usato in dashboard, profilo, crea annuncio, billing e (variante compatta)
 * accanto al bottone di conferma candidatura.
 */
export function PayOnHireBox({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-pack-border bg-pack text-pack-foreground",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6",
        className,
      )}
      role="note"
      aria-label="Come funzionano i crediti su Pupillo"
    >
      <div className="relative flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 rounded-lg bg-pack-highlight/10 text-pack-highlight flex items-center justify-center ring-1 ring-pack-highlight/25",
            compact ? "h-12 w-12" : "h-14 w-14",
          )}
        >
          <ShieldCheck className={cn(compact ? "h-6 w-6" : "h-7 w-7")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn("font-bold text-pack-foreground leading-tight", compact ? "text-lg" : "text-xl")}>
              Paghi solo quando confermi
            </div>
            <span className="inline-flex items-center rounded-full bg-pack-highlight px-2.5 py-1 text-xs font-semibold text-pack-highlight-foreground">
              Nessun costo per pubblicare
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-pack-muted">
            Puoi pubblicare offerte, ricevere candidature e chattare gratuitamente. I crediti vengono scalati solo quando confermi un lavoratore per un turno.
          </p>

          {!compact && (
            <p className="mt-1.5 text-xs text-pack-muted">
              Così paghi solo quando Pupillo ti aiuta davvero a coprire un servizio.
            </p>
          )}

          <div className="mt-3">
            <HowCreditsWorkPopover compact={compact} className="text-pack-highlight" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowCreditsWorkPopover({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          type="button"
          className={cn(
            "h-auto p-0 inline-flex items-center gap-1.5 font-medium text-accent",
            "underline-offset-4 hover:underline focus-visible:underline outline-none",
            compact ? "text-xs" : "text-sm",
            className,
          )}
        >
          <Coins className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          Come funzionano i crediti?
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] text-sm leading-relaxed">
        <div className="font-semibold text-foreground mb-2">Come funzionano i crediti</div>
        <p className="text-muted-foreground">
          Su Pupillo puoi cercare lavoratori, pubblicare offerte e ricevere
          candidature senza pagare ogni singola interazione.
        </p>
        <p className="text-muted-foreground mt-2">
          I crediti vengono utilizzati <strong className="text-foreground">solo quando confermi un lavoratore</strong> per un turno.
        </p>
        <p className="text-muted-foreground mt-2">
          In questo modo paghi solo quando la piattaforma ti sta realmente
          aiutando a coprire un servizio.
        </p>
      </PopoverContent>
    </Popover>
  );
}
