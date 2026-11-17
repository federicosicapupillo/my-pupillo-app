// Indicazione NON bloccante sulla tariffa NETTA desiderata rispetto agli anni
// di esperienza dichiarati. Nessun filtro, nessun punteggio: solo un avviso.
// Soglia: 13 + min(2, 0.25 * max(0, anni - 2)) €/h netti.

export const RATE_OVER_30_SENTINEL = 31;

export const YEARS_OPTIONS: { value: string; label: string }[] = [
  { value: "prima_esperienza", label: "Prima esperienza" },
  { value: "meno_di_1", label: "Meno di 1 anno" },
  { value: "1", label: "1 anno" },
  { value: "2", label: "2 anni" },
  { value: "3", label: "3 anni" },
  { value: "4", label: "4 anni" },
  { value: "5", label: "5 anni" },
  { value: "6", label: "6 anni" },
  { value: "7", label: "7 anni" },
  { value: "8", label: "8 anni" },
  { value: "9", label: "9 anni" },
  { value: "10", label: "10 anni" },
  { value: "oltre_10", label: "Oltre 10 anni" },
];

/** Opzione legacy, mostrata solo se già salvata nel profilo. */
export const LEGACY_YEARS_6_10 = { value: "6_10", label: "6-10 anni" };

export const RATE_OPTIONS: { value: string; label: string }[] = [
  ...["8", "9", "10", "11", "12", "13", "14", "15", "16", "18", "20", "25", "30"].map((v) => ({ value: v, label: `${v} €/h` })),
  { value: "oltre_30", label: "Oltre 30 €/h" },
];

/** Converte il valore salvato in experience_years in anni numerici, o null se non specificato/sconosciuto. */
export function yearsToNumber(years: string | null | undefined): number | null {
  const y = (years ?? "").trim();
  if (!y) return null;
  if (y === "meno_di_1" || y === "prima_esperienza") return 0;
  if (y === "oltre_10") return 10; // almeno 10 anni => soglia piena 15
  if (y === "6_10") return 8; // legacy: punto medio dell'intervallo 6-10 => 14,50
  const n = Number(y.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function rateThreshold(years: string | null | undefined): number | null {
  const n = yearsToNumber(years);
  if (n == null) return null;
  return 13 + Math.min(2, 0.25 * Math.max(0, n - 2));
}

/** Converte il valore della select tariffa nel numero salvato (oltre_30 => 31). */
export function rateToNumber(rate: string | null | undefined): number | null {
  const r = (rate ?? "").trim();
  if (!r) return null;
  if (r === "oltre_30") return RATE_OVER_30_SENTINEL;
  const n = Number(r.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type RateGuidance = { status: "within" | "above"; threshold: number } | null;

export function rateGuidance(years: string | null | undefined, rate: string | null | undefined): RateGuidance {
  const t = rateThreshold(years);
  const r = rateToNumber(rate);
  if (t == null || r == null) return null;
  return { status: r <= t ? "within" : "above", threshold: t };
}

/** La tariffa si salva solo se gli anni sono specificati: mai tariffa con anni null. */
export function rateForSave(years: string | null | undefined, rate: string | null | undefined): number | null {
  if (!(years ?? "").trim()) return null;
  return rateToNumber(rate);
}

export function formatEuroRate(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

export const RATE_REASON_MIN = 10;
export const RATE_REASON_MAX = 300;

/** Motivazione obbligatoria quando il compenso desiderato è fuori range. */
export function rateReasonRequired(years: string | null | undefined, rate: string | null | undefined): boolean {
  return rateGuidance(years, rate)?.status === "above";
}

/** Errore da mostrare, o null se la motivazione va bene. */
export function rateReasonError(years: string | null | undefined, rate: string | null | undefined, reason: string | null | undefined): string | null {
  if (!rateReasonRequired(years, rate)) return null;
  const r = (reason ?? "").trim();
  if (r.length < RATE_REASON_MIN) return `Spiega perché chiedi questo compenso (almeno ${RATE_REASON_MIN} caratteri).`;
  if (r.length > RATE_REASON_MAX) return `La motivazione può avere al massimo ${RATE_REASON_MAX} caratteri.`;
  return null;
}

/** Motivazione salvata solo quando serve; altrimenti viene cancellata. */
export function rateReasonForSave(years: string | null | undefined, rate: string | null | undefined, reason: string | null | undefined): string | null {
  return rateReasonRequired(years, rate) ? (reason ?? "").trim() || null : null;
}
