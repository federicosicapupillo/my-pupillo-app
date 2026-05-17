export type Theme = "dark" | "light";

export const GLOBAL_THEME_KEY = "pupillo-theme";
export const userThemeKey = (uid: string) => `pupillo-theme:user:${uid}`;

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  root.classList.toggle("dark", t === "dark");
}

export function readGlobalTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(GLOBAL_THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "dark";
}

export function readUserTheme(uid: string): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(userThemeKey(uid));
    if (v === "light" || v === "dark") return v;
  } catch {}
  return null;
}

export function persistTheme(t: Theme, uid?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLOBAL_THEME_KEY, t);
    if (uid) localStorage.setItem(userThemeKey(uid), t);
  } catch {}
}