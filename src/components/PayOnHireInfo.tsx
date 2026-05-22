import { ShieldCheck, Coins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Comunicazione trasparente: il ristoratore paga solo quando conferma un lavoratore.
 * Usato in dashboard, profilo, crea annuncio, billing e (variante compatta)
 * accanto al bottone di conferma candidatura.
 */
export function PayOnHireBox({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5",
        "shadow-[inset_0_1px_0_oklch(0.97_0.01_100/0.04)]",
        className,
      )}
      role="note"
      aria-label="Come funzionano i crediti su Pupillo"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground leading-tight">
            Paghi solo quando confermi
          </div>
          {!compact && (
            <p className="mt-1 text-sm text-muted-foreground">
              Puoi pubblicare offerte, ricevere candidature e chattare senza costi.
              I crediti vengono scalati solo quando confermi un lavoratore per il servizio.
            </p>
          )}
          {compact && (
            <p className="mt-1 text-sm text-muted-foreground">
              Pubblicare, ricevere candidature e chattare è gratis. Scali crediti solo alla conferma.
            </p>
          )}
          <div className="mt-2">
            <HowCreditsWorkPopover />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowCreditsWorkPopover({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium text-primary",
            "underline-offset-4 hover:underline focus-visible:underline outline-none",
            className,
          )}
        >
          <Coins className="h-3.5 w-3.5" />
          Come funzionano i crediti?
        </button>
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