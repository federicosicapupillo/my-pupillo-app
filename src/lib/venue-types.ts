export const VENUE_TYPES = [
  "Ristorante",
  "Pizzeria",
  "Trattoria",
  "Osteria",
  "Bistrot",
  "Fine dining",
  "Cocktail bar",
  "Pub",
  "Bar",
  "Caffetteria",
  "Gelateria",
  "Pasticceria",
  "Hotel",
  "Agriturismo",
  "Catering",
  "Discoteca",
  "Stabilimento balneare",
  "Food truck",
  "Mensa",
  "Locale eventi",
  "Altro",
] as const;

export type VenueType = (typeof VENUE_TYPES)[number];

export function venueTypeLabel(venue_type?: string | null, venue_type_other?: string | null): string {
  if (!venue_type) return "—";
  if (venue_type === "Altro") return venue_type_other?.trim() || "Altro";
  return venue_type;
}