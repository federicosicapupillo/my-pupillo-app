/**
 * Regia 2.5D di Pupillo (fase A, solo immagine ritagliata, nessun rig).
 * La posa è una funzione pura della posizione di scroll: stesso punto, stesso stato,
 * in avanti e all'indietro.
 */

/** Misure in pixel sull'immagine autentica del logo (1041×649), lette dalla maschera del cappello. */
export const LOGO_SIZE = { w: 1041, h: 649 } as const;
export const HAT = {
  /** Ritaglio usato come occlusore (pupillo-logo-cappello.webp). */
  crop: { x: 555, y: 15, w: 276, h: 191 },
  /** Bordo superiore del cappello (contorno nero) e base della fascia. */
  top: 30,
  bandBottom: 185,
  /** Centro della fascia: il cappello è decentrato a destra nel logo. */
  bandCenterX: 687,
  left: 562,
  right: 823,
  /** Punto di presa sul bordo destro dello sbuffo. */
  grip: { x: 823, y: 118 },
} as const;

/** Mascotte ritagliata: 478×588; punto della mano alzata (presa). */
export const MASCOT = { w: 478, h: 588, hand: { x: 60, y: 120 } } as const;

export type Rect = { x: number; y: number; w: number; h: number };
export type Stop = { id: string; perch: Rect; scroll: number };
export type Pose = {
  /** Punto dei piedi (centro in basso) in coordinate documento. */
  fx: number; fy: number;
  s: number; sx: number; sy: number; rot: number;
  opacity: number;
  /** Ritaglio in coordinate documento (solo durante l'emersione). */
  clip: { bottom: number; left: number; right: number } | null;
  front: boolean;
  phase: string;
};
export type Bubbles = Record<string, number>;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function hatGeometry(logo: Rect) {
  const X = (px: number) => logo.x + (px / LOGO_SIZE.w) * logo.w;
  const Y = (py: number) => logo.y + (py / LOGO_SIZE.h) * logo.h;
  return {
    top: Y(HAT.top), bandBottom: Y(HAT.bandBottom), centerX: X(HAT.bandCenterX),
    left: X(HAT.left), right: X(HAT.right), grip: { x: X(HAT.grip.x), y: Y(HAT.grip.y) },
    width: X(HAT.right) - X(HAT.left),
  };
}

function foot(p: Rect) { return { x: p.x + p.w / 2, y: p.y + p.h }; }

/** Salto naturale tra due appoggi: preparazione, arco, atterraggio, assestamento. */
function jump(a: { x: number; y: number; s: number }, b: { x: number; y: number; s: number }, t: number): Pose {
  const base = { opacity: 1, clip: null, front: true };
  if (t < 0.12) {
    const k = Math.sin((t / 0.12) * Math.PI * 0.5);
    return { ...base, fx: a.x, fy: a.y, s: a.s, sx: 1 + 0.08 * k, sy: 1 - 0.1 * k, rot: 0, phase: "preparazione" };
  }
  if (t < 0.86) {
    const u = (t - 0.12) / 0.74;
    const e = ease(u);
    const peak = Math.min(170, 60 + Math.abs(b.x - a.x) * 0.12 + Math.abs(b.y - a.y) * 0.05);
    const y = lerp(a.y, b.y, e) - 4 * peak * u * (1 - u);
    const dir = Math.sign(b.x - a.x) || 1;
    return { ...base, fx: lerp(a.x, b.x, e), fy: y, s: lerp(a.s, b.s, e), sx: 0.96, sy: 1.06, rot: dir * 8 * Math.sin(u * Math.PI), phase: "arco" };
  }
  if (t < 0.93) {
    const k = Math.sin(((t - 0.86) / 0.07) * Math.PI * 0.5);
    return { ...base, fx: b.x, fy: b.y, s: b.s, sx: 1 + 0.1 * k, sy: 1 - 0.12 * k, rot: 0, phase: "atterraggio" };
  }
  const k = 1 - (t - 0.93) / 0.07;
  return { ...base, fx: b.x, fy: b.y, s: b.s, sx: 1 + 0.1 * k * k, sy: 1 - 0.12 * k * k, rot: 0, phase: "assestamento" };
}

const rest = (p: Rect, phase = "sosta"): Pose => ({ ...foot(p), fx: foot(p).x, fy: foot(p).y, s: 1, sx: 1, sy: 1, rot: 0, opacity: 1, clip: null, front: true, phase });

