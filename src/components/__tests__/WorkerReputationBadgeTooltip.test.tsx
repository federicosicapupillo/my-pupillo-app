import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReputationBadgeTooltipContent } from "../WorkerReputationBadge";
import { summarizeReputation, type WorkerReputationInput } from "@/lib/reputation";

function tip(profile: WorkerReputationInput) {
  return renderToStaticMarkup(
    <ReputationBadgeTooltipContent s={summarizeReputation(profile)} />,
  );
}

describe("Reputation tooltip content", () => {
  it("always shows the title and level scale", () => {
    const html = tip({ reputation_level: "basic", completed_shifts: 5, reputation_score: 60 });
    expect(html).toContain("Reputation Score");
    expect(html).toContain("Nuovo → Nuovo verificato → Basic → Pro → Elite");
  });

  it("shows '0 a 100' explanation when score is visible", () => {
    const html = tip({ reputation_level: "basic", completed_shifts: 5, reputation_score: 60 });
    expect(html).toContain("Punteggio da 0 a 100");
  });

  it("shows 'in costruzione' + threshold for new/new_verified", () => {
    const newHtml = tip({ reputation_level: "new", completed_shifts: 0 });
    expect(newHtml).toContain("3 servizi completati");
    expect(newHtml).toContain("in costruzione");

    const verifiedHtml = tip({
      reputation_level: "new_verified",
      completed_shifts: 1,
      reputation_score: 25,
    });
    expect(verifiedHtml).toContain("3 servizi completati");
    expect(verifiedHtml).toContain("in costruzione");
    // does not show 0-100 range for new profiles
    expect(verifiedHtml).not.toContain("Punteggio da 0 a 100");
  });

  it("always labels shift and review counts", () => {
    const html = tip({
      reputation_level: "pro",
      completed_shifts: 12,
      reviews_count: 7,
      reputation_score: 82,
    });
    expect(html).toContain("Servizi completati");
    expect(html).toContain(">12<");
    expect(html).toContain("Recensioni");
    expect(html).toContain(">7<");
  });

  it("shows numeric average rating only with >= 3 reviews", () => {
    const enough = tip({
      reputation_level: "pro",
      completed_shifts: 10,
      rating_avg: 4.7,
      reviews_count: 5,
      reputation_score: 80,
    });
    expect(enough).toContain("Valutazione media");
    expect(enough).toContain("4.7/5");

    const few = tip({
      reputation_level: "basic",
      completed_shifts: 5,
      rating_avg: 4.7,
      reviews_count: 2,
      reputation_score: 65,
    });
    expect(few).toContain("Valutazione media");
    expect(few).toContain("in costruzione");
    expect(few).not.toContain("4.7/5");
  });

  it("shows 'non disponibile' when there are zero reviews", () => {
    const html = tip({
      reputation_level: "basic",
      completed_shifts: 5,
      reviews_count: 0,
      reputation_score: 55,
    });
    expect(html).toContain("Valutazione media");
    expect(html).toContain("non disponibile");
  });
});