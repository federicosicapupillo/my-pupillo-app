import { describe, it, expect } from "vitest";
import { scoreCurriculum, canPublishCurriculum } from "./curriculum-assessment";

const weak = { experience: 5, skills: 5, responsibility: 2, training: 0, clarity: 3 };
const good = { experience: 25, skills: 22, responsibility: 15, training: 5, clarity: 8 };
const exp2 = { work_experiences: 2, managed_business_or_team: false };
const none = { work_experiences: 0, managed_business_or_team: false };

describe("curriculum: sempre 4 o 5 stelle", () => {
  it("curriculum scarso con due esperienze: 4 stelle", () => {
    expect(scoreCurriculum(weak, true, false, "4", exp2).stars).toBe(4);
  });
  it("curriculum non leggibile: comunque 4 stelle", () => {
    expect(scoreCurriculum(weak, false, true, "4", none).stars).toBe(4);
  });
  it("curriculum buono (≥70) con due esperienze: 5 stelle", () => {
    expect(scoreCurriculum(good, true, false, "4", exp2).stars).toBe(5);
  });
  it("curriculum buono senza esperienze: 4 stelle", () => {
    expect(scoreCurriculum(good, true, false, "4", none).stars).toBe(4);
  });
  it("un curriculum scarso è pubblicato con 4 stelle", () => {
    const r = scoreCurriculum(weak, false, false, "4", none);
    expect(canPublishCurriculum({ status: "approved", consent_at: "x", evaluable: false, doubts: false, ...r, scores: { ...weak, ...none }, rubric_version: "4" }, true)).toBe(true);
  });
});
