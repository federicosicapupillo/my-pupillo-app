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

/** Unico pacchetto in vendita: 1 lavoratore confermato a 29,70 €. */
export const SINGLE_PACK_KEY = "pack_single_7";

export const CREDIT_PACKS: Record<string, CreditPack> = {
  [SINGLE_PACK_KEY]: { credits: 7, label: "Conferma lavoratore", priceEur: 29.7, hires: 1, tagline: "Richiami illimitati della stessa persona" },
};

/** Pacchetti non più in vendita: servono solo al webhook per accreditare acquisti già avviati. */
export const LEGACY_CREDIT_PACKS: Record<string, CreditPack> = {
  pack_start_21:  { credits: 21,  label: "START", priceEur: 49,  hires: 3 },
  pack_smart_49:  { credits: 49,  label: "SMART", priceEur: 99,  hires: 7 },
  pack_pro_98:    { credits: 98,  label: "PRO",   priceEur: 189, hires: 14 },
  pack_power_245: { credits: 245, label: "POWER", priceEur: 455, hires: 35 },
};

/** Testo unico sui richiami illimitati. */
export const UNLIMITED_RECALL_COPY =
  "Paghi una sola volta per lavoratore: poi puoi richiamare la stessa persona in modo illimitato, senza costi aggiuntivi.";

// Credit costs for restaurant actions.
// Pubblicazione e contatto sono gratis: paghi solo quando confermi un lavoratore.
export const CREDIT_COSTS = {
  publishAnnouncement: 0,
  publishUrgentAnnouncement: 0,
  assignWorker: CREDITS_PER_HIRE, // 7
} as const;

// Soglia per il popup "Stai terminando i crediti" (< 2 conferme rimanenti).
export const LOW_CREDITS_THRESHOLD = CREDITS_PER_HIRE * 2; // 14