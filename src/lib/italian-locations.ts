export type CityEntry = {
  name: string;
  caps: string[];
};

export type ProvinceLocation = {
  province: string;
  province_code: string;
  cities: CityEntry[];
};

// MVP set of Italian provinces with main comuni and CAP. Extendable in future.
export const ITALIAN_LOCATIONS: ProvinceLocation[] = [
  {
    province: "Milano",
    province_code: "MI",
    cities: [
      { name: "Milano", caps: ["20121","20122","20123","20124","20125","20126","20127","20128","20129","20131","20132","20133","20134","20135","20136","20137","20138","20139","20141","20142","20143","20144","20145","20146","20147","20148","20149","20151","20152","20153","20154","20155","20156","20157","20158","20159","20161","20162"] },
      { name: "Sesto San Giovanni", caps: ["20099"] },
      { name: "Cinisello Balsamo", caps: ["20092"] },
      { name: "Rho", caps: ["20017"] },
      { name: "Cologno Monzese", caps: ["20093"] },
      { name: "Legnano", caps: ["20025"] },
      { name: "Bollate", caps: ["20021"] },
      { name: "Paderno Dugnano", caps: ["20037"] },
      { name: "San Donato Milanese", caps: ["20097"] },
      { name: "San Giuliano Milanese", caps: ["20098"] },
      { name: "Segrate", caps: ["20090"] },
      { name: "Corsico", caps: ["20094"] },
    ],
  },
  {
    province: "Torino",
    province_code: "TO",
    cities: [
      { name: "Torino", caps: ["10121","10122","10123","10124","10125","10126","10127","10128","10129","10131","10132","10133","10134","10135","10136","10137","10138","10139","10141","10142","10143","10144","10145","10146","10147","10148","10149","10151","10152","10153","10154","10155","10156"] },
      { name: "Moncalieri", caps: ["10024"] },
      { name: "Rivoli", caps: ["10098"] },
      { name: "Collegno", caps: ["10093"] },
      { name: "Nichelino", caps: ["10042"] },
      { name: "Settimo Torinese", caps: ["10036"] },
      { name: "Grugliasco", caps: ["10095"] },
      { name: "Chieri", caps: ["10023"] },
      { name: "Pinerolo", caps: ["10064"] },
      { name: "Venaria Reale", caps: ["10078"] },
    ],
  },
  {
    province: "Roma",
    province_code: "RM",
    cities: [
      { name: "Roma", caps: ["00118","00119","00121","00122","00123","00124","00125","00126","00127","00128","00131","00132","00133","00134","00135","00136","00137","00138","00139","00141","00142","00143","00144","00145","00146","00147","00148","00149","00151","00152","00153","00154","00155","00156","00157","00158","00159","00161","00162","00163","00164","00165","00166","00167","00168","00169","00171","00172","00173","00174","00175","00176","00177","00178","00179","00181","00182","00183","00184","00185","00186","00187","00188","00189","00191","00192","00193","00194","00195","00196","00197","00198","00199"] },
      { name: "Fiumicino", caps: ["00054"] },
      { name: "Guidonia Montecelio", caps: ["00012"] },
      { name: "Pomezia", caps: ["00071"] },
      { name: "Tivoli", caps: ["00019"] },
      { name: "Anzio", caps: ["00042"] },
      { name: "Velletri", caps: ["00049"] },
      { name: "Civitavecchia", caps: ["00053"] },
      { name: "Albano Laziale", caps: ["00041"] },
      { name: "Frascati", caps: ["00044"] },
      { name: "Ciampino", caps: ["00043"] },
    ],
  },
  {
    province: "Firenze",
    province_code: "FI",
    cities: [
      { name: "Firenze", caps: ["50121","50122","50123","50124","50125","50126","50127","50129","50131","50132","50133","50134","50135","50136","50137","50139","50141","50142","50143","50144","50145"] },
      { name: "Scandicci", caps: ["50018"] },
      { name: "Sesto Fiorentino", caps: ["50019"] },
      { name: "Campi Bisenzio", caps: ["50013"] },
      { name: "Bagno a Ripoli", caps: ["50012"] },
      { name: "Empoli", caps: ["50053"] },
      { name: "Fiesole", caps: ["50014"] },
      { name: "Calenzano", caps: ["50041"] },
      { name: "Lastra a Signa", caps: ["50055"] },
    ],
  },
  {
    province: "Bologna",
    province_code: "BO",
    cities: [
      { name: "Bologna", caps: ["40121","40122","40123","40124","40125","40126","40127","40128","40129","40131","40132","40133","40134","40135","40136","40137","40138","40139","40141"] },
      { name: "Imola", caps: ["40026"] },
      { name: "Casalecchio di Reno", caps: ["40033"] },
      { name: "San Lazzaro di Savena", caps: ["40068"] },
      { name: "Castel Maggiore", caps: ["40013"] },
      { name: "Pianoro", caps: ["40065"] },
      { name: "Zola Predosa", caps: ["40069"] },
      { name: "Budrio", caps: ["40054"] },
    ],
  },
  {
    province: "Napoli",
    province_code: "NA",
    cities: [
      { name: "Napoli", caps: ["80121","80122","80123","80124","80125","80126","80127","80128","80129","80131","80132","80133","80134","80135","80136","80137","80138","80139","80141","80142","80143","80144","80145","80146","80147"] },
      { name: "Pozzuoli", caps: ["80078"] },
      { name: "Casoria", caps: ["80026"] },
      { name: "Portici", caps: ["80055"] },
      { name: "Torre del Greco", caps: ["80059"] },
      { name: "Giugliano in Campania", caps: ["80014"] },
    ],
  },
  {
    province: "Venezia",
    province_code: "VE",
    cities: [
      { name: "Venezia", caps: ["30121","30122","30123","30124","30125","30126"] },
      { name: "Mestre", caps: ["30171","30172","30173","30174"] },
      { name: "Marghera", caps: ["30175"] },
      { name: "Chioggia", caps: ["30015"] },
      { name: "Mira", caps: ["30034"] },
      { name: "Spinea", caps: ["30038"] },
    ],
  },
  {
    province: "Genova",
    province_code: "GE",
    cities: [
      { name: "Genova", caps: ["16121","16122","16123","16124","16125","16126","16127","16128","16129","16131","16132","16133","16134","16135","16136","16137","16138","16139","16141","16142","16143","16144","16145","16146","16147","16148","16149","16151","16152","16153","16154","16155","16156","16157","16158","16159","16161","16162","16163","16164","16165","16166","16167"] },
      { name: "Rapallo", caps: ["16035"] },
      { name: "Chiavari", caps: ["16043"] },
      { name: "Sestri Levante", caps: ["16039"] },
      { name: "Recco", caps: ["16036"] },
    ],
  },
];

