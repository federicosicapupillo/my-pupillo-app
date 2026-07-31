// Alias e ruoli canonici arrivano dal catalogo unico dei ruoli.
import { roleIdOf } from "@/lib/job-roles";

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
  return roleIdOf(role) ?? compacted;
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