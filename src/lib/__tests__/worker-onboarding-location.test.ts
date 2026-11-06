import { describe, expect, it } from "vitest";
import { isWorkerOnboardingCity, WORKER_ONBOARDING_CITY, zonesForCity } from "@/lib/worker-cities";
import { RESIDENCE_REGION_OPTIONS, residenceRegionForProvince, residenceProvincesForRegion, residenceCitiesForProvince } from "@/lib/italian-residence-regions";
import { RESIDENCE_COMUNI } from "@/lib/italian-comuni";
import { isLocationAllowed, validateLaunchLocation } from "@/lib/launch-area";

describe("worker onboarding geography", () => {
  it("permits only Torino as the starting city", () => {
    expect(WORKER_ONBOARDING_CITY).toBe("Torino");
    expect(isWorkerOnboardingCity("Torino")).toBe(true);
    expect(isWorkerOnboardingCity("Moncalieri")).toBe(false);
    expect(isWorkerOnboardingCity("Bologna")).toBe(false);
  });
  it("offers Torino neighborhoods", () => {
    expect(zonesForCity("Torino")).toContain("San Salvario");
    expect(zonesForCity("Torino")).toContain("Crocetta");
  });
  it("allows jobs across Torino province, not Bologna", () => {
    expect(isLocationAllowed({ city: "Moncalieri", province: "TO" })).toBe(true);
    expect(validateLaunchLocation({ city: "Torino", province: "TO", lat: 45.0703, lng: 7.6869 })).toBe(true);
    expect(isLocationAllowed({ city: "Bologna", province: "BO" })).toBe(false);
  });
  it("keeps all 20 regions available for residence", () => {
    expect(RESIDENCE_REGION_OPTIONS).toHaveLength(20);
    expect(residenceRegionForProvince("TO")).toBe("Piemonte");
    expect(residenceProvincesForRegion("Sicilia").map((p) => p.value)).toContain("PA");
    expect(residenceCitiesForProvince("PA").map((c) => c.value)).toContain("Palermo");
    expect(residenceCitiesForProvince("TO").map((c) => c.value)).toContain("Torino");
  });
  it("every existing national residence comune remains reachable", () => {
    for (const province of new Set(RESIDENCE_COMUNI.filter((c) => c.province_code !== "EE").map((c) => c.province_code))) {
      expect(residenceRegionForProvince(province), province).not.toBe("");
      expect(residenceCitiesForProvince(province).length).toBeGreaterThan(0);
    }
  });
});