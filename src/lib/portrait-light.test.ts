import { describe, expect, it } from "vitest";
import { applyPortraitLight, compositeOnPortraitBackground, maskCoverage, PORTRAIT_BG } from "./portrait-light";

const img = (n: number, rgb: [number, number, number]) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = rgb[0]; a[i * 4 + 1] = rgb[1]; a[i * 4 + 2] = rgb[2]; a[i * 4 + 3] = 255; }
  return a;
};

describe("sfondo albicocca", () => {
  it("dove non c'è la persona lo sfondo diventa esattamente #F4DDC8", () => {
    const px = img(4, [10, 200, 30]);
    compositeOnPortraitBackground(px, [0, 0, 0, 0]);
    expect([px[0], px[1], px[2]]).toEqual([PORTRAIT_BG.r, PORTRAIT_BG.g, PORTRAIT_BG.b]);
  });
  it("dove c'è la persona il pixel resta quello della persona", () => {
    const px = img(1, [120, 90, 70]);
    compositeOnPortraitBackground(px, [1]);
    expect([px[0], px[1], px[2]]).toEqual([120, 90, 70]);
  });
});

describe("Luce ritratto", () => {
  it("è delicata: nessun canale cambia più del 20% su un incarnato medio", () => {
    const px = img(100, [180, 130, 110]);
    applyPortraitLight(px, new Array(100).fill(1));
    expect(Math.abs(px[0]! - 180)).toBeLessThanOrEqual(36);
    expect(Math.abs(px[1]! - 130)).toBeLessThanOrEqual(26);
    expect(Math.abs(px[2]! - 110)).toBeLessThanOrEqual(22);
  });
  it("schiarisce una foto scura ma con limite", () => {
    const px = img(100, [60, 60, 60]);
    applyPortraitLight(px, new Array(100).fill(1));
    expect(px[0]!).toBeGreaterThan(60);
    expect(px[0]!).toBeLessThan(90);
  });
  it("non tocca i pixel di sfondo", () => {
    const px = img(2, [60, 60, 60]);
    applyPortraitLight(px, [1, 0]);
    expect([px[4], px[5], px[6]]).toEqual([60, 60, 60]);
  });
  it("copertura maschera", () => { expect(maskCoverage([1, 0, 0.6, 0.2])).toBe(0.5); });
});
