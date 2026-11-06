/** Province grouped by region, from comuni-json (matteocontrini), retrieved 2026-11-06.
 * Residence only: never restrict this list to the operational area. */
import { RESIDENCE_COMUNI } from "@/lib/italian-comuni";

export const RESIDENCE_REGIONS: Record<string, Record<string, string>> = {
  "Veneto": {
    "PD": "Padova",
    "RO": "Rovigo",
    "VR": "Verona",
    "BL": "Belluno",
    "VI": "Vicenza",
    "TV": "Treviso",
    "VE": "Venezia"
  },
  "Lombardia": {
    "LO": "Lodi",
    "LC": "Lecco",
    "MI": "Milano",
    "BS": "Brescia",
    "CR": "Cremona",
    "MN": "Mantova",
    "BG": "Bergamo",
    "VA": "Varese",
    "MB": "Monza e della Brianza",
    "PV": "Pavia",
    "SO": "Sondrio",
    "CO": "Como"
  },
  "Toscana": {
    "SI": "Siena",
    "PT": "Pistoia",
    "LU": "Lucca",
    "AR": "Arezzo",
    "GR": "Grosseto",
    "MS": "Massa-Carrara",
    "FI": "Firenze",
    "LI": "Livorno",
    "PI": "Pisa",
    "PO": "Prato"
  },
  "Sardegna": {
    "OR": "Oristano",
    "SS": "Sassari",
    "SU": "Sud Sardegna",
    "NU": "Nuoro",
    "CA": "Cagliari"
  },
  "Abruzzo": {
    "PE": "Pescara",
    "AQ": "L'Aquila",
    "TE": "Teramo",
    "CH": "Chieti"
  },
  "Basilicata": {
    "PZ": "Potenza",
    "MT": "Matera"
  },
  "Sicilia": {
    "RG": "Ragusa",
    "CT": "Catania",
    "CL": "Caltanissetta",
    "ME": "Messina",
    "EN": "Enna",
    "AG": "Agrigento",
    "TP": "Trapani",
    "PA": "Palermo",
    "SR": "Siracusa"
  },
  "Puglia": {
    "FG": "Foggia",
    "BA": "Bari",
    "LE": "Lecce",
    "BT": "Barletta-Andria-Trani",
    "TA": "Taranto",
    "BR": "Brindisi"
  },
  "Piemonte": {
    "CN": "Cuneo",
    "AL": "Alessandria",
    "AT": "Asti",
    "TO": "Torino",
    "NO": "Novara",
    "BI": "Biella",
    "VC": "Vercelli",
    "VB": "Verbano-Cusio-Ossola"
  },
  "Lazio": {
    "RI": "Rieti",
    "FR": "Frosinone",
    "VT": "Viterbo",
    "RM": "Roma",
    "LT": "Latina"
  },
  "Campania": {
    "SA": "Salerno",
    "NA": "Napoli",
    "AV": "Avellino",
    "CE": "Caserta",
    "BN": "Benevento"
  },
  "Calabria": {
    "CS": "Cosenza",
    "VV": "Vibo Valentia",
    "RC": "Reggio Calabria",
    "CZ": "Catanzaro",
    "KR": "Crotone"
  },
  "Marche": {
    "PU": "Pesaro e Urbino",
    "AP": "Ascoli Piceno",
    "AN": "Ancona",
    "FM": "Fermo",
    "MC": "Macerata"
  },
  "Umbria": {
    "TR": "Terni",
    "PG": "Perugia"
  },
  "Molise": {
    "CB": "Campobasso",
    "IS": "Isernia"
  },
  "Emilia-Romagna": {
    "PC": "Piacenza",
    "PR": "Parma",
    "RE": "Reggio nell'Emilia",
    "RA": "Ravenna",
    "BO": "Bologna",
    "FE": "Ferrara",
    "FC": "Forlì-Cesena",
    "MO": "Modena",
    "RN": "Rimini"
  },
  "Friuli-Venezia Giulia": {
    "UD": "Udine",
    "PN": "Pordenone",
    "GO": "Gorizia",
    "TS": "Trieste"
  },
  "Liguria": {
    "IM": "Imperia",
    "SV": "Savona",
    "SP": "La Spezia",
    "GE": "Genova"
  },
  "Trentino-Alto Adige": {
    "TN": "Trento",
    "BZ": "Bolzano/Bozen"
  },
  "Valle d'Aosta": {
    "AO": "Valle d'Aosta/Vallée d'Aoste"
  }
};

export const RESIDENCE_REGION_OPTIONS = Object.keys(RESIDENCE_REGIONS).sort((a, b) => a.localeCompare(b, "it"));

export function residenceRegionForProvince(code: string): string {
  return RESIDENCE_REGION_OPTIONS.find((region) => code in RESIDENCE_REGIONS[region]) ?? "";
}

export function residenceProvincesForRegion(region: string) {
  return Object.entries(RESIDENCE_REGIONS[region] ?? {})
    .filter(([code]) => RESIDENCE_COMUNI.some((city) => city.province_code === code))
    .map(([value, name]) => ({ value, label: `${name} (${value})` }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
}

export function residenceCitiesForProvince(code: string) {
  return RESIDENCE_COMUNI.filter((city) => city.province_code === code)
    .map((city) => ({ value: city.name, label: city.name }));
}
