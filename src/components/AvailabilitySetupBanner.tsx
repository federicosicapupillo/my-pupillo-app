import { Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkerAvailabilityStatus } from "@/lib/use-worker-availability-status";

/**
 * Mostrato al lavoratore finché non ha salvato almeno una disponibilità valida.
 * Durante loading / errore il banner NON viene mostrato.
 */
export function AvailabilitySetupBanner({
  userId,
  className,
}: {
  userId: string | null | undefined;
  className?: string;
}) {
  const { hasAvailability, isLoading, isError } = useWorkerAvailabilityStatus(userId);
  if (!userId || isLoading || isError || hasAvailability !== false) return null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-primary bg-primary/10 p-4 sm:p-5 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-bold sm:text-lg">Imposta le tue disponibilità</h2>
            <p className="text-sm text-muted-foreground">
              Per essere trovato dai ristoratori e iniziare a ricevere proposte di lavoro, indica i
              giorni e gli orari in cui sei disponibile.
            </p>
            <p className="text-xs text-muted-foreground">Richiede meno di un minuto.</p>
          </div>
        </div>
        <Button asChild size="lg" className="w-full gap-2 sm:w-auto sm:shrink-0">
          <Link to="/availability">
            Inserisci disponibilità <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
