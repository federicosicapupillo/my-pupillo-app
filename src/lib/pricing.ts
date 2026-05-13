// Single source of truth for credit packs and plans.
// 7 crediti = 1 lavoratore confermato.
export const CREDITS_PER_HIRE = 7;

export type CreditPack = {
  credits: number;
  label: string;
  priceEur: number;
  hires: number;
  highlight?: "best" | "save";
  badge?: string;
  tagline?: string;
};

export const CREDIT_PACKS: Record<string, CreditPack> = {
  pack_start_21:  { credits: 21,  label: "START", priceEur: 49,  hires: 3,  tagline: "Per iniziare" },
  pack_smart_49:  { credits: 49,  label: "SMART", priceEur: 99,  hires: 7,  highlight: "best", badge: "Più scelto", tagline: "Consigliato" },
  pack_pro_98:    { credits: 98,  label: "PRO",   priceEur: 189, hires: 14, tagline: "Per ristoranti attivi" },
  pack_power_245: { credits: 245, label: "POWER", priceEur: 455, hires: 35, badge: "Miglior valore", tagline: "Massimo risparmio" },
};

export const PLAN_PRICES: Record<string, { plan: "pro" | "business"; label: string; priceEur: number }> = {
  pro_monthly: { plan: "pro", label: "Piano Pro", priceEur: 29 },
  business_monthly: { plan: "business", label: "Piano Business", priceEur: 79 },
};

// Credit costs for restaurant actions.
// Pubblicazione e contatto sono gratis: paghi solo quando confermi un lavoratore.
export const CREDIT_COSTS = {
  publishAnnouncement: 0,
  publishUrgentAnnouncement: 0,
  assignWorker: CREDITS_PER_HIRE, // 7
} as const;

// Soglia per il popup "Stai terminando i crediti" (< 2 conferme rimanenti).
export const LOW_CREDITS_THRESHOLD = CREDITS_PER_HIRE * 2; // 14