import { describe, expect, it } from "vitest";
import { isBolognaLaunchActive, shouldShowBolognaLaunch } from "../launch-campaign";

describe("campagna lancio Bologna", () => {
  it("è attiva nel 2026", () => {
    expect(isBolognaLaunchActive(new Date("2026-07-29T10:00:00+02:00"))).toBe(true);
    expect(isBolognaLaunchActive(new Date("2026-12-31T23:00:00+01:00"))).toBe(true);
  });
  it("si nasconde dal 1 gennaio 2027", () => {
    expect(isBolognaLaunchActive(new Date("2027-01-01T00:00:00+01:00"))).toBe(false);
    expect(isBolognaLaunchActive(new Date("2027-03-01T12:00:00+01:00"))).toBe(false);
  });
  it("visibile solo al ristoratore", () => {
    const now = new Date("2026-07-29T10:00:00+02:00");
    expect(shouldShowBolognaLaunch("restaurant", now)).toBe(true);
    expect(shouldShowBolognaLaunch("worker", now)).toBe(false);
    expect(shouldShowBolognaLaunch("admin", now)).toBe(false);
    expect(shouldShowBolognaLaunch(null, now)).toBe(false);
  });
  it("non visibile al ristoratore dopo la scadenza", () => {
    expect(shouldShowBolognaLaunch("restaurant", new Date("2027-01-02T10:00:00+01:00"))).toBe(false);
  });
});
