/**
 * UNICA sorgente dati dei ruoli professionali di Pupillo.
 *
 * Usata da:
 *  - form pubblicazione annuncio (ristoratore)
 *  - filtro ruoli in "Trova offerte" (lavoratore)
 *  - preferenze professionali del profilo lavoratore (WORKER_ROLES)
 *
 * Le etichette qui sotto sono i valori canonici salvati in
 * `announcements.professional_profile`. Per il confronto con dati storici
 * (maiuscole/accenti/varianti) usare sempre `normalizeRole()`.
 */
export const JOB_ROLES = [
  "Cameriere",
  "Bartender",
  "Barista",
  "Chef",
  "Aiuto cucina",
  "Lavapiatti",
  "Runner",
  "Hostess",
  "Addetto sala",
  "Addetto banco",
  "Addetto cucina",
  "Pizzaiolo",
  "Responsabile di sala",
  "Sommelier",
  "Addetto catering",
  "Receptionist",
  "Sicurezza / controllo accessi",
  "DJ / intrattenimento",
  "Animatore eventi",
] as const;

export type JobRole = (typeof JOB_ROLES)[number];