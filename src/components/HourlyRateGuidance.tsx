import { rateGuidance, rateReasonRequired, RATE_REASON_MAX } from "@/lib/hourly-rate-guidance";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export function HourlyRateReasonField({ id, years, rate, value, onChange }: { id: string; years: string; rate: string; value: string; onChange: (v: string) => void }) {
  if (!rateReasonRequired(years, rate)) return null;
  return (
    <div className="mt-3 space-y-1">
      <Label htmlFor={id}>Motivazione del compenso richiesto *</Label>
      <Textarea id={id} value={value} maxLength={RATE_REASON_MAX} rows={3} required
        placeholder="Es. esperienza specifica, competenze particolari, disponibilità per turni serali…"
        onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">Obbligatoria: il ristoratore la vedrà nella tua scheda.</p>
    </div>
  );
}
