import { Sparkles } from "lucide-react";

/**
 * Banner mostrato quando il flag `payments_enabled` è OFF (periodo di lancio).
 * Il caller decide se mostrarlo: qui è solo la UI. Tono orientato al beneficio,
 * nessun dettaglio tecnico.
 */
export function FreeLaunchBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 text-sm ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="font-semibold text-foreground">
            Lancio Bologna — la piattaforma è gratuita fino al 31 dicembre.
          </div>
          <p className="mt-0.5 text-muted-foreground">
            Confermi i lavoratori senza costi. Nessun credito viene scalato.
          </p>
        </div>
      </div>
    </div>
  );
}