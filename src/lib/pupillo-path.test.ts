import { describe, expect, it } from "vitest";
import { computePose, stopScrolls, hatGeometry, localToDoc, transfer, findLane, silhouetteBox, MASCOT } from "./pupillo-path";

const logo = { x: 448, y: 60, w: 384, h: 239 };
const figW = 112, figH = 112 * (MASCOT.h / MASCOT.w);
const perches = [
  { id: "a", perch: { x: 100, y: 1400, w: figW, h: figH } },
  { id: "b", perch: { x: 900, y: 2400, w: figW, h: figH } },
];
const pin = { start: 40, length: 520 };
const { stops } = stopScrolls(perches, 900, 5000, 140, pin.start + pin.length + 140 + 520);
const lanes = [1190, 1190];
const at = (scroll: number, regia: "cappello" | "semplice" = "cappello") =>
  computePose({ scroll, stops, dwell: 140, figW, figH, regia, logo, lanes, pin });
const hand = (s: number) => { const { pose } = at(s); return localToDoc(pose, figW, figH, (MASCOT.hand.x / MASCOT.w) * figW, (MASCOT.hand.y / MASCOT.h) * figH); };

describe("regia Pupillo", () => {
  it("stesso punto di scroll dà la stessa posa, avanti e indietro", () => {
    const pts = [0, 200, 500, 700, 1300, 2000];
    expect(pts.map((s) => at(s))).toEqual([...pts].reverse().map((s) => at(s)).reverse());
  });

  it("parte nascosta dietro il cappello decentrato", () => {
    const { pose } = at(0);
    expect(pose.phase).toBe("emersione");
    expect(pose.front).toBe(false);
    expect(pose.fx).toBeGreaterThan(logo.x + logo.w / 2 + 40);
  });

  it("in ogni frame della presa la mano trasformata coincide con il grip (logo che segue la hero sticky)", () => {
    let n = 0;
    for (let s = 0; s <= 560; s += 1) {
      const { pose } = at(s);
      if (pose.phase !== "appeso") continue;
      n++;
      const g = hatGeometry({ ...logo, y: logo.y + Math.min(Math.max(s - pin.start, 0), pin.length) }).grip;
      const h = hand(s);
      expect(Math.hypot(h.x - g.x, h.y - g.y)).toBeLessThan(0.01);
    }
    expect(n).toBeGreaterThan(50);
  });

  it("nessun salto di posizione, scala o rotazione ai confini di fase (passo 1px)", () => {
    for (const regia of ["cappello", "semplice"] as const) {
      let prev = at(0, regia).pose, prevStep = 0;
      for (let s = 1; s <= stops[1]!.scroll + 200; s++) {
        const { pose } = at(s, regia);
        if (pose.opacity > 0 && prev.opacity > 0) {
          expect(Math.abs(pose.rot - prev.rot)).toBeLessThan(0.6);
          expect(Math.abs(pose.sx - prev.sx)).toBeLessThan(0.03);
          expect(Math.abs(pose.sy - prev.sy)).toBeLessThan(0.03);
          expect(Math.abs(pose.s - prev.s)).toBeLessThan(0.03);
          // Velocità continua: nessun passo improvviso rispetto al precedente.
          const step = Math.hypot(pose.fx - prev.fx, pose.fy - prev.fy);
          expect(step).toBeLessThan(prevStep * 1.5 + 1.5);
          prevStep = step;
        }
        prev = pose;
      }
    }
  });

  it("il trasferimento passa nella corsia libera, non sulle card", () => {
    const a = { x: 156, y: 1500, s: 1 }, b = { x: 956, y: 2500, s: 1 };
    const cards = [{ x: 190, y: 1560, w: 440, h: 769 }, { x: 650, y: 1560, w: 440, h: 769 }];
    for (const regia of ["cappello", "semplice"] as const)
      for (let t = 0; t <= 1; t += 0.002) {
        const box = silhouetteBox(transfer(a, b, 1190, t, regia), figW, figH);
        for (const c of cards) expect(box.x + box.w <= c.x || box.x >= c.x + c.w || box.y + box.h <= c.y || box.y >= c.y + c.h).toBe(true);
      }
  });

  it("findLane usa lo spazio reale libero o segnala che non c'è", () => {
    const obs = [{ x: 190, y: 0, w: 900, h: 100 }];
    expect(findLane(obs, 0, 100, 150, 1280, "right")).toBe(1185);
    expect(findLane([{ x: 16, y: 0, w: 358, h: 100 }], 0, 100, 150, 390, "right")).toBeNull();
  });

  it("la regia semplice scende senza preparazione, arco né atterraggio", () => {
    const phases = new Set<string>();
    for (let t = 0; t <= 1; t += 0.01) phases.add(transfer({ x: 0, y: 0, s: 1 }, { x: 0, y: 900, s: 1 }, 0, t, "semplice").phase);
    expect([...phases].sort()).toEqual(["assestamento", "discesa"]);
    const mid = transfer({ x: 0, y: 0, s: 1 }, { x: 0, y: 900, s: 1 }, 0, 0.4, "semplice");
    expect(mid.sx).toBe(1);
    expect(mid.sy).toBe(1);
  });

  it("fine pagina: ogni sosta è raggiungibile, distanziata e con l'appoggio a metà schermo", () => {
    const r = stopScrolls([
      { id: "x", perch: { x: 0, y: 1800, w: 112, h: 138 } },
      { id: "y", perch: { x: 0, y: 1850, w: 112, h: 138 } },
    ], 900, 1200, 128, 0);
    const shift = r.pads.reduce((a, b) => a + b, 0);
    const reach = 1200 + shift + r.extra;
    expect(r.stops[1]!.scroll - r.stops[0]!.scroll).toBeGreaterThanOrEqual(128 * 2 + 120);
    for (const s of r.stops) {
      expect(s.scroll).toBeLessThanOrEqual(reach);
      expect(s.perch.y + s.perch.h / 2 - s.scroll).toBeCloseTo(900 * 0.55, 0);
    }
  });

  it("il fumetto si vede solo durante la sosta", () => {
    expect(at(stops[0]!.scroll).bubbles["a"]).toBe(1);
    expect(at(stops[0]!.scroll + 400).bubbles["a"]).toBe(0);
  });
});
