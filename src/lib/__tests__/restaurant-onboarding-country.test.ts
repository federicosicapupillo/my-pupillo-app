import { describe, expect, it } from "vitest";
import { RESTAURANT_ONBOARDING_COUNTRY } from "../restaurant-onboarding-navigation";

describe("restaurant onboarding country", () => {
  it("uses Italia as the fixed country", () => {
    expect(RESTAURANT_ONBOARDING_COUNTRY).toBe("Italia");
  });
});