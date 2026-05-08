export type PriceRangeKey =
  | "economy"
  | "medium"
  | "medium_high"
  | "high"
  | "luxury"
  | "not_specified";

export const PRICE_RANGE_OPTIONS: { value: PriceRangeKey; symbol: string; label: string }[] = [
  { value: "economy", symbol: "€", label: "Economico" },
  { value: "medium", symbol: "€€", label: "Medio" },
  { value: "medium_high", symbol: "€€€", label: "Medio-alto" },
  { value: "high", symbol: "€€€€", label: "Alto" },
  { value: "luxury", symbol: "€€€€+", label: "Luxury / fine dining" },
  { value: "not_specified", symbol: "", label: "Non specificato" },
];

export function priceRangeLabel(value?: string | null): string {
  if (!value) return "—";
  const found = PRICE_RANGE_OPTIONS.find((o) => o.value === value);
  if (!found) return value; // legacy free-text
  if (found.value === "not_specified") return "Non specificato";
  return `${found.symbol} — ${found.label}`;
}
