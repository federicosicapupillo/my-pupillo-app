/**
 * Sorgente UNICA delle condizioni economiche del periodo di lancio.
 *
 * Aggiornare prezzo, date o testi SOLO qui: nessun componente deve
 * hardcodare importi o scadenze. Non contiene logica di addebito —
 * lo scalo crediti resta governato dal flag `payments_enabled` e da
 * `public.consume_credits()`.
 */

export type BillingModelStatus = "free_launch" | "announced" | "active";
export type PricingUnit = "per_completed_announcement";

export const LAUNCH_PRICING = {
  /** Stato del modello a pagamento. Finché è "free_launch"/"announced" nessun checkout va mostrato. */
  status: "free_launch" as BillingModelStatus,
  /** Ultimo giorno gratuito (incluso), ISO. */
  freeUntil: "2026-12-31",
  /** Primo giorno a pagamento, ISO. */
  paidFrom: "2027-01-01",
  /** Prezzo indicativo, non ancora definitivo. */
  price: 29.9,
  currency: "EUR" as const,
  /** Tipologia di tariffazione. */
  unit: "per_completed_announcement" as PricingUnit,
  /** Il ricontatto di un lavoratore già confermato resta gratuito. */
  freeRecontact: true,
  copy: {
    title: "Pupillo è gratuito fino al 31 dicembre 2026",
    freeBadge: "Gratuito fino al 31 dicembre 2026",
    priceBadge: "Da 29,90 € per annuncio concluso",
    intro:
      "Durante la fase di lancio a Bologna e provincia puoi pubblicare annunci, cercare lavoratori e utilizzare Pupillo gratuitamente.",
    switchDate: "Dal 1° gennaio 2027 il servizio diventerà a pagamento.",
    priceDetail:
      "Il costo previsto partirà da 29,90 € per annuncio concluso. Pagherai soltanto quando avrai trovato e confermato il lavoratore attraverso Pupillo.",
    recontact:
      "Dopo aver trovato un lavoratore, potrai ricontattare e richiamare gratuitamente lo stesso professionista per future collaborazioni, senza pagare nuovamente il costo dell’annuncio.",
    disclaimer:
      "Le condizioni economiche definitive saranno comunicate prima dell’introduzione del servizio a pagamento.",
  },
} as const;

/** Prezzo indicativo formattato (es. "29,90 €"). */
export function formatLaunchPrice(): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: LAUNCH_PRICING.currency,
  }).format(LAUNCH_PRICING.price);
}

/** Data di fine gratuità in formato esteso italiano (es. "31 dicembre 2026"). */
export function formatLaunchDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/** true finché il periodo gratuito è in corso (nessun addebito, nessun checkout). */
export function isFreeLaunchPeriod(now: Date = new Date()): boolean {
  return now < new Date(`${LAUNCH_PRICING.paidFrom}T00:00:00`);
}

/** Il checkout può comparire solo quando il modello a pagamento è realmente attivo. */
export function isPaidModelActive(): boolean {
  return LAUNCH_PRICING.status === "active";
}