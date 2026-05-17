import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkerReputationBadge } from "../WorkerReputationBadge";

function render(profile: Parameters<typeof WorkerReputationBadge>[0]["profile"]) {
  return renderToStaticMarkup(<WorkerReputationBadge profile={profile} />);
}

describe("WorkerReputationBadge — label & score visibility", () => {
  it("hides numeric score for 'new' level", () => {
    const html = render({
      reputation_level: "new",
      reputation_score: 25,
      completed_shifts: 0,
    });
    expect(html).toContain("Nuovo");
    expect(html).not.toContain("25/100");
    expect(html).not.toMatch(/>25</);
  });

  it("hides numeric score for 'new_verified' level even with shifts >= 3", () => {
    const html = render({
      reputation_level: "new_verified",
      reputation_score: 25,
      completed_shifts: 5,
    });
    expect(html).toContain("Nuovo verificato");
    expect(html).not.toContain("25/100");
    expect(html).not.toMatch(/>25</);
  });

  it("hides score when completed_shifts < 3", () => {
    const html = render({
      reputation_level: "basic",
      reputation_score: 70,
      completed_shifts: 2,
    });
    expect(html).not.toContain("70/100");
  });

  it("shows '<score>/100' for 'basic' with shifts >= 3", () => {
    const html = render({
      reputation_level: "basic",
      reputation_score: 65,
      completed_shifts: 4,
    });
    expect(html).toContain("Basic");
    expect(html).toContain("65/100");
  });

  it("shows rating only when reviews_count >= 3", () => {
    const few = render({
      reputation_level: "basic",
      reputation_score: 70,
      completed_shifts: 5,
      rating_avg: 4.6,
      reviews_count: 2,
    });
    expect(few).not.toContain("4.6");

    const enough = render({
      reputation_level: "pro",
      reputation_score: 85,
      completed_shifts: 10,
      rating_avg: 4.6,
      reviews_count: 8,
    });
    expect(enough).toContain("4.6");
    expect(enough).toContain("85/100");
  });

  it("never renders a bare numeric score without '/100'", () => {
    const html = render({
      reputation_level: "elite",
      reputation_score: 92,
      completed_shifts: 30,
    });
    // The only "92" present must be inside "92/100"
    const matches = html.match(/92/g) ?? [];
    const labeled = html.match(/92\/100/g) ?? [];
    expect(matches.length).toBe(labeled.length);
  });
});