import { describe, it, expect } from "vitest";
import {
  computeOverallRating,
  celebrationTier,
  computeWorkerBadges,
} from "@/lib/reviews";

describe("computeOverallRating", () => {
  it("media dei 5 parametri con 1 decimale", () => {
    expect(
      computeOverallRating({
        punctuality: 5,
        professionalism: 4,
        competence: 5,
        reliability: 5,
        teamwork: 4,
      }),
    ).toBe(4.6);
  });

  it("ignora parametri non valorizzati", () => {
    expect(computeOverallRating({ punctuality: 5, teamwork: 3 })).toBe(4);
  });

  it("torna null se nessun parametro è valido", () => {
    expect(computeOverallRating({})).toBeNull();
    expect(computeOverallRating({ punctuality: 0 })).toBeNull();
    expect(computeOverallRating({ punctuality: 6 } as any)).toBeNull();
  });

  it("tutti 5 -> 5.0", () => {
    expect(
      computeOverallRating({
        punctuality: 5,
        professionalism: 5,
        competence: 5,
        reliability: 5,
        teamwork: 5,
      }),
    ).toBe(5);
  });
});

describe("celebrationTier", () => {
  it("classifica le soglie", () => {
    expect(celebrationTier(5)).toBe("excellent");
    expect(celebrationTier(4.5)).toBe("excellent");
    expect(celebrationTier(4.4)).toBe("good");
    expect(celebrationTier(4.0)).toBe("good");
    expect(celebrationTier(3.9)).toBe("neutral");
    expect(celebrationTier(3.0)).toBe("neutral");
    expect(celebrationTier(2.9)).toBe("constructive");
    expect(celebrationTier(1)).toBe("constructive");
  });
  it("null -> neutral", () => {
    expect(celebrationTier(null)).toBe("neutral");
  });
});

describe("computeWorkerBadges", () => {
  const base = {
    rating_avg: 0,
    reviews_count: 0,
    avg_punctuality: 0,
    avg_professionalism: 0,
    avg_competence: 0,
    avg_reliability: 0,
    avg_teamwork: 0,
  };

  it("nessun badge senza recensioni sufficienti", () => {
    expect(
      computeWorkerBadges({ ...base, reviews_count: 2, avg_punctuality: 5 }),
    ).toEqual([]);
  });

  it("Sempre puntuale: avg_punctuality > 4.7 con almeno 3 recensioni", () => {
    expect(
      computeWorkerBadges({ ...base, reviews_count: 3, avg_punctuality: 4.8 }),
    ).toContain("always_on_time");
    expect(
      computeWorkerBadges({ ...base, reviews_count: 3, avg_punctuality: 4.7 }),
    ).not.toContain("always_on_time");
  });

  it("Affidabile e Top Team Player rispettano le soglie", () => {
    const badges = computeWorkerBadges({
      ...base,
      reviews_count: 5,
      avg_reliability: 4.8,
      avg_teamwork: 4.9,
    });
    expect(badges).toEqual(expect.arrayContaining(["reliable", "team_player"]));
  });

  it("Professionista verificato richiede ≥10 recensioni e media > 4.5", () => {
    expect(
      computeWorkerBadges({ ...base, reviews_count: 10, rating_avg: 4.6 }),
    ).toContain("verified_pro");
    expect(
      computeWorkerBadges({ ...base, reviews_count: 9, rating_avg: 4.9 }),
    ).not.toContain("verified_pro");
    expect(
      computeWorkerBadges({ ...base, reviews_count: 20, rating_avg: 4.5 }),
    ).not.toContain("verified_pro");
  });
});