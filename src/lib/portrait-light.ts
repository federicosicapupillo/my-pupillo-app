/** Sfondo pieno albicocca per tutte le nuove foto dei lavoratori. */
export const PORTRAIT_BG_HEX = "#F4DDC8";
export const PORTRAIT_BG = { r: 0xf4, g: 0xdd, b: 0xc8 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Filtro «Luce ritratto»: correzione delicata applicata solo alla persona.
 * - bilanciamento del bianco parziale (gain per canale limitati a ±6%)
 * - esposizione verso un livello medio (gain limitato 0,94–1,12)
 * - schiarimento morbido delle ombre profonde
 * Nessuna sfocatura: texture e lineamenti restano intatti.
 * `rgba` è modificato in place; `alpha` (0..1) indica la persona.
 */
export function applyPortraitLight(rgba: Uint8ClampedArray, alpha: ArrayLike<number>): void {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0, p = 0; p < alpha.length; p++, i += 4) {
    if ((alpha[p] ?? 0) < 0.5) continue;
    sr += rgba[i]!; sg += rgba[i + 1]!; sb += rgba[i + 2]!; n++;
  }
  if (n === 0) return;
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const gray = (mr + mg + mb) / 3;
  const wb = (m: number) => clamp(Math.pow(gray / Math.max(1, m), 0.3), 0.94, 1.06);
  const gr = wb(mr), gg = wb(mg), gb = wb(mb);
  const meanL = 0.2126 * mr * gr + 0.7152 * mg * gg + 0.0722 * mb * gb;
  const exp = clamp(Math.pow(135 / Math.max(1, meanL), 0.5), 0.94, 1.12);
  for (let i = 0, p = 0; p < alpha.length; p++, i += 4) {
    const a = alpha[p] ?? 0;
    if (a <= 0) continue;
    let r = rgba[i]! * gr * exp, g = rgba[i + 1]! * gg * exp, b = rgba[i + 2]! * gb * exp;
    const L = clamp((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 0, 1);
    const lift = 0.1 * Math.pow(1 - L, 3);
    r += (255 - r) * lift; g += (255 - g) * lift; b += (255 - b) * lift;
    rgba[i] = rgba[i]! + (clamp(r, 0, 255) - rgba[i]!) * a;
    rgba[i + 1] = rgba[i + 1]! + (clamp(g, 0, 255) - rgba[i + 1]!) * a;
    rgba[i + 2] = rgba[i + 2]! + (clamp(b, 0, 255) - rgba[i + 2]!) * a;
  }
}

/** Sostituisce tutto lo sfondo con l'albicocca pieno, sfumando i bordi della persona. */
export function compositeOnPortraitBackground(rgba: Uint8ClampedArray, alpha: ArrayLike<number>): void {
  for (let i = 0, p = 0; p < alpha.length; p++, i += 4) {
    const a = clamp(alpha[p] ?? 0, 0, 1);
    rgba[i] = rgba[i]! * a + PORTRAIT_BG.r * (1 - a);
    rgba[i + 1] = rgba[i + 1]! * a + PORTRAIT_BG.g * (1 - a);
    rgba[i + 2] = rgba[i + 2]! * a + PORTRAIT_BG.b * (1 - a);
    rgba[i + 3] = 255;
  }
}

/** Quota di persona minima per considerare valido lo scontorno. */
export function maskCoverage(alpha: ArrayLike<number>): number {
  let s = 0;
  for (let p = 0; p < alpha.length; p++) if ((alpha[p] ?? 0) >= 0.5) s++;
  return alpha.length ? s / alpha.length : 0;
}
