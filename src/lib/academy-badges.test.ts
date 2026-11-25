import { describe, it, expect } from "vitest";
import { badgeFor, earnedBadges } from "./academy-badges";
const r = (module: string, title: string, award = "") => ({ module, title, award, passed_at: "2026-11-20T10:00:00Z", badge_url: "" });
describe("academy badges", () => {
  it("matches by award name", () => { expect(badgeFor(r("x", "Y", "Gagliardetto"))?.key).toBe("m2"); });
  it("matches by course title", () => { expect(badgeFor(r("x", "Mise en place"))?.key).toBe("m3"); });
  it("unknown course has no badge", () => { expect(badgeFor(r("zzz", "Corso ignoto"))).toBeNull(); });
  it("highest badge first, no duplicates", () => {
    const e = earnedBadges([r("m1", "Il mestiere del cameriere"), r("m4", "Accoglienza"), r("m1", "Il mestiere del cameriere")]);
    expect(e.map((x) => x.badge.key)).toEqual(["m4", "m1"]);
  });
  it("Sala Base level ranks above modules", () => { expect(earnedBadges([r("m4", "Accoglienza"), r("level", "Livello Sala Base")])[0]?.badge.key).toBe("base"); });
});

import { badgeForModuleId } from "./academy-badges";
describe("badgeForModuleId", () => {
  it("maps Academy module ids to badges", () => {
    expect(badgeForModuleId("L1-M1")?.key).toBe("m1");
    expect(badgeForModuleId("L1-M2")?.name).toBe("Gagliardetto");
    expect(badgeForModuleId("S1")).toBeNull();
  });
});
