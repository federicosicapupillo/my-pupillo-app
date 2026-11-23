import { describe, expect, it } from "vitest";
import { evaluateFaceGuide } from "./face-guide";

// video 640x480 → guida larga 264px
describe("evaluateFaceGuide", () => {
  it("nessun volto", () => expect(evaluateFaceGuide([], 640, 480)).toBe("none"));
  it("più volti", () => expect(evaluateFaceGuide([{ x: 0, y: 0, width: 200, height: 200 }, { x: 300, y: 0, width: 200, height: 200 }], 640, 480)).toBe("many"));
  it("volto centrato e grande → verde", () => expect(evaluateFaceGuide([{ x: 220, y: 140, width: 200, height: 200 }], 640, 480)).toBe("ok"));
  it("volto troppo piccolo", () => expect(evaluateFaceGuide([{ x: 300, y: 220, width: 60, height: 60 }], 640, 480)).toBe("far"));
  it("volto spostato", () => expect(evaluateFaceGuide([{ x: 0, y: 140, width: 200, height: 200 }], 640, 480)).toBe("off-center"));
});
