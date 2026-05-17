// Approximate coordinates of major Italian cities. Used to position workers on
// the map when they have a `city` but no precise `service_area_lat/lng`.
// Names are matched case-insensitively, ignoring accents.
export const ITALIAN_CITY_COORDS: Record<string, [number, number]> = {
  roma: [41.9028, 12.4964],
  milano: [45.4642, 9.19],
  napoli: [40.8518, 14.2681],
  torino: [45.0703, 7.6869],
  palermo: [38.1157, 13.3615],
  genova: [44.4056, 8.9463],
  bologna: [44.4949, 11.3426],
  firenze: [43.7696, 11.2558],
  bari: [41.1171, 16.8719],
  catania: [37.5079, 15.083],
  venezia: [45.4408, 12.3155],
  verona: [45.4384, 10.9916],
  messina: [38.1938, 15.554],
  padova: [45.4064, 11.8768],
  trieste: [45.6495, 13.7768],
  brescia: [45.5416, 10.2118],
  taranto: [40.4644, 17.247],
  prato: [43.8777, 11.1023],
  parma: [44.8015, 10.3279],
  modena: [44.6471, 10.9252],
  reggio: [38.1113, 15.6473], // Reggio Calabria
  "reggio calabria": [38.1113, 15.6473],
  "reggio emilia": [44.6983, 10.6307],
  perugia: [43.1107, 12.3908],
  livorno: [43.5485, 10.3106],
  ravenna: [44.4184, 12.2035],
  cagliari: [39.2238, 9.1217],
  foggia: [41.4622, 15.5446],
  rimini: [44.0678, 12.5695],
  salerno: [40.6824, 14.7681],
  ferrara: [44.8381, 11.6198],
  sassari: [40.7259, 8.5557],
  latina: [41.4676, 12.9037],
  giugliano: [40.9286, 14.1955],
  monza: [45.5845, 9.2744],
  siracusa: [37.0755, 15.2866],
  bergamo: [45.6983, 9.6773],
  pescara: [42.4584, 14.2081],
  trento: [46.0667, 11.1167],
  forli: [44.2226, 12.0407],
  vicenza: [45.5455, 11.5354],
  terni: [42.5636, 12.6426],
  bolzano: [46.4983, 11.3548],
  novara: [45.4469, 8.6219],
  piacenza: [45.0526, 9.6929],
  ancona: [43.6158, 13.5189],
  andria: [41.2275, 16.2952],
  arezzo: [43.4633, 11.8796],
  udine: [46.0626, 13.2345],
  cesena: [44.1391, 12.2431],
  lecce: [40.3515, 18.1718],
  pesaro: [43.9102, 12.9132],
  alessandria: [44.9133, 8.6151],
  pisa: [43.7228, 10.4017],
  catanzaro: [38.9067, 16.5942],
  pistoia: [43.9333, 10.9173],
  brindisi: [40.6383, 17.9457],
  treviso: [45.6669, 12.2431],
  caserta: [41.0731, 14.3326],
  varese: [45.8206, 8.8251],
  asti: [44.9, 8.2069],
  como: [45.8081, 9.0852],
  pavia: [45.1847, 9.1582],
  cremona: [45.1335, 10.0227],
  lucca: [43.8429, 10.5027],
  mantova: [45.1564, 10.7914],
  potenza: [40.6428, 15.799],
  trapani: [38.0173, 12.5365],
  matera: [40.667, 16.6043],
  benevento: [41.13, 14.7826],
  campobasso: [41.5603, 14.6685],
  aosta: [45.7372, 7.3206],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`]/g, " ")
    .trim();
}

export function lookupCityCoords(
  city: string | null | undefined,
): [number, number] | null {
  if (!city) return null;
  const key = normalize(city);
  if (ITALIAN_CITY_COORDS[key]) return ITALIAN_CITY_COORDS[key];
  // Try first token (e.g. "Milano Centro" → "milano")
  const first = key.split(/\s+/)[0];
  if (first && ITALIAN_CITY_COORDS[first]) return ITALIAN_CITY_COORDS[first];
  return null;
}

// Deterministic small jitter (~ up to ~1.5 km) so many workers in the same
// city don't stack on a single pixel. Uses a hash of the worker id as seed.
export function jitterCoords(
  base: [number, number],
  seed: string,
  radiusKm = 1.5,
): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r1 = ((h >>> 0) % 10000) / 10000; // 0..1
  const r2 = (((h * 48271) >>> 0) % 10000) / 10000;
  const angle = r1 * 2 * Math.PI;
  const dist = Math.sqrt(r2) * radiusKm; // km
  const dLat = (dist / 111) * Math.cos(angle);
  const dLng =
    (dist / (111 * Math.max(0.1, Math.cos((base[0] * Math.PI) / 180)))) *
    Math.sin(angle);
  return [base[0] + dLat, base[1] + dLng];
}