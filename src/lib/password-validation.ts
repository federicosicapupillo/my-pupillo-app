export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function doPasswordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

export type PasswordValidation = {
  ok: boolean;
  error?: "too_short" | "missing_letter" | "missing_digit" | "mismatch";
};

export function validatePasswordPair(password: string, confirm: string): PasswordValidation {
  if (password.length < 8) return { ok: false, error: "too_short" };
  if (!/[A-Za-z]/.test(password)) return { ok: false, error: "missing_letter" };
  if (!/\d/.test(password)) return { ok: false, error: "missing_digit" };
  if (password !== confirm) return { ok: false, error: "mismatch" };
  return { ok: true };
}
