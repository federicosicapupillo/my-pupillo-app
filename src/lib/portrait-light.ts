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

/** Rende netta la maschera: sotto 0,35 è sfondo pieno, sopra 0,65 persona piena, in mezzo bordo morbido. */
export function refineAlpha(alpha: Float32Array, lo = 0.35, hi = 0.65): void {
  for (let p = 0; p < alpha.length; p++) {
    const t = clamp(((alpha[p] ?? 0) - lo) / (hi - lo), 0, 1);
    alpha[p] = t * t * (3 - 2 * t);
  }
}

/** Media su finestra quadrata (raggio r) tramite immagine integrale. */
function boxMean(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += src[y * w + x]!; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1]! + row; }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1]! - I[y0 * (w + 1) + x1]! - I[y1 * (w + 1) + x0]! + I[y0 * (w + 1) + x0]!;
      out[y * w + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/**
 * Filtro guidato (He et al.): allinea i bordi della maschera ai contorni reali
 * della foto (capelli, spalle, orecchie) invece dei blocchi della maschera a bassa risoluzione.
 */
export function guidedRefineAlpha(rgba: Uint8ClampedArray, alpha: Float32Array, w: number, h: number, r = 6, eps = 1e-3): Float32Array {
  const n = w * h;
  const I = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) I[p] = (0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!) / 255;
  const II = new Float32Array(n), Ip = new Float32Array(n);
  for (let p = 0; p < n; p++) { II[p] = I[p]! * I[p]!; Ip[p] = I[p]! * alpha[p]!; }
  const mI = boxMean(I, w, h, r), mp = boxMean(alpha, w, h, r), mII = boxMean(II, w, h, r), mIp = boxMean(Ip, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const varI = mII[p]! - mI[p]! * mI[p]!;
    a[p] = (mIp[p]! - mI[p]! * mp[p]!) / (varI + eps);
    b[p] = mp[p]! - a[p]! * mI[p]!;
  }
  const ma = boxMean(a, w, h, r), mb = boxMean(b, w, h, r);
  const out = new Float32Array(n);
  for (let p = 0; p < n; p++) out[p] = clamp(ma[p]! * I[p]! + mb[p]!, 0, 1);
  return out;
}

/**
 * Toglie l'alone del vecchio sfondo sui bordi: i pixel semitrasparenti prendono
 * il colore medio della persona vicina, così lo sfondo nuovo non sembra «appiccicato».
 */
export function decontaminateEdges(rgba: Uint8ClampedArray, alpha: Float32Array, w: number, h: number, r = 4): void {
  const n = w * h;
  const wa = new Float32Array(n);
  for (let p = 0; p < n; p++) { const v = alpha[p]!; wa[p] = v > 0.9 ? 1 : 0; }
  const mw = boxMean(wa, w, h, r);
  for (let c = 0; c < 3; c++) {
    const ch = new Float32Array(n);
    for (let p = 0; p < n; p++) ch[p] = rgba[p * 4 + c]! * wa[p]!;
    const mc = boxMean(ch, w, h, r);
    for (let p = 0; p < n; p++) {
      const a = alpha[p]!;
      if (a <= 0.02 || a >= 0.9 || mw[p]! < 0.02) continue;
      const fg = mc[p]! / mw[p]!;
      const k = 1 - a; // più è trasparente, più è contaminato
      rgba[p * 4 + c] = rgba[p * 4 + c]! * (1 - k) + fg * k;
    }
  }
}

/** Ammorbidisce la pelle in modo leggero preservando i bordi (occhi, labbra, barba). */
export function softenSkin(rgba: Uint8ClampedArray, alpha: Float32Array, w: number, h: number, strength = 0.35): void {
  const n = w * h;
  for (let c = 0; c < 3; c++) {
    const ch = new Float32Array(n);
    for (let p = 0; p < n; p++) ch[p] = rgba[p * 4 + c]! / 255;
    const fakeRgba = new Uint8ClampedArray(n * 4);
    for (let p = 0; p < n; p++) { const v = rgba[p * 4 + c]!; fakeRgba[p * 4] = v; fakeRgba[p * 4 + 1] = v; fakeRgba[p * 4 + 2] = v; }
    const smooth = guidedRefineAlpha(fakeRgba, ch, w, h, 3, 4e-3);
    for (let p = 0; p < n; p++) {
      const a = alpha[p]!;
      if (a < 0.5) continue;
      rgba[p * 4 + c] = clamp(rgba[p * 4 + c]! * (1 - strength * a) + smooth[p]! * 255 * strength * a, 0, 255);
    }
  }
}

/**
 * Sfondo da studio: albicocca con lieve luce al centro, bordi appena più scuri,
 * leggera ombra dietro la persona e grana fine uniforme, così sembra un fondale reale.
 */
export function compositeOnStudioBackground(rgba: Uint8ClampedArray, alpha: Float32Array, w: number, h: number, seed = 1): void {
  const n = w * h;
  const shadow = boxMean(alpha, w, h, Math.max(4, Math.round(w / 40)));
  const dx = Math.round(w / 60);
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) - 0.5; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      const nx = x / w - 0.5, ny = y / h - 0.38;
      const d = Math.sqrt(nx * nx + ny * ny);
      let shade = 1.02 - 0.1 * d * d;
      const sp = y * w + Math.max(0, x - dx);
      shade -= 0.04 * (shadow[sp] ?? 0);
      const a = clamp(alpha[p]!, 0, 1);
      const grain = rnd() * 4;
      rgba[i] = clamp(rgba[i]! * a + (PORTRAIT_BG.r * shade) * (1 - a) + grain, 0, 255);
      rgba[i + 1] = clamp(rgba[i + 1]! * a + (PORTRAIT_BG.g * shade) * (1 - a) + grain, 0, 255);
      rgba[i + 2] = clamp(rgba[i + 2]! * a + (PORTRAIT_BG.b * shade) * (1 - a) + grain, 0, 255);
      rgba[i + 3] = 255;
    }
  }
}
