export type PhonePrefix = { code: string; country: string; flag?: string };

export const PHONE_PREFIXES: PhonePrefix[] = [
  { code: "+39", country: "Italia", flag: "🇮🇹" },
  { code: "+33", country: "Francia", flag: "🇫🇷" },
  { code: "+34", country: "Spagna", flag: "🇪🇸" },
  { code: "+49", country: "Germania", flag: "🇩🇪" },
  { code: "+41", country: "Svizzera", flag: "🇨🇭" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+44", country: "Regno Unito", flag: "🇬🇧" },
  { code: "+31", country: "Paesi Bassi", flag: "🇳🇱" },
  { code: "+32", country: "Belgio", flag: "🇧🇪" },
  { code: "+351", country: "Portogallo", flag: "🇵🇹" },
  { code: "+40", country: "Romania", flag: "🇷🇴" },
  { code: "+355", country: "Albania", flag: "🇦🇱" },
  { code: "+380", country: "Ucraina", flag: "🇺🇦" },
  { code: "+48", country: "Polonia", flag: "🇵🇱" },
  { code: "+1", country: "Stati Uniti / Canada", flag: "🇺🇸" },
];

export const DEFAULT_PHONE_PREFIX = "+39";

/** Splits a stored phone like "+393381234567" or "+39 338 1234567" into {code, number}. */
export function splitPhone(full?: string | null): { code: string; number: string } {
  if (!full) return { code: DEFAULT_PHONE_PREFIX, number: "" };
  const trimmed = String(full).trim();
  const prefixes = [...PHONE_PREFIXES].sort((a, b) => b.code.length - a.code.length);
  const compact = trimmed.replace(/\s+/g, "");
  for (const p of prefixes) {
    if (compact.startsWith(p.code)) {
      return { code: p.code, number: compact.slice(p.code.length).replace(/\D/g, "") };
    }
  }
  return { code: DEFAULT_PHONE_PREFIX, number: trimmed.replace(/\D/g, "") };
}

export function buildPhoneFull(code: string, number: string): string {
  const c = (code || DEFAULT_PHONE_PREFIX).trim();
  const n = (number || "").replace(/\D/g, "");
  if (!n) return "";
  return `${c}${n}`;
}

export function isValidPhone(code: string, number: string): boolean {
  if (!code || !PHONE_PREFIXES.find((p) => p.code === code)) return false;
  const n = (number || "").replace(/\D/g, "");
  return n.length >= 6 && n.length <= 15;
}
