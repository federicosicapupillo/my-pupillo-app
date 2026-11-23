/**
 * Regia 2.5D di Pupillo (fase A: una sola posa della tavola approvata, nessun rig).
 * La posa è una funzione pura della posizione di scroll: stesso punto, stesso stato,
 * in avanti e all'indietro. Tutti i parametri sono continui ai confini di fase.
 */

/** Misure in pixel sull'immagine autentica del logo (1041×649), lette dalla maschera del cappello. */
export const LOGO_SIZE = { w: 1041, h: 649 } as const;
export const HAT = {
  /** Ritaglio usato come occlusore (pupillo-logo-cappello.webp). */
  crop: { x: 555, y: 15, w: 276, h: 191 },
  top: 30,
  bandBottom: 185,
  /** Centro della fascia: il cappello è decentrato a destra nel logo. */
  bandCenterX: 687,
  left: 562,
  right: 823,
  /** Punto di presa sul bordo destro dello sbuffo. */
  grip: { x: 823, y: 118 },
} as const;

/**
 * Posa «mano alzata» (in basso a sinistra nella tavola approvata), ritagliata a 474×622.
 * hand = pugno alzato (punto di presa), mouth = centro della bocca: misurati sul file.
 */
export const MASCOT = { w: 474, h: 622, hand: { x: 48, y: 150 }, mouth: { x: 244, y: 272 } } as const;

export type Rect = { x: number; y: number; w: number; h: number };
export type Stop = { id: string; perch: Rect; scroll: number };
export type Pose = {
  /** Punto dei piedi (centro in basso, pivot della trasformazione) in coordinate documento. */
  fx: number; fy: number;
  s: number; sx: number; sy: number; rot: number;
  opacity: number;
  clip: { bottom: number; left: number; right: number } | null;
  front: boolean;
  phase: string;
};
export type Bubbles = Record<string, number>;
type P = { x: number; y: number; s: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smoothstep: valore e derivata continui ai capi. */
const sm = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const base = { opacity: 1, clip: null, front: true } as const;

/** Punto locale della figura (px nel riquadro figW×figH) → coordinate documento, con scala e rotazione attorno al pivot. */
export function localToDoc(pose: Pose, figW: number, figH: number, lx: number, ly: number) {
  const sx = pose.s * pose.sx, sy = pose.s * pose.sy, r = (pose.rot * Math.PI) / 180;
  const dx = (lx - figW / 2) * sx, dy = (ly - figH) * sy;
  return { x: pose.fx + dx * Math.cos(r) - dy * Math.sin(r), y: pose.fy + dx * Math.sin(r) + dy * Math.cos(r) };
}
/** Riquadro che contiene l'intera silhouette trasformata. */
export function silhouetteBox(pose: Pose, figW: number, figH: number): Rect {
  const c = [[0, 0], [figW, 0], [0, figH], [figW, figH]].map(([x, y]) => localToDoc(pose, figW, figH, x!, y!));
  const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Pivot tale che la mano trasformata cada esattamente sul punto di presa. */
function pinHand(grip: { x: number; y: number }, s: number, sx: number, sy: number, rot: number, figW: number, figH: number) {
  const probe: Pose = { fx: 0, fy: 0, s, sx, sy, rot, ...base, phase: "" };
  const h = localToDoc(probe, figW, figH, (MASCOT.hand.x / MASCOT.w) * figW, (MASCOT.hand.y / MASCOT.h) * figH);
  return { x: grip.x - h.x, y: grip.y - h.y };
}

export function hatGeometry(logo: Rect) {
  const X = (px: number) => logo.x + (px / LOGO_SIZE.w) * logo.w;
  const Y = (py: number) => logo.y + (py / LOGO_SIZE.h) * logo.h;
  return {
    top: Y(HAT.top), bandBottom: Y(HAT.bandBottom), centerX: X(HAT.bandCenterX),
    left: X(HAT.left), right: X(HAT.right), grip: { x: X(HAT.grip.x), y: Y(HAT.grip.y) },
    width: X(HAT.right) - X(HAT.left),
  };
}
const hatScale = (logo: Rect, figW: number) => (hatGeometry(logo).width * 0.62) / figW;

/** Punto in cui Pupillo lascia la presa (logo nella posizione finale della hero). */
export function hatRelease(logo: Rect, figW: number, figH: number): P {
  const s = hatScale(logo, figW);
  const f = pinHand(hatGeometry(logo).grip, s, 1, 1, -6, figW, figH);
  return { x: f.x, y: f.y + 14, s };
}

function foot(p: Rect) { return { x: p.x + p.w / 2, y: p.y + p.h }; }
const rest = (p: Rect, phase = "sosta"): Pose => ({ ...base, fx: foot(p).x, fy: foot(p).y, s: 1, sx: 1, sy: 1, rot: 0, phase });

/** Curva di schiacciamento (+) / allungamento (−) a tratti smoothstep: continua, nulla ai capi. */
function squash(t: number, takeoff: boolean) {
  const keys: [number, number][] = takeoff
    ? [[0, 0], [0.18, 1], [0.3, -0.8], [0.82, 0], [0.9, 1], [1, 0]]
    : [[0, 0], [0.3, -0.8], [0.82, 0], [0.9, 1], [1, 0]];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1]!, [t1, v1] = keys[i]!;
    if (t <= t1) return lerp(v0, v1, sm((t - t0) / (t1 - t0)));
  }
  return 0;
}

