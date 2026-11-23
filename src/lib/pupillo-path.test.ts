import { describe, expect, it } from "vitest";
import { computePose, stopScrolls, hatGeometry } from "./pupillo-path";

const logo = { x: 400, y: 60, w: 384, h: 239 };
const perches = [
  { id: "a", perch: { x: 100, y: 900, w: 112, h: 138 } },
  { id: "b", perch: { x: 900, y: 1800, w: 112, h: 138 } },
];
const stops = stopScrolls(perches, 900, 5000, 140, 520);
const at = (scroll: number) => computePose({ scroll, stops, dwell: 140, figW: 112, figH: 138, regia: "cappello", logo });

describe("regia Pupillo", () => {
  it("stesso punto di scroll dà la stessa posa, avanti e indietro", () => {
    const forward = [0, 200, 700, 1300].map((s) => at(s));
    const back = [1300, 700, 200, 0].map((s) => at(s)).reverse();
    expect(forward).toEqual(back);
  });
  it("all'inizio Pupillo è nascosto dietro il cappello decentrato", () => {
    const { pose } = at(0);
    expect(pose.phase).toBe("emersione");
    expect(pose.clip).not.toBeNull();
    expect(pose.front).toBe(false);
    expect(pose.fx).toBeGreaterThan(logo.x + logo.w / 2 + 40);
  });
  it("il fumetto si vede solo durante la sosta", () => {
    expect(at(stops[0]!.scroll).bubbles["a"]).toBe(1);
    expect(at(stops[0]!.scroll + 400).bubbles["a"]).toBe(0);
  });
  it("si appende con la mano sul punto di presa misurato", () => {
    const h = hatGeometry(logo);
    expect(h.grip.x).toBeCloseTo(400 + (823 / 1041) * 384, 3);
  });
});
