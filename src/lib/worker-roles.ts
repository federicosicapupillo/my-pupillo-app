export const WORKER_ROLES = [
  "Cameriere",
  "Bartender",
  "Barista",
  "Aiuto cucina",
  "Cuoco",
  "Chef de rang",
  "Runner",
  "Lavapiatti",
  "Pizzaiolo",
  "Receptionist",
  "Addetto sala",
  "Addetto cassa",
  "Banconista",
  "Hostess / Steward",
  "Addetto accoglienza",
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];