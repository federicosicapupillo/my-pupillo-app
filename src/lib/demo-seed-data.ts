// Static datasets for demo seed. No PII — these are obviously fictional.

export const DEMO_FIRST_NAMES_M = [
  "Marco", "Luca", "Giuseppe", "Andrea", "Francesco", "Matteo", "Davide",
  "Stefano", "Alessandro", "Paolo", "Roberto", "Giovanni", "Antonio", "Simone",
  "Riccardo", "Federico", "Tommaso", "Lorenzo", "Pietro", "Nicola",
];

export const DEMO_FIRST_NAMES_F = [
  "Giulia", "Sara", "Chiara", "Francesca", "Martina", "Alessia", "Elena",
  "Valentina", "Laura", "Silvia", "Anna", "Federica", "Eleonora", "Camilla",
  "Beatrice", "Greta", "Marta", "Roberta", "Ilaria", "Veronica",
];

export const DEMO_LAST_NAMES = [
  "Rossi", "Bianchi", "Romano", "Russo", "Ferrari", "Esposito", "Bruno",
  "Greco", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo",
  "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
  "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo",
  "Gentile", "Marini", "Vitale",
];

export const DEMO_WORKER_ROLES = [
  "cameriere",
  "barista",
  "chef",
  "aiuto_cucina",
  "lavapiatti",
  "pizzaiolo",
  "runner",
  "sommelier",
  "hostess",
  "addetto_sala",
];

export const DEMO_VENUE_TYPES = [
  "ristorante",
  "pizzeria",
  "trattoria",
  "osteria",
  "bar",
  "bistrot",
  "enoteca",
  "hotel_ristorante",
];

export type DemoCity = {
  city: string;
  province: string;
  province_code: string;
  postal_code: string;
  lat: number;
  lng: number;
};

export const DEMO_CITIES: DemoCity[] = [
  { city: "Torino", province: "Torino", province_code: "TO", postal_code: "10121", lat: 45.0703, lng: 7.6869 },
  { city: "Milano", province: "Milano", province_code: "MI", postal_code: "20121", lat: 45.4642, lng: 9.19 },
  { city: "Bologna", province: "Bologna", province_code: "BO", postal_code: "40121", lat: 44.4949, lng: 11.3426 },
  { city: "Roma", province: "Roma", province_code: "RM", postal_code: "00184", lat: 41.9028, lng: 12.4964 },
  { city: "Firenze", province: "Firenze", province_code: "FI", postal_code: "50122", lat: 43.7696, lng: 11.2558 },
  { city: "Genova", province: "Genova", province_code: "GE", postal_code: "16121", lat: 44.4056, lng: 8.9463 },
  { city: "Como", province: "Como", province_code: "CO", postal_code: "22100", lat: 45.8081, lng: 9.0852 },
  { city: "La Spezia", province: "La Spezia", province_code: "SP", postal_code: "19121", lat: 44.1024, lng: 9.824 },
  { city: "Verona", province: "Verona", province_code: "VR", postal_code: "37121", lat: 45.4384, lng: 10.9916 },
  { city: "Napoli", province: "Napoli", province_code: "NA", postal_code: "80121", lat: 40.8518, lng: 14.2681 },
];

export function jitterCoord(base: number, scale = 0.04): number {
  return base + (Math.random() - 0.5) * scale;
}

export function pick<T>(arr: T[], i?: number): T {
  if (typeof i === "number") return arr[i % arr.length];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generates a syntactically valid mock Italian fiscal code (16 chars).
// NOT a real algorithm — just satisfies the trigger regex
// `^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$`.
export function mockTaxCode(seed: number): string {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const N = "0123456789";
  const r = (s: string, n: number) => Array.from({ length: n }, () => s[(Math.random() * s.length) | 0]).join("");
  return r(L, 6) + r(N, 2) + r(L, 1) + r(N, 2) + r(L, 1) + r(N, 3) + r(L, 1);
}

// Mock Italian ID-card number matching `^[A-Z]{2}[0-9]{5}[A-Z]{2}$`.
export function mockIdNumber(): string {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const N = "0123456789";
  const r = (s: string, n: number) => Array.from({ length: n }, () => s[(Math.random() * s.length) | 0]).join("");
  return r(L, 2) + r(N, 5) + r(L, 2);
}

// Mock Italian VAT number (11 digits).
export function mockVatNumber(): string {
  const N = "0123456789";
  return Array.from({ length: 11 }, () => N[(Math.random() * 10) | 0]).join("");
}