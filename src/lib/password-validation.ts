/**
 * Single source of truth for password rules.
 * UI hints, validation, and tests all read from PASSWORD_RULES.
 * If a rule changes, update it here AND the snapshot test will guide the UI text.
 */
export type PasswordRule = {
  id: "min-length" | "has-letter" | "has-digit";
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "min-length",
    label: "Almeno 8 caratteri",
    test: (p) => p.length >= 8,
  },
  {
    id: "has-letter",
    label: "Almeno una lettera",
    test: (p) => /[A-Za-z]/.test(p),
  },
  {
    id: "has-digit",
    label: "Almeno un numero",
    test: (p) => /\d/.test(p),
  },
] as const;

export function isPasswordStrongEnough(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

export function doPasswordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

export type PasswordValidation = {
  ok: boolean;
  error?: PasswordRule["id"] | "mismatch";
};

export function validatePasswordPair(password: string, confirm: string): PasswordValidation {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) return { ok: false, error: rule.id };
  }
  if (password !== confirm) return { ok: false, error: "mismatch" };
  return { ok: true };
}
