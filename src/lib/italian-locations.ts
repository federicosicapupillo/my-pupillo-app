export type ProvinceLocation = {
  province: string;
  province_code: string;
  cities: string[];
};

// MVP set of Italian provinces with main comuni. Extendable in future.
export const ITALIAN_LOCATIONS: ProvinceLocation[] = [
  {
    province: "Milano",
    province_code: "MI",
    cities: [
      "Milano",
      "Sesto San Giovanni",
      "Cinisello Balsamo",
      "Rho",
      "Cologno Monzese",
      "Legnano",
      "Bollate",
      "Paderno Dugnano",
      "San Donato Milanese",
      "San Giuliano Milanese",
      "Segrate",
      "Corsico",
    ],
  },
  {
    province: "Torino",
    province_code: "TO",
    cities: [
      "Torino",
      "Moncalieri",
      "Rivoli",
      "Collegno",
      "Nichelino",
      "Settimo Torinese",
      "Grugliasco",
      "Chieri",
      "Pinerolo",
      "Venaria Reale",
    ],
  },
  {
    province: "Roma",
    province_code: "RM",
    cities: [
      "Roma",
      "Fiumicino",
      "Guidonia Montecelio",
      "Pomezia",
      "Tivoli",
      "Anzio",
      "Velletri",
      "Civitavecchia",
      "Albano Laziale",
      "Frascati",
      "Ciampino",
    ],
  },
  {
    province: "Firenze",
    province_code: "FI",
    cities: [
      "Firenze",
      "Scandicci",
      "Sesto Fiorentino",
      "Campi Bisenzio",
      "Bagno a Ripoli",
      "Empoli",
      "Fiesole",
      "Calenzano",
      "Lastra a Signa",
    ],
  },
  {
    province: "Bologna",
    province_code: "BO",
    cities: [
      "Bologna",
      "Imola",
      "Casalecchio di Reno",
      "San Lazzaro di Savena",
      "Castel Maggiore",
      "Pianoro",
      "Zola Predosa",
      "Budrio",
    ],
  },
  {
    province: "Napoli",
    province_code: "NA",
    cities: ["Napoli", "Pozzuoli", "Casoria", "Portici", "Torre del Greco", "Giugliano in Campania"],
  },
  {
    province: "Venezia",
    province_code: "VE",
    cities: ["Venezia", "Mestre", "Marghera", "Chioggia", "Mira", "Spinea"],
  },
  {
    province: "Genova",
    province_code: "GE",
    cities: ["Genova", "Rapallo", "Chiavari", "Sestri Levante", "Recco"],
  },
];

export function citiesForProvince(province?: string | null): string[] {
  if (!province) return [];
  const p = ITALIAN_LOCATIONS.find(
    (x) => x.province === province || x.province_code === province,
  );
  return p ? p.cities : [];
}

export function provinceCode(province?: string | null): string | null {
  if (!province) return null;
  const p = ITALIAN_LOCATIONS.find(
    (x) => x.province === province || x.province_code === province,
  );
  return p?.province_code ?? null;
}

export function provinceFromCode(code?: string | null): string | null {
  if (!code) return null;
  return ITALIAN_LOCATIONS.find((x) => x.province_code === code)?.province ?? null;
}

export function isCityInProvince(city?: string | null, province?: string | null): boolean {
  if (!city || !province) return false;
  return citiesForProvince(province).includes(city);
}

export const ALL_PROVINCES = ITALIAN_LOCATIONS.map((p) => p.province);
