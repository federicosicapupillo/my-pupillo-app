/**
 * UNICA sorgente dati dei ruoli professionali di Pupillo (catalogo).
 *
 * Usata da:
 *  - form pubblicazione/modifica annuncio (ristoratore)
 *  - ricerca avanzata lavoratori (ristoratore)
 *  - filtro ruoli in "Trova offerte" (lavoratore)
 *  - onboarding e profilo lavoratore (WORKER_ROLES)
 *  - mappa e pannello admin
 *
 * Ogni ruolo ha: id tecnico stabile, label visualizzata, categoria, ordine,
 * stato attivo e alias legacy per la compatibilità con i dati già salvati.
 * `label` è il valore canonico persistito nelle colonne testuali
 * (`announcements.professional_profile`, `profiles.primary_role`,
 * `profiles.secondary_roles`); per qualsiasi confronto usare `roleIdOf()`.
 */
export type JobRoleCategory = "sala" | "bar" | "cucina" | "eventi" | "accoglienza";

export type JobRoleDefinition = {
  /** identificativo tecnico stabile (snake_case, mai tradotto) */
  id: string;
  /** nome visualizzato e valore canonico salvato a DB */
  label: string;
  category: JobRoleCategory;
  /** ordine di visualizzazione crescente */
  order: number;
  active: boolean;
  /** varianti storiche / sinonimi accettati in lettura */
  aliases?: string[];
};

export const JOB_ROLE_CATALOG: readonly JobRoleDefinition[] = [
  { id: "cameriere", label: "Cameriere", category: "sala", order: 10, active: true, aliases: ["camerieri", "cameriera", "chef de rang", "commis di sala"] },
  { id: "bartender", label: "Bartender", category: "bar", order: 20, active: true, aliases: ["barman", "barlady", "bar tender"] },
  { id: "barista", label: "Barista", category: "bar", order: 30, active: true, aliases: ["caffetteria"] },
  { id: "chef", label: "Chef", category: "cucina", order: 40, active: true, aliases: ["cuoco", "cuoca", "head chef", "executive chef", "sous chef"] },
  { id: "aiuto_cucina", label: "Aiuto cucina", category: "cucina", order: 50, active: true, aliases: ["aiuto cuoco", "commis di cucina"] },
  { id: "lavapiatti", label: "Lavapiatti", category: "cucina", order: 60, active: true, aliases: ["lavaggio piatti"] },
  { id: "runner", label: "Runner", category: "sala", order: 70, active: true },
  { id: "hostess", label: "Hostess", category: "accoglienza", order: 80, active: true, aliases: ["steward", "hostess / steward", "addetto accoglienza", "accoglienza"] },
  { id: "addetto_sala", label: "Addetto sala", category: "sala", order: 90, active: true },
  { id: "addetto_banco", label: "Addetto banco", category: "bar", order: 100, active: true, aliases: ["banconista", "bancone", "addetto cassa", "cassiere", "cassiera", "cassa"] },
  { id: "addetto_cucina", label: "Addetto cucina", category: "cucina", order: 110, active: true, aliases: ["kitchen helper", "kitchen porter"] },
  { id: "pizzaiolo", label: "Pizzaiolo", category: "cucina", order: 120, active: true, aliases: ["pizzaiola"] },
  { id: "responsabile_di_sala", label: "Responsabile di sala", category: "sala", order: 130, active: true, aliases: ["responsabile sala", "maitre", "maître", "capo sala", "caposala"] },
  { id: "sommelier", label: "Sommelier", category: "sala", order: 140, active: true },
  { id: "addetto_catering", label: "Addetto catering", category: "eventi", order: 150, active: true, aliases: ["catering", "banqueting", "addetto banqueting"] },
  { id: "receptionist", label: "Receptionist", category: "accoglienza", order: 160, active: true, aliases: ["reception"] },
  { id: "sicurezza_controllo_accessi", label: "Sicurezza / controllo accessi", category: "eventi", order: 170, active: true, aliases: ["sicurezza", "controllo accessi", "security", "buttafuori", "addetto sicurezza"] },
  { id: "dj_intrattenimento", label: "DJ / intrattenimento", category: "eventi", order: 180, active: true, aliases: ["dj", "deejay", "dj e intrattenimento", "intrattenimento", "intrattenitore", "dj entertainment"] },
  { id: "animatore_eventi", label: "Animatore eventi", category: "eventi", order: 190, active: true, aliases: ["animatore", "animatrice", "animazione", "event animator"] },
];

export const ACTIVE_JOB_ROLES: readonly JobRoleDefinition[] = JOB_ROLE_CATALOG
  .filter((r) => r.active)
  .slice()
  .sort((a, b) => a.order - b.order);

/** Etichette canoniche dei ruoli attivi, in ordine di visualizzazione. */
export const JOB_ROLES: readonly string[] = ACTIVE_JOB_ROLES.map((r) => r.label);

export type JobRole = string;

/** Chiave di confronto: minuscolo, senza accenti/punteggiatura/spazi. */
function compact(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const ID_BY_KEY = new Map<string, string>();
for (const role of JOB_ROLE_CATALOG) {
  ID_BY_KEY.set(compact(role.id), role.id);
  ID_BY_KEY.set(compact(role.label), role.id);
  for (const alias of role.aliases ?? []) ID_BY_KEY.set(compact(alias), role.id);
}

const ROLE_BY_ID = new Map(JOB_ROLE_CATALOG.map((r) => [r.id, r]));

/** Risolve qualsiasi variante (id, label, alias, legacy) nell'id tecnico. */
export function roleIdOf(value: string | null | undefined): string | null {
  const key = compact(String(value ?? ""));
  if (!key) return null;
  return ID_BY_KEY.get(key) ?? null;
}

/** Etichetta canonica da qualsiasi variante; se sconosciuta restituisce il testo originale. */
export function roleLabelOf(value: string | null | undefined): string {
  const id = roleIdOf(value);
  return id ? (ROLE_BY_ID.get(id)?.label ?? String(value ?? "")) : String(value ?? "").trim();
}

export function getJobRole(id: string): JobRoleDefinition | undefined {
  return ROLE_BY_ID.get(id);
}

/** true se i due valori indicano lo stesso ruolo (confronto per id tecnico). */
export function isSameRole(a: string | null | undefined, b: string | null | undefined): boolean {
  const idA = roleIdOf(a);
  const idB = roleIdOf(b);
  if (idA && idB) return idA === idB;
  return compact(String(a ?? "")) === compact(String(b ?? "")) && compact(String(a ?? "")) !== "";
}