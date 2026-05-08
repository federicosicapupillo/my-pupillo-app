export const CONTACT_ROLES = [
  "Titolare",
  "Socio",
  "Direttore",
  "Direttore operativo",
  "Restaurant manager",
  "Responsabile di sala",
  "Responsabile eventi",
  "Responsabile HR",
  "Responsabile amministrativo",
  "Chef / Executive chef",
  "Bar manager",
  "Event manager",
  "Referente turni",
  "Altro",
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];

// Strict-ish email regex: text@domain.tld (no spaces, requires dot in domain)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v || /\s/.test(v)) return false;
  return EMAIL_RE.test(v);
}

export function displayContactRole(role: string | null | undefined, other: string | null | undefined): string | null {
  if (!role) return null;
  if (role === "Altro") return (other && other.trim()) || "Altro";
  return role;
}