/** Salto: preparazione, arco, atterraggio, assestamento. Continuo in t e nullo ai capi (q=0, rot=0). */
export function hop(a: P, b: P, t: number, peak: number, takeoff = true, tilt = 7): Pose {
  const T0 = takeoff ? 0.18 : 0, T1 = 0.82;
  const u = seg(t, T0, T1), e = sm(u);
  const q = squash(clamp(t), takeoff);
  const dir = Math.sign(b.x - a.x) || 1;
  const phase = t < T0 ? "preparazione" : t < T1 ? "arco" : t < 0.9 ? "atterraggio" : "assestamento";
  return { ...base, fx: lerp(a.x, b.x, e), fy: lerp(a.y, b.y, e) - peak * Math.sin(Math.PI * u) ** 2, s: lerp(a.s, b.s, e),
    sx: 1 + 0.08 * q, sy: 1 - 0.1 * q, rot: dir * tilt * Math.sin(Math.PI * u) ** 2, phase };
}

/** Discesa morbida (regia semplice): nessuna preparazione né arco, solo leggera inclinazione. */
function glide(a: P, b: P, t: number): Pose {
  const e = sm(t);
  const dir = Math.sign(b.x - a.x);
  return { ...base, fx: lerp(a.x, b.x, e), fy: lerp(a.y, b.y, e), s: lerp(a.s, b.s, e), sx: 1, sy: 1, rot: dir * 3 * Math.sin(Math.PI * t) ** 2, phase: "discesa" };
}

/** Trasferimento da a a b: lungo la corsia libera laneX, oppure dissolvenza se nessuna corsia è libera. */
export function transfer(a: P, b: P, laneX: number | null, t: number, style: "cappello" | "semplice", takeoff = true): Pose {
  t = clamp(t);
  if (laneX === null) {
    if (t < 0.35) { const k = sm(t / 0.35); return { ...base, fx: a.x, fy: a.y, s: a.s * (1 - 0.15 * k), sx: 1, sy: 1, rot: 0, opacity: 1 - k, phase: "dissolvenza" }; }
    if (t < 0.65) return { ...base, fx: b.x, fy: b.y, s: b.s * 0.85, sx: 1, sy: 1, rot: 0, opacity: 0, phase: "dissolvenza" };
    const k = sm((t - 0.65) / 0.35);
    return { ...base, fx: b.x, fy: b.y, s: b.s * (0.85 + 0.15 * k), sx: 1, sy: 1, rot: 0, opacity: k, phase: "ricomparsa" };
  }
  const pts: P[] = [a];
  if (Math.abs(a.x - laneX) > 4) pts.push({ x: laneX, y: a.y, s: b.s });
  const dy = b.y - a.y;
  const n = style === "cappello" ? Math.max(1, Math.ceil(Math.abs(dy) / 420)) : 1;
  for (let k = 1; k <= n; k++) pts.push({ x: laneX, y: a.y + (dy * k) / n, s: b.s });
  if (Math.abs(b.x - laneX) > 4) pts.push(b); else pts[pts.length - 1] = b;
  const moveEnd = style === "semplice" ? 0.88 : 1;
  if (style === "semplice" && t >= moveEnd) {
    const q = 0.6 * Math.sin(Math.PI * seg(t, moveEnd, 1));
    return { ...base, fx: b.x, fy: b.y, s: b.s, sx: 1 + 0.05 * q, sy: 1 - 0.06 * q, rot: 0, phase: "assestamento" };
  }
  const w = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y) + (style === "cappello" ? 60 : 0));
  const total = w.reduce((x, y) => x + y, 0) || 1;
  let acc = 0;
  const tt = (t / moveEnd) * total;
  for (let i = 0; i < w.length; i++) {
    const p0 = pts[i]!, p1 = pts[i + 1]!;
    if (tt <= acc + w[i]! || i === w.length - 1) {
      const lt = clamp((tt - acc) / (w[i]! || 1));
      if (style === "semplice") return glide(p0, p1, lt);
      const horizontal = Math.abs(p1.y - p0.y) < 1;
      return hop(p0, p1, lt, horizontal ? 8 : 36, i === 0 ? takeoff : true, horizontal ? 3 : 7);
    }
    acc += w[i]!;
  }
  return rest({ x: b.x, y: b.y, w: 0, h: 0 });
}

