export const WORKER_ROLES = [
  "Cameriere",
  "Bartender",
  "Barista",
  "Chef",
  "Aiuto cuoco",
  "Lavapiatti",
  "Runner",
  "Hostess",
  "Addetto sala",
  "Addetto banco",
  "Addetto cucina",
  "Pizzaiolo",
  "Responsabile sala",
  "Sommelier",
  "Addetto catering",
  "Sicurezza / controllo accessi",
  "DJ / intrattenimento",
  "Animatore eventi",
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];