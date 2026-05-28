/**
 * Lista canonica unica dei ruoli Ho.Re.Ca.
 * Usata sia lato lavoratore (profilo / competenze) sia lato ristoratore
 * (creazione annuncio / ricerca lavoratori). Per il matching usare le
 * funzioni in `worker-role-normalization.ts` che gestiscono sinonimi
 * (es. Caposala / Maître → Responsabile di sala).
 */
export const WORKER_ROLES = [
  // SALA
  "Cameriere",
  "Runner",
  "Responsabile di sala",
  "Caposala",
  "Maître",
  "Hostess",
  "Steward",
  "Addetto accoglienza",
  "Banconista",
  "Barista",
  "Bartender",
  // CUCINA
  "Chef",
  "Cuoco",
  "Aiuto cuoco",
  "Commis di cucina",
  "Pizzaiolo",
  "Aiuto pizzaiolo",
  "Lavapiatti",
  "Addetto preparazioni",
  // EVENTI / EXTRA
  "Addetto catering",
  "Addetto banqueting",
  "Addetto buffet",
  "Addetto cassa",
  "Addetto delivery",
  "Addetto pulizie",
  "Receptionist",
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];