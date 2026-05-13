export const WORKER_CITIES = [
  "Milano", "Roma", "Torino", "Bologna", "Firenze",
  "Napoli", "Genova", "Verona", "Venezia", "Bari",
] as const;

export const ALL_ZONES_OPTION = "Tutte le zone";

export const CITY_ZONES: Record<string, string[]> = {
  Milano: ["Centro", "Navigli", "Brera", "Isola", "Porta Romana", "Porta Venezia", "Città Studi", "Bicocca", "Lambrate", "Sempione", "Bovisa", "Quartiere Adriano"],
  Roma: ["Centro Storico", "Trastevere", "Prati", "Testaccio", "Pigneto", "San Giovanni", "Ostiense", "Parioli", "EUR", "Monti", "Tiburtina", "Aurelio"],
  Torino: ["Centro", "San Salvario", "Crocetta", "Vanchiglia", "Aurora", "Mirafiori", "Borgo Po", "Lingotto", "Barriera di Milano", "Madonna di Campagna"],
  Bologna: ["Centro Storico", "Bolognina", "San Donato", "Santo Stefano", "Saragozza", "Murri", "Navile", "Borgo Panigale", "Savena"],
  Firenze: ["Centro Storico", "Oltrarno", "Campo di Marte", "Novoli", "Isolotto", "Rifredi", "Gavinana", "Le Cure"],
  Napoli: ["Centro Storico", "Vomero", "Chiaia", "Posillipo", "Mergellina", "Fuorigrotta", "Vergini", "Materdei", "San Ferdinando"],
  Genova: ["Centro Storico", "Foce", "Albaro", "Sampierdarena", "Sestri Ponente", "Nervi", "Pegli", "Castelletto"],
  Verona: ["Centro Storico", "Borgo Trento", "Borgo Venezia", "Borgo Roma", "Veronetta", "San Zeno", "Golosine"],
  Venezia: ["San Marco", "Cannaregio", "Castello", "Dorsoduro", "Santa Croce", "San Polo", "Mestre Centro", "Marghera"],
  Bari: ["Murat", "Bari Vecchia", "Libertà", "Madonnella", "Carrassi", "Picone", "Japigia", "San Paolo", "Poggiofranco"],
};

export function zonesForCity(city: string): string[] {
  return CITY_ZONES[city] ?? [];
}
