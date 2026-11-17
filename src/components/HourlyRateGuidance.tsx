import { formatEuroRate, rateGuidance } from "@/lib/hourly-rate-guidance";

export const RATE_LOCKED_HELPER = "Seleziona prima gli anni di esperienza per scegliere la tariffa";

export function HourlyRateNote() {
  return (
    <p className="text-xs text-muted-foreground mt-1">
      È il compenso NETTO che desideri, solo indicativo: non è il netto garantito dal contratto né il costo per il ristoratore. Il compenso finale dipende dal turno proposto.
    </p>
  );
}

export function HourlyRateGuidance({ years, rate }: { years: string; rate: string }) {
  const g = rateGuidance(years, rate);
  if (!g) return null;
  return (
    <div role="status" aria-live="polite" className="mt-2 rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
      {g.status === "within" ? (
        <p>La tua richiesta rientra nella fascia indicativa per l'esperienza dichiarata.</p>
      ) : (
        <p>La tariffa che hai indicato supera la fascia orientativa per la tua esperienza: potresti ricevere meno opportunità compatibili. Puoi comunque mantenere il valore.</p>
      )}
      <p className="mt-1">Soglia di riferimento {formatEuroRate(g.threshold)} €/h netti</p>
    </div>
  );
}