function findProvince(province?: string | null): ProvinceLocation | undefined {
  if (!province) return undefined;
  return ITALIAN_LOCATIONS.find(
    (x) => x.province === province || x.province_code === province,
  );
}

export function citiesForProvince(province?: string | null): string[] {
  const p = findProvince(province);
  return p ? p.cities.map((c) => c.name) : [];
}

export function capsForCity(province?: string | null, city?: string | null): string[] {
  if (!city) return [];
  const p = findProvince(province);
  if (!p) return [];
  return p.cities.find((c) => c.name === city)?.caps ?? [];
}

export function isValidCapForCity(
  province?: string | null,
  city?: string | null,
  cap?: string | null,
): boolean {
  if (!cap) return false;
  const caps = capsForCity(province, city);
  if (caps.length === 0) return /^\d{5}$/.test(cap);
  return caps.includes(cap);
}

export function provinceCode(province?: string | null): string | null {
  return findProvince(province)?.province_code ?? null;
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

/**
 * Flat list of all comuni across the supported provinces, with their
 * province name and code attached. Used by the residence picker on the
 * worker onboarding to drive the city dropdown without forcing the user
 * to first pick a province.
 */
export type CityWithProvince = {
  city: string;
  province: string;
  province_code: string;
};

export const ALL_CITIES_WITH_PROVINCE: CityWithProvince[] =
  ITALIAN_LOCATIONS.flatMap((p) =>
    p.cities.map((c) => ({
      city: c.name,
      province: p.province,
      province_code: p.province_code,
    })),
  ).sort((a, b) => a.city.localeCompare(b.city, "it"));

/**
 * Lookup helper: given a city name, return the matching province entry
 * (first match if the same comune exists in multiple provinces, which is
 * not the case in the current MVP dataset).
 */
export function findCityProvince(
  city?: string | null,
): CityWithProvince | null {
  if (!city) return null;
  const norm = city.trim().toLowerCase();
  return (
    ALL_CITIES_WITH_PROVINCE.find((c) => c.city.toLowerCase() === norm) ?? null
  );
}

/**
 * Validate the Italian civic number format used by the residence picker.
 * Accepts forms like `12`, `12A`, `24/B`, `100 bis`. Disallows everything
 * else so the saved address stays consistent with the trigger checks.
 */
export const CIVIC_NUMBER_REGEX =
  /^\d{1,5}(?:\s?[A-Za-z]{1,3})?(?:\s?\/\s?[A-Za-z0-9]{1,4})?$/;

export function isValidCivicNumber(input?: string | null): boolean {
  if (!input) return false;
  return CIVIC_NUMBER_REGEX.test(input.trim());
}

/**
 * Try to split a stored `residence_address` (legacy free-text) into a
 * `street` part and a trailing civic number. Returns the original input
 * as `street` with an empty civic if the trailing token does not look
 * like a civic number.
 */
export function splitAddressAndCivic(
  full: string | null | undefined,
): { street: string; civic: string } {
  const v = (full ?? "").trim();
  if (!v) return { street: "", civic: "" };
  // Match a trailing civic at end of string, optionally preceded by a comma.
  const m = v.match(
    /^(.*?)[\s,]+(\d{1,5}(?:\s?[A-Za-z]{1,3})?(?:\s?\/\s?[A-Za-z0-9]{1,4})?)$/,
  );
  if (!m) return { street: v, civic: "" };
  return { street: m[1].trim().replace(/,$/, "").trim(), civic: m[2].trim() };
}

// =============================================================
// Zone / quartiere per CAP (MVP — espandibile)
// Chiave: `${province_code}:${cap}` (es. "MI:20121")
// =============================================================
export const CAP_ZONES: Record<string, string[]> = {
  // Milano
  "MI:20121": ["Centro", "Brera"],
  "MI:20122": ["Centro", "Duomo", "Missori"],
  "MI:20123": ["Centro", "Duomo", "Sant'Ambrogio"],
  "MI:20124": ["Centrale", "Repubblica"],
  "MI:20125": ["Isola", "Garibaldi"],
  "MI:20126": ["Bicocca", "Niguarda"],
  "MI:20127": ["Loreto", "Padova"],
  "MI:20128": ["Città Studi"],
  "MI:20129": ["Porta Venezia", "Buenos Aires"],
  "MI:20131": ["Lambrate", "Città Studi"],
  "MI:20132": ["Cimiano", "Crescenzago"],
  "MI:20133": ["Città Studi", "Politecnico"],
  "MI:20134": ["Forlanini", "Mecenate"],
  "MI:20135": ["Porta Romana", "Crocetta"],
  "MI:20136": ["Ticinese", "Bocconi"],
  "MI:20137": ["Corvetto", "Rogoredo"],
  "MI:20138": ["Mecenate", "Forlanini"],
  "MI:20139": ["Corvetto", "Chiaravalle"],
  "MI:20141": ["Vigentino", "Ripamonti"],
  "MI:20142": ["Barona", "Famagosta"],
  "MI:20143": ["Navigli", "Ticinese"],
  "MI:20144": ["Navigli", "Solari", "Tortona"],
  "MI:20145": ["Sempione", "Pagano"],
  "MI:20146": ["De Angeli", "Washington"],
  "MI:20147": ["Lorenteggio", "Bande Nere"],
  "MI:20148": ["Portello", "Fiera"],
  "MI:20149": ["San Siro", "Pagano"],
  "MI:20151": ["Quarto Oggiaro", "Bovisa"],
  "MI:20152": ["Baggio", "Bisceglie"],
  "MI:20153": ["Quinto Romano", "Trenno"],
  "MI:20154": ["Sempione", "Chinatown"],
  "MI:20155": ["Sempione", "Cenisio"],
  "MI:20156": ["Certosa", "Quarto Oggiaro"],
  "MI:20157": ["Bovisa", "Quarto Oggiaro"],
  "MI:20158": ["Bovisa", "Dergano"],
  "MI:20159": ["Isola", "Maciachini"],
  "MI:20161": ["Affori", "Bruzzano"],
  "MI:20162": ["Niguarda", "Pratocentenaro"],

  // Torino
  "TO:10121": ["Centro"],
  "TO:10122": ["Centro", "Quadrilatero Romano"],
  "TO:10123": ["Centro", "Vanchiglia"],
  "TO:10124": ["Centro", "Vanchiglia"],
  "TO:10125": ["San Salvario"],
  "TO:10126": ["San Salvario", "Lingotto"],
  "TO:10127": ["Lingotto", "Nizza Millefonti"],
  "TO:10128": ["Crocetta"],
  "TO:10129": ["Crocetta", "Cit Turin"],
  "TO:10131": ["Borgo Po", "Madonna del Pilone"],
  "TO:10132": ["Sassi", "Madonna del Pilone"],
  "TO:10133": ["Cavoretto"],
  "TO:10134": ["Mirafiori Nord"],
  "TO:10135": ["Mirafiori Sud"],
  "TO:10136": ["Santa Rita"],
  "TO:10137": ["Mirafiori Nord"],
  "TO:10138": ["Cit Turin", "Cenisia"],
  "TO:10139": ["Cenisia", "Pozzo Strada"],
  "TO:10141": ["Pozzo Strada"],
  "TO:10142": ["Parella"],
  "TO:10143": ["Campidoglio", "San Donato"],
  "TO:10144": ["San Donato"],
  "TO:10145": ["Parella", "Madonna di Campagna"],
  "TO:10146": ["Pozzo Strada"],
  "TO:10147": ["Madonna di Campagna"],
  "TO:10148": ["Barriera di Milano", "Rebaudengo"],
  "TO:10149": ["Lucento", "Vallette"],
  "TO:10151": ["Madonna di Campagna"],
  "TO:10152": ["Aurora", "Porta Palazzo"],
  "TO:10153": ["Vanchiglia", "Vanchiglietta"],
  "TO:10154": ["Barriera di Milano"],
  "TO:10155": ["Falchera", "Regio Parco"],
  "TO:10156": ["Falchera"],

  // Roma (selezione MVP)
  "RM:00184": ["Monti", "Centro storico"],
  "RM:00185": ["Esquilino", "Centro storico"],
  "RM:00186": ["Centro storico", "Pantheon", "Navona"],
  "RM:00187": ["Centro storico", "Trevi", "Barberini"],
  "RM:00188": ["Bufalotta"],
  "RM:00192": ["Prati"],
  "RM:00193": ["Prati", "Borgo"],
  "RM:00195": ["Prati", "Della Vittoria"],
  "RM:00196": ["Flaminio", "Parioli"],
  "RM:00197": ["Parioli"],
  "RM:00198": ["Salario", "Trieste"],
  "RM:00153": ["Trastevere", "Testaccio"],
  "RM:00152": ["Trastevere", "Monteverde"],
  "RM:00154": ["Ostiense", "Testaccio"],
  "RM:00161": ["Nomentano", "Bologna"],
  "RM:00162": ["Nomentano", "Italia"],
  "RM:00179": ["Appio Latino", "Tuscolano"],

  // Firenze
  "FI:50121": ["Centro storico", "Cavour"],
  "FI:50122": ["Centro storico", "Santa Croce"],
  "FI:50123": ["Centro storico", "Stazione"],
  "FI:50124": ["Bellosguardo", "Galluzzo"],
  "FI:50125": ["Oltrarno", "San Frediano"],
  "FI:50126": ["Gavinana", "Sorgane"],
  "FI:50127": ["Novoli", "Rifredi"],
  "FI:50129": ["San Marco", "Cure"],
  "FI:50131": ["Cure", "Coverciano"],
  "FI:50132": ["Campo di Marte"],
  "FI:50133": ["Coverciano", "Salviatino"],
  "FI:50134": ["Rifredi", "Careggi"],
  "FI:50135": ["Settignano", "Rovezzano"],
  "FI:50136": ["Campo di Marte", "Bellariva"],
  "FI:50137": ["Bellariva"],
  "FI:50139": ["Castello", "Statuto"],
  "FI:50141": ["Rifredi", "Castello"],
  "FI:50142": ["Isolotto", "Legnaia"],
  "FI:50143": ["Soffiano", "Isolotto"],
  "FI:50144": ["Novoli", "Peretola"],
  "FI:50145": ["Peretola", "Brozzi"],

  // Bologna
  "BO:40121": ["Centro storico", "Stazione"],
  "BO:40122": ["Centro storico", "Marconi"],
  "BO:40123": ["Centro storico", "Saragozza"],
  "BO:40124": ["Centro storico", "Santo Stefano"],
  "BO:40125": ["Centro storico", "San Vitale"],
  "BO:40126": ["Centro storico", "Università"],
  "BO:40127": ["Bolognina"],
  "BO:40128": ["Lame", "Bolognina"],
  "BO:40129": ["Corticella", "Bolognina"],
  "BO:40131": ["Bolognina", "Arcoveggio"],
  "BO:40132": ["Borgo Panigale", "Reno"],
  "BO:40133": ["Borgo Panigale"],
  "BO:40134": ["Saragozza", "Costa"],
  "BO:40135": ["Saragozza", "San Luca"],
  "BO:40136": ["Porto", "Saragozza"],
  "BO:40137": ["Mazzini", "San Vitale"],
  "BO:40138": ["San Donato", "Mazzini"],
  "BO:40139": ["Savena", "Mazzini"],
  "BO:40141": ["Savena", "San Ruffillo"],
};

export function zonesForCap(province?: string | null, cap?: string | null): string[] {
  if (!cap) return [];
  const code = provinceCode(province) || province || "";
  if (!code) return [];
  return CAP_ZONES[`${code}:${cap}`] ?? [];
}

export function isValidDistrict(
  province?: string | null,
  cap?: string | null,
  district?: string | null,
): boolean {
  if (!district) return true; // vuoto è ammesso
  const zones = zonesForCap(province, cap);
  if (zones.length === 0) return true; // dato non disponibile → accetta
  return zones.some((z) => z.toLowerCase() === district.toLowerCase());
}

// =============================================================
// Zone / quartiere per CITTÀ (indipendente dal CAP)
// Chiave: nome città (case-insensitive)
// =============================================================
export const CITY_ZONES: Record<string, string[]> = {
  Milano: [
    "Centro", "Brera", "Navigli", "Porta Romana", "Isola", "Porta Venezia",
    "CityLife", "Garibaldi", "Bicocca", "Lambrate", "NoLo", "Corso Como",
    "San Siro", "Porta Genova", "Duomo", "Loreto", "Città Studi",
  ],
  Torino: [
    "Centro", "San Salvario", "Crocetta", "Vanchiglia", "Aurora",
    "Barriera di Milano", "Santa Rita", "Mirafiori", "Cit Turin", "Lingotto",
    "Pozzo Strada", "Parella", "Borgo Vittoria", "Madonna di Campagna",
  ],
  Roma: [
    "Centro Storico", "Trastevere", "Prati", "Testaccio", "Parioli",
    "San Lorenzo", "EUR", "Garbatella", "Ostiense", "Monti", "Pigneto",
    "Monteverde", "Tuscolano", "Appio", "Flaminio",
  ],
  Firenze: [
    "Centro", "Santa Croce", "San Frediano", "Oltrarno", "Campo di Marte",
    "Rifredi", "Novoli", "Gavinana", "Porta Romana", "Careggi",
  ],
  Bologna: [
    "Centro", "Bolognina", "San Donato", "Santo Stefano", "Saragozza",
    "Borgo Panigale", "Navile", "Savena", "Murri", "Fiera",
  ],
};

// Aggiunte: Napoli e altre città principali con elenco zone/quartieri.
CITY_ZONES["Napoli"] = [
  "Centro Storico", "Chiaia", "Vomero", "Posillipo", "Fuorigrotta",
  "Mergellina", "San Ferdinando", "Bagnoli", "Arenella", "Secondigliano",
];
CITY_ZONES["Genova"] = [
  "Centro", "Porto Antico", "Carignano", "Foce", "Albaro", "Sturla",
  "Nervi", "Sampierdarena", "Cornigliano", "Sestri Ponente", "Pegli",
];
CITY_ZONES["Palermo"] = [
  "Centro Storico", "Kalsa", "Albergheria", "Vucciria", "Politeama",
  "Libertà", "Notarbartolo", "Mondello", "Sferracavallo", "Brancaccio",
  "Zen", "Borgo Vecchio", "Noce", "Cruillas",
];
CITY_ZONES["Bari"] = [
  "Bari Vecchia", "Murat", "Madonnella", "Libertà", "Picone",
  "Carrassi", "Poggiofranco", "San Pasquale", "Japigia", "Santo Spirito",
  "Palese", "San Paolo", "Carbonara", "Ceglie del Campo",
];
CITY_ZONES["Verona"] = [
  "Centro Storico", "Veronetta", "Borgo Trento", "Borgo Roma",
  "Borgo Milano", "Borgo Venezia", "San Zeno", "Cittadella",
  "San Michele Extra", "Golosine", "Quinzano",
];
CITY_ZONES["Catania"] = [
  "Centro", "Borgo", "Picanello", "San Berillo", "Civita",
  "Ognina", "San Giovanni Galermo", "Librino", "Nesima", "Barriera",
];
CITY_ZONES["Venezia"] = [
  "San Marco", "Castello", "Cannaregio", "Dorsoduro", "San Polo",
  "Santa Croce", "Giudecca", "Lido", "Mestre Centro", "Marghera", "Murano", "Burano",
];
CITY_ZONES["Padova"] = [
  "Centro", "Portello", "Arcella", "Stanga", "Forcellini",
  "Bassanello", "Brusegana", "Mortise", "Sacro Cuore",
];

export function zonesForCity(city?: string | null): string[] {
  if (!city) return [];
  const key = Object.keys(CITY_ZONES).find((k) => k.toLowerCase() === city.toLowerCase());
  return key ? CITY_ZONES[key] : [];
}

export function isValidDistrictForCity(
  city?: string | null,
  district?: string | null,
): boolean {
  if (!district) return false;
  const zones = zonesForCity(city);
  if (zones.length === 0) return true; // città senza elenco → testo libero accettato
  return zones.some((z) => z.toLowerCase() === district.toLowerCase());
}

// =============================================================
// CAP coerenti con la zona/quartiere selezionata
// =============================================================
export function capsForDistrict(
  province?: string | null,
  city?: string | null,
  district?: string | null,
): string[] {
  const allCityCaps = capsForCity(province, city);
  if (!district) return allCityCaps;
  const code = provinceCode(province) || province || "";
  if (!code) return allCityCaps;
  const target = district.toLowerCase();
  const matched = allCityCaps.filter((cap) => {
    const zones = CAP_ZONES[`${code}:${cap}`] ?? [];
    return zones.some((z) => z.toLowerCase().includes(target) || target.includes(z.toLowerCase()));
  });
  // Se non troviamo CAP collegati a quella zona, restituiamo tutti i CAP della città
  // così l'utente può comunque sceglierne uno valido.
  return matched.length > 0 ? matched : allCityCaps;
}

export function isValidCapForDistrict(
  province?: string | null,
  city?: string | null,
  district?: string | null,
  cap?: string | null,
): boolean {
  if (!cap) return false;
  if (!/^\d{5}$/.test(cap)) return false;
  const caps = capsForDistrict(province, city, district);
  if (caps.length === 0) return /^\d{5}$/.test(cap);
  return caps.includes(cap);
}