/**
 * Corsia verticale libera: intervallo x senza ostacoli nel tratto [yTop, yBottom], largo almeno need.
 * Restituisce il centro della corsia (preferendo il lato indicato) oppure null.
 */
export function findLane(obstacles: Rect[], yTop: number, yBottom: number, need: number, docW: number, prefer: "left" | "right"): number | null {
  const hit = obstacles.filter((o) => o.y < yBottom && o.y + o.h > yTop);
  const left = Math.min(docW, ...hit.map((o) => o.x));
  const right = Math.max(0, ...hit.map((o) => o.x + o.w));
  const L = left >= need ? left / 2 : null;
  const R = docW - right >= need ? (right + docW) / 2 : null;
  return prefer === "left" ? (L ?? R) : (R ?? L);
}

export function computePose(opts: {
  scroll: number; stops: Stop[]; dwell: number; figW: number; figH: number;
  regia: "cappello" | "semplice"; logo: Rect | null;
  /** lanes[i] = corsia del trasferimento verso lo stop i (lanes[0]: dal cappello). */
  lanes?: (number | null)[];
  pin?: { start: number; length: number };
}): { pose: Pose; bubbles: Bubbles } {
  const { scroll, stops, dwell, figW, figH, regia, pin } = opts;
  const lanes = opts.lanes ?? [];
  const shift = pin ? clamp(scroll - pin.start, 0, pin.length) : 0;
  const logo = opts.logo ? { ...opts.logo, y: opts.logo.y + shift } : null;
  const bubbles: Bubbles = {};
  for (const st of stops) bubbles[st.id] = clamp((dwell - Math.abs(scroll - st.scroll)) / 30);
  const first = stops[0];
  if (!first) return { pose: { ...base, fx: 0, fy: 0, s: 1, sx: 1, sy: 1, rot: 0, opacity: 0, phase: "nessuna" }, bubbles };

  if (scroll < first.scroll - dwell) {
    if (regia === "cappello" && logo) {
      const h = hatGeometry(logo);
      const s = hatScale(logo, figW);
      const hf = figH * s, wf = figW * s;
      const end = Math.max(1, first.scroll - dwell);
      const hatEnd = pin ? Math.min(end - 120, pin.start + pin.length) : end * 0.6;
      const b = { ...base, s, sx: 1, sy: 1, rot: 0 };
      if (scroll < hatEnd) {
        const p = clamp(scroll / Math.max(1, hatEnd));
        const inHat = { x: h.centerX, y: h.bandBottom + hf * 0.98 };
        const onTop = { x: h.centerX, y: h.top + 2 };
        const edge = { x: h.grip.x - wf * 0.3, y: onTop.y };
        let pose: Pose;
        if (p < 0.3) {
          const e = sm(p / 0.3);
          pose = { ...b, fx: inHat.x, fy: lerp(inHat.y, onTop.y, e), sy: 1 + 0.05 * Math.sin(Math.PI * e),
            clip: { bottom: h.bandBottom, left: h.left, right: h.right }, front: false, phase: "emersione" };
        } else if (p < 0.4) pose = { ...b, fx: onTop.x, fy: onTop.y, phase: "sul cappello" };
        else if (p < 0.55) {
          const e = sm(seg(p, 0.4, 0.55));
          pose = { ...b, fx: lerp(onTop.x, edge.x, e), fy: onTop.y - 10 * Math.sin(Math.PI * e), phase: "verso il bordo" };
        } else if (p < 0.68) {
          // Allunga la mano verso il bordo: alla fine della fase la mano è sul punto di presa.
          const e = sm(seg(p, 0.55, 0.68)), rot = -6 * e;
          const f = pinHand(h.grip, s, 1, 1, rot, figW, figH);
          pose = { ...b, fx: lerp(edge.x, f.x, e), fy: lerp(edge.y, f.y, e), rot, phase: "presa" };
        } else if (p < 0.88) {
          // Appeso: rotazione e allungamento variano, il pivot compensa → mano ferma sul grip.
          const u = seg(p, 0.68, 0.88), w = Math.sin(Math.PI * u) ** 2; // derivata nulla ai capi
          const rot = -6 - 5 * w, sy = 1 + 0.07 * w;
          const f = pinHand(h.grip, s, 1, sy, rot, figW, figH);
          pose = { ...b, fx: f.x, fy: f.y, sy, rot, phase: "appeso" };
        } else {
          const e = sm(seg(p, 0.88, 1));
          const f = pinHand(h.grip, s, 1, 1, -6, figW, figH);
          pose = { ...b, fx: f.x, fy: f.y + 14 * e, rot: -6 * (1 - e), phase: "lascia la presa" };
        }
        return { pose, bubbles };
      }
      const f0 = pinHand(h.grip, s, 1, 1, -6, figW, figH);
      const pose = transfer({ x: f0.x, y: f0.y + 14, s }, { ...foot(first.perch), s: 1 }, lanes[0] ?? null, seg(scroll, hatEnd, end), "cappello", false);
      return { pose, bubbles };
    }
    return { pose: rest(first.perch), bubbles };
  }

  for (let i = 0; i < stops.length; i++) {
    const st = stops[i]!;
    const next = stops[i + 1];
    if (!next || scroll <= st.scroll + dwell) return { pose: rest(st.perch), bubbles };
    if (scroll < next.scroll - dwell) {
      const t = seg(scroll, st.scroll + dwell, next.scroll - dwell);
      return { pose: transfer({ ...foot(st.perch), s: 1 }, { ...foot(next.perch), s: 1 }, lanes[i + 1] ?? null, t, regia), bubbles };
    }
  }
  return { pose: rest(stops[stops.length - 1]!.perch), bubbles };
}

