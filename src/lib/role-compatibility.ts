// Centralised worker ↔ required-role compatibility helper used by
// both restaurant search and worker browse pages.
//
// Rules:
//   - compatible      → the required role is listed among the worker's
//                       primary/secondary roles (alias-aware)
//   - not_compatible  → the worker has declared roles but the required
//                       role is not one of them
//   - unknown         → no required role to compare, or the worker has
//                       no declared roles at all

export type RoleCompatibility = "compatible" | "not_compatible" | "unknown";

export type RoleCompatibilityResult = {
  status: RoleCompatibility;
  requiredRoleLabel: string; // human label of the required role (lower-case)
  workerRoles: string[];     // normalised worker roles
};

// Cheap alias table — keep in sync with workers.tsx ROLE_ALIASES (lower-case).
// We intentionally keep this small: just the common Italian variants.
const ROLE_ALIASES: Record<string, string[]> = {
  cameriere: ["cameriere", "cameriera", "sala", "addetto sala", "addetta sala", "waiter", "waitress"],
  cameriera: ["cameriere", "cameriera", "sala", "addetto sala", "addetta sala", "waiter", "waitress"],
  lavapiatti: ["lavapiatti", "dishwasher", "plonge"],
  cuoco: ["cuoco", "cuoca", "chef", "capo cucina"],
  aiuto_cuoco: ["aiuto cuoco", "aiuto-cuoco", "aiuto_cuoco", "commis", "commis di cucina"],
  pizzaiolo: ["pizzaiolo", "pizzaiola"],
  barista: ["barista", "bartender"],
  bartender: ["barista", "bartender"],
  runner: ["runner", "addetto runner"],
  hostess: ["hostess", "host", "accoglienza"],
};

function normalize(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toLowerCase();
}

export function getWorkerRoles(
  worker: { primary_role?: string | null; secondary_roles?: string[] | null } | null | undefined,
): string[] {
  if (!worker) return [];
  const out = new Set<string>();
  const p = normalize(worker.primary_role);
  if (p) out.add(p);
  for (const r of worker.secondary_roles ?? []) {
    const n = normalize(r);
    if (n) out.add(n);
  }
  return Array.from(out);
}

export function getRoleCompatibility(
  worker: { primary_role?: string | null; secondary_roles?: string[] | null } | null | undefined,
  requiredRole: string | null | undefined,
): RoleCompatibilityResult {
  const required = normalize(requiredRole);
  const roles = getWorkerRoles(worker);
  if (!required) return { status: "unknown", requiredRoleLabel: "", workerRoles: roles };
  if (roles.length === 0) {
    return { status: "unknown", requiredRoleLabel: required, workerRoles: roles };
  }
  const aliases = ROLE_ALIASES[required] ?? [required];
  const match = roles.some((r) => aliases.some((a) => r === a || r.includes(a) || a.includes(r)));
  return {
    status: match ? "compatible" : "not_compatible",
    requiredRoleLabel: required,
    workerRoles: roles,
  };
}

export function isWorkerCompatibleWithRole(
  worker: { primary_role?: string | null; secondary_roles?: string[] | null } | null | undefined,
  requiredRole: string | null | undefined,
): boolean {
  return getRoleCompatibility(worker, requiredRole).status === "compatible";
}

export type RoleCompatibilityBadge = {
  text: string;
  cls: string;
  tone: "ok" | "warn" | "neutral";
};

export function getRoleCompatibilityBadge(
  result: RoleCompatibilityResult,
): RoleCompatibilityBadge | null {
  if (!result.requiredRoleLabel) return null;
  if (result.status === "compatible") {
    return {
      text: "Compatibile",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      tone: "ok",
    };
  }
  if (result.status === "not_compatible") {
    return {
      text: `Fuori mansione · non fa ${result.requiredRoleLabel}`,
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      tone: "warn",
    };
  }
  return {
    text: "Profilo mansioni incompleto",
    cls: "bg-muted text-foreground/70",
    tone: "neutral",
  };
}

// Italian warning copy used by both the worker-side "apply anyway?" prompt
// and the restaurant-side "invite anyway?" prompt.
export function getMissingRoleWarning(
  result: RoleCompatibilityResult,
  audience: "worker" | "restaurant",
): string | null {
  if (result.status !== "not_compatible") return null;
  if (audience === "worker") {
    return `Questo annuncio richiede "${result.requiredRoleLabel}" che non hai selezionato tra le tue mansioni. Vuoi candidarti comunque?`;
  }
  return `Questo lavoratore non ha indicato "${result.requiredRoleLabel}" tra le sue mansioni. Vuoi procedere comunque?`;
}