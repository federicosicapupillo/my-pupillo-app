const ROLE_SYNONYMS: Record<string, string[]> = {
  cameriere: ["cameriere", "camerieri", "cameriera", "cameriere di sala", "commis di sala", "chef de rang"],
  "responsabile di sala": [
    "responsabile di sala",
    "responsabile sala",
    "responsabile_di_sala",
    "responsabile_sala",
    "caposala",
    "capo sala",
    "maitre",
    "maître",
    "coordinatore sala",
    "cameriere responsabile",
  ],
  bartender: ["bartender", "bar tender", "bar_tender", "barman", "barlady", "addetto cocktail", "addetta cocktail", "preparazione cocktail", "preparazione_cocktail", "cocktail base"],
  barista: ["barista", "caffetteria"],
  chef: ["chef", "cuoco", "cuoca"],
  "aiuto cuoco": ["aiuto cuoco", "aiuto cucina", "aiuto_cucina"],
  "commis di cucina": ["commis di cucina", "commis_cucina"],
  "addetto preparazioni": ["addetto preparazioni", "addetto_preparazioni", "preparazioni"],
  runner: ["runner"],
  lavapiatti: ["lavapiatti", "lavaggio piatti"],
  pizzaiolo: ["pizzaiolo", "pizzaiola", "pizzeria"],
  "aiuto pizzaiolo": ["aiuto pizzaiolo", "aiuto_pizzaiolo"],
  hostess: ["hostess", "hostess / steward"],
  steward: ["steward"],
  sommelier: ["sommelier"],
  "addetto sala": ["addetto sala", "addetto_sala"],
  "addetto cassa": ["addetto cassa", "addetto_cassa", "cassa", "cassiere", "cassiera", "gestione cassa", "gestione_cassa"],
  banconista: ["banconista", "bancone"],
  receptionist: ["receptionist", "reception", "accoglienza", "addetto accoglienza", "addetto_accoglienza"],
  "addetto catering": ["addetto catering", "addetto_catering", "catering"],
  "addetto banqueting": ["addetto banqueting", "addetto_banqueting", "banqueting"],
  "addetto buffet": ["addetto buffet", "addetto_buffet", "buffet"],
  "addetto delivery": ["addetto delivery", "addetto_delivery", "delivery", "rider"],
  "addetto pulizie": ["addetto pulizie", "addetto_pulizie", "pulizie"],
};

const ALIAS_TO_CANONICAL = Object.entries(ROLE_SYNONYMS).reduce<Record<string, string>>((acc, [canonical, aliases]) => {
  const canonicalKey = compactRole(canonical);
  acc[canonicalKey] = canonicalKey;
  for (const alias of aliases) acc[compactRole(alias)] = canonicalKey;
  return acc;
}, {});

function compactRole(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-\/]+/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeRole(role: string | null | undefined): string {
  const compacted = compactRole(String(role ?? ""));
  if (!compacted) return "";
  return ALIAS_TO_CANONICAL[compacted] ?? compacted;
}

export function splitRoleValue(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(splitRoleValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(splitRoleValue);
  return String(value)
    .split(/[,;|\n•·]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function roleMatches(candidate: string | null | undefined, target: string | null | undefined): boolean {
  const normalizedTarget = normalizeRole(target);
  if (!normalizedTarget) return true;
  return splitRoleValue(candidate).some((part) => normalizeRole(part) === normalizedTarget);
}

export function collectWorkerRoleValues(worker: {
  primary_role?: string | null;
  secondary_roles?: string[] | null;
  professional_profile?: string | null;
}): string[] {
  return [
    ...splitRoleValue(worker.primary_role),
    ...splitRoleValue(worker.secondary_roles),
    ...splitRoleValue(worker.professional_profile),
  ];
}

export function collectWorkerCompetenceValues(worker: {
  default_required_skills?: string[] | null;
}): string[] {
  return splitRoleValue(worker.default_required_skills);
}

export function workerMatchesAnyRoleField(worker: {
  primary_role?: string | null;
  secondary_roles?: string[] | null;
  professional_profile?: string | null;
  default_required_skills?: string[] | null;
}, target: string | null | undefined): boolean {
  const normalizedTarget = normalizeRole(target);
  if (!normalizedTarget) return true;
  return [...collectWorkerRoleValues(worker), ...collectWorkerCompetenceValues(worker)]
    .some((value) => normalizeRole(value) === normalizedTarget);
}