import { describe, it, expect } from "vitest";
import { summarizeReputation } from "../reputation";

describe("summarizeReputation — score visibility thresholds", () => {
  it("hides score for level 'new' even with shifts >= 3", () => {
    const s = summarizeReputation({
      reputation_level: "new",
      reputation_score: 25,
      completed_shifts: 5,
    });
    expect(s.showScore).toBe(false);
    expect(s.isNew).toBe(true);
  });

  it("hides score for level 'new_verified' even with shifts >= 3", () => {
    const s = summarizeReputation({
      reputation_level: "new_verified",
      reputation_score: 25,
      completed_shifts: 10,
    });
    expect(s.showScore).toBe(false);
    expect(s.levelLabel).toBe("Nuovo verificato");
  });

  it("hides score when completed_shifts < 3 regardless of level", () => {
    const s = summarizeReputation({
      reputation_level: "basic",
      reputation_score: 60,
      completed_shifts: 2,
    });
    expect(s.showScore).toBe(false);
    expect(s.isNew).toBe(true);
  });

  it("shows score for level 'basic' with shifts >= 3", () => {
    const s = summarizeReputation({
      reputation_level: "basic",
      reputation_score: 65,
      completed_shifts: 3,
    });
    expect(s.showScore).toBe(true);
    expect(s.score).toBe(65);
  });

  it("shows score for level 'pro' and 'elite'", () => {
    expect(
      summarizeReputation({
        reputation_level: "pro",
        reputation_score: 80,
        completed_shifts: 10,
      }).showScore,
    ).toBe(true);
    expect(
      summarizeReputation({
        reputation_level: "elite",
        reputation_score: 95,
        completed_shifts: 50,
      }).showScore,
    ).toBe(true);
  });

  it("clamps score to [0, 100]", () => {
    expect(
      summarizeReputation({
        reputation_level: "basic",
        reputation_score: 150,
        completed_shifts: 5,
      }).score,
    ).toBe(100);
    expect(
      summarizeReputation({
        reputation_level: "basic",
        reputation_score: -10,
        completed_shifts: 5,
      }).score,
    ).toBe(0);
  });

  it("falls back to 'new' level when value is unknown", () => {
    const s = summarizeReputation({
      reputation_level: "weird_unknown",
      reputation_score: 30,
      completed_shifts: 5,
    });
    expect(s.level).toBe("new");
    expect(s.showScore).toBe(false);
  });

  it("computes rehirePct only when there are answers", () => {
    expect(
      summarizeReputation({ rehire_yes_count: 4, rehire_total_answers: 5 }).rehirePct,
    ).toBe(80);
    expect(
      summarizeReputation({ rehire_yes_count: 0, rehire_total_answers: 0 }).rehirePct,
    ).toBeNull();
  });

  it("defaults numeric fields to 0 when null/undefined", () => {
    const s = summarizeReputation({});
    expect(s.score).toBe(0);
    expect(s.completedShifts).toBe(0);
    expect(s.reviewsCount).toBe(0);
    expect(s.rating).toBe(0);
    expect(s.noShow).toBe(0);
    expect(s.showScore).toBe(false);
    expect(s.level).toBe("new");
  });
});