/** Pose per la regia «cappello»: prima delle soste, uscita dal cappello del logo grande. */
export function computePose(opts: {
  scroll: number; stops: Stop[]; dwell: number; figW: number; figH: number;
  regia: "cappello" | "semplice"; logo: Rect | null;
  /** Tratto in cui la hero resta ferma (sticky) mentre Pupillo esce dal cappello. */
  pin?: { start: number; length: number };
}): { pose: Pose; bubbles: Bubbles } {
  const { scroll, stops, dwell, figW, figH, regia, pin } = opts;
  const shift = pin ? clamp(scroll - pin.start, 0, pin.length) : 0;
  const logo = opts.logo ? { ...opts.logo, y: opts.logo.y + shift } : null;
  const bubbles: Bubbles = {};
  for (const st of stops) {
    const d = Math.abs(scroll - st.scroll);
    bubbles[st.id] = clamp((dwell - d) / 30);
  }
  const first = stops[0];
  if (!first) return { pose: { fx: 0, fy: 0, s: 1, sx: 1, sy: 1, rot: 0, opacity: 0, clip: null, front: true, phase: "nessuna" }, bubbles };

  if (scroll < first.scroll - dwell) {
    if (regia === "cappello" && logo) {
      const h = hatGeometry(logo);
      const sHat = (h.width * 0.62) / figW;
      const wf = figW * sHat, hf = figH * sHat;
      const end = Math.max(1, first.scroll - dwell);
      const hatEnd = pin ? Math.min(end - 120, pin.start + pin.length) : end * 0.64;
      // Fasi nel cappello su [0, hatEnd] (0–0,64), salto su [hatEnd, end] (0,64–1).
      const p = scroll <= hatEnd ? 0.64 * clamp(scroll / Math.max(1, hatEnd)) : 0.64 + 0.36 * seg(scroll, hatEnd, end);
      const inHat = { x: h.centerX, y: h.bandBottom + hf * 0.98 };
      const onTop = { x: h.centerX, y: h.top + hf * 0.04 };
      const edge = { x: h.grip.x - wf * 0.35, y: h.top + (h.grip.y - h.top) * 0.35 };
      // Mano sul punto di presa: piedi = presa − scala × (mano − piedi locali).
      const hang = { x: h.grip.x - sHat * (MASCOT.hand.x / MASCOT.w * figW - figW / 2), y: h.grip.y - sHat * (MASCOT.hand.y / MASCOT.h * figH - figH) };
      const clipBox = { bottom: h.bandBottom, left: h.left, right: h.right };
      const base = { s: sHat, sx: 1, sy: 1, rot: 0, opacity: 1, clip: null as Pose["clip"], front: true };
      if (p < 0.22) {
        const e = ease(seg(p, 0, 0.22));
        return { pose: { ...base, fx: inHat.x, fy: lerp(inHat.y, onTop.y, e), clip: clipBox, front: false, sy: 1 + 0.05 * Math.sin(e * Math.PI), phase: "emersione" }, bubbles };
      }
      if (p < 0.3) return { pose: { ...base, fx: onTop.x, fy: onTop.y, phase: "sul cappello" }, bubbles };
      if (p < 0.42) {
        const e = ease(seg(p, 0.3, 0.42));
        return { pose: { ...base, fx: lerp(onTop.x, edge.x, e), fy: lerp(onTop.y, edge.y, e) - 10 * Math.sin(e * Math.PI), phase: "verso il bordo" }, bubbles };
      }
      if (p < 0.5) {
        const e = ease(seg(p, 0.42, 0.5));
        return { pose: { ...base, fx: lerp(edge.x, hang.x, e), fy: lerp(edge.y, hang.y, e), rot: -6 * e, phase: "presa" }, bubbles };
      }
      if (p < 0.6) {
        const u = seg(p, 0.5, 0.6);
        return { pose: { ...base, fx: hang.x, fy: hang.y + 4 * Math.sin(u * Math.PI), sy: 1 + 0.07 * Math.sin(u * Math.PI), rot: -6 + 9 * Math.sin(u * Math.PI * 1.5), phase: "appeso" }, bubbles };
      }
      if (p < 0.64) {
        const u = seg(p, 0.6, 0.64);
        return { pose: { ...base, fx: hang.x, fy: hang.y + 14 * u, rot: -2 * (1 - u), phase: "lascia la presa" }, bubbles };
      }
      const f = foot(first.perch);
      const pose = jump({ x: hang.x, y: hang.y + 14, s: sHat }, { x: f.x, y: f.y, s: 1 }, seg(p, 0.64, 1));
      return { pose, bubbles };
    }
    return { pose: rest(first.perch), bubbles };
  }

  for (let i = 0; i < stops.length; i++) {
    const st = stops[i]!;
    const next = stops[i + 1];
    if (!next || scroll <= st.scroll + dwell) return { pose: rest(st.perch), bubbles };
    if (scroll < next.scroll - dwell) {
      const a = foot(st.perch), b = foot(next.perch);
      const t = seg(scroll, st.scroll + dwell, next.scroll - dwell);
      return { pose: jump({ ...a, s: 1 }, { ...b, s: 1 }, t), bubbles };
    }
  }
  return { pose: rest(stops[stops.length - 1]!.perch), bubbles };
}

/** Scroll di sosta: centro dell'appoggio a metà schermo, monotono e limitato. */
export function stopScrolls(perches: { id: string; perch: Rect }[], vh: number, maxScroll: number, dwell: number, minFirst: number): Stop[] {
  const out: Stop[] = [];
  let prev = -Infinity;
  for (const p of perches) {
    let s = clamp(p.perch.y + p.perch.h / 2 - vh * 0.55, 0, maxScroll);
    if (out.length === 0) s = Math.max(s, minFirst);
    s = Math.max(s, prev + dwell * 2 + 120);
    out.push({ id: p.id, perch: p.perch, scroll: s });
    prev = s;
  }
  return out;
}
