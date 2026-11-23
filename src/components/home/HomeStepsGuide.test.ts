import { describe, expect, it } from "vitest";
import { guidePose } from "./HomeStepsGuide";
const stops = [100, 400, 700];
describe("guidePose", () => {
  it("sosta nella fascia di ogni fumetto", () => {
    expect(guidePose(130, stops, 50)).toMatchObject({ y: 100, stop: 0, tilt: 0 });
    expect(guidePose(380, stops, 50)).toMatchObject({ y: 400, stop: 1 });
    expect(guidePose(720, stops, 50)).toMatchObject({ y: 700, stop: 2 });
  });
  it("trasferimento senza fumetto, reversibile e limitato alla sezione", () => {
    const mid = guidePose(250, stops, 50);
    expect(mid.stop).toBe(-1);
    expect(mid.y).toBeCloseTo(250);
    expect(guidePose(5000, stops, 50).y).toBe(700);
    expect(guidePose(-5000, stops, 50).y).toBe(100);
  });
});