/**
 * Scroll di sosta con l'appoggio a 0,55 dello schermo. Se due soste sono troppo vicine
 * restituisce lo spazio reale da aggiungere prima della sosta (pads) invece di spingerla
 * fuori vista, e lo spazio finale (extra) necessario perché l'ultima sia raggiungibile.
 * perches: rettangoli nel layout SENZA pads/extra.
 */
export function stopScrolls(perches: { id: string; perch: Rect }[], vh: number, maxScroll: number, dwell: number, minFirst: number): { stops: Stop[]; pads: number[]; extra: number } {
  const gap = dwell * 2 + 120;
  const stops: Stop[] = [], pads: number[] = [];
  let prev = -Infinity, shift = 0;
  for (const p of perches) {
    const desired = Math.max(0, p.perch.y + shift + p.perch.h / 2 - vh * 0.55);
    const min = stops.length === 0 ? minFirst : prev + gap;
    const pad = Math.max(0, Math.ceil(min - desired));
    shift += pad;
    const perch = { ...p.perch, y: p.perch.y + shift };
    const scroll = Math.max(desired + pad, 0);
    stops.push({ id: p.id, perch, scroll });
    pads.push(pad);
    prev = scroll;
  }
  const extra = Math.max(0, Math.ceil(prev - (maxScroll + shift)));
  return { stops, pads, extra };
}
