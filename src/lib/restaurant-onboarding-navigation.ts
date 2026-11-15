import type { useNavigate } from "@tanstack/react-router";

type Navigate = ReturnType<typeof useNavigate>;

export const RESTAURANT_ONBOARDING_COUNTRY = "Italia";

export function goToRestaurantOnboarding(navigate: Navigate): void {
  console.info("[restaurant-onboarding-navigation] goToRestaurantOnboarding", {
    to: "/onboarding",
  });
  navigate({ to: "/onboarding" });
}