import { rateGuidance } from "@/lib/hourly-rate-guidance";

export const RATE_LOCKED_HELPER = "Seleziona prima gli anni di esperienza per scegliere la tariffa";

export function HourlyRateNote() {
  return (
    <div className="mt-1 space-y-2 text-xs text-muted-foreground">
      <p>Il compenso netto indicato è quello desiderato ed è orientativo. Il compenso effettivo viene concordato direttamente con il ristoratore.</p>
      <p className="leading-relaxed text-foreground">
        <strong>Pupillo mette in contatto lavoratori e ristoratori.</strong> Non è un’agenzia per il lavoro e non è parte del rapporto contrattuale tra loro. Accordi, compensi e adempimenti sono responsabilità delle parti: Pupillo non garantisce la conclusione né l’esecuzione del contratto.
      </p>
    </div>
  );
}

export function HourlyRateGuidance({ years, rate }: { years: string; rate: string }) {
  const g = rateGuidance(years, rate);
  if (g?.status !== "within") return null;
  return (
    <div role="status" aria-live="polite" className="mt-2 flex items-center gap-2 text-xs text-foreground">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-compensation-positive" />
      <span>Compenso in linea</span>
    </div>
  );
}
