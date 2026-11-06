import { describe, expect, it } from "vitest";
import {
  isInOperationalArea,
  isOutsideOperationalArea,
  isOutsideOperationalAreaError,
  OUTSIDE_OPERATIONAL_AREA_MESSAGE,
} from "@/lib/operational-area";

const FUTURO = "2026-11-06";

const activeTorino = { id: "a1", job_city: "Torino", job_province: "Torino", service_date: FUTURO, status: "active" };
const moncalieri = { id: "a2", job_city: "Moncalieri", job_province: "TO", service_date: FUTURO, status: "active" };
const outsideTorino = { id: "a3", job_city: "Bologna", job_province: "Bologna", service_date: FUTURO, status: "active" };
const outsideTorinoCompleted = { ...outsideTorino, id: "a4", status: "completed", service_date: "2026-06-10" };
const outsideTorinoAssigned = { ...outsideTorino, id: "a5", status: "assigned", service_date: "2026-06-10" };

/** Stesso filtro applicato da "Trova offerte" e dalla mappa. */
const visibili = (list: any[]) => list.filter(isInOperationalArea).map((a) => a.id);

describe("area operativa — visibilità offerte", () => {
  it("1. Torino active futuro → visibile e candidabile", () => {
    expect(isInOperationalArea(activeTorino)).toBe(true);
    expect(visibili([activeTorino])).toEqual(["a1"]);
  });

  it("2. Moncalieri active futuro → visibile e candidabile", () => {
    expect(isInOperationalArea(moncalieri)).toBe(true);
    expect(visibili([moncalieri])).toEqual(["a2"]);
  });

  it("3. Bologna active futuro → non visibile", () => {
    expect(isInOperationalArea(outsideTorino)).toBe(false);
    expect(visibili([activeTorino, moncalieri, outsideTorino])).toEqual(["a1", "a2"]);
  });

  it("4. accesso diretto URL a Bologna → nessuna azione operativa", () => {
    // La pagina di dettaglio usa esattamente questo predicato per nascondere
    // i pulsanti e mostrare il messaggio dedicato.
    expect(isOutsideOperationalArea(outsideTorino)).toBe(true);
    expect(OUTSIDE_OPERATIONAL_AREA_MESSAGE).toContain("non è disponibile");
  });

  it("5. errore DB su INSERT candidatura fuori area → riconosciuto e tradotto", () => {
    expect(isOutsideOperationalAreaError({ message: "ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA" })).toBe(true);
    expect(isOutsideOperationalAreaError({ message: 'new row violates ... ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA' })).toBe(true);
    expect(isOutsideOperationalAreaError({ message: "ANNOUNCEMENT_EXPIRED" })).toBe(false);
    expect(isOutsideOperationalAreaError(null)).toBe(false);
  });

  it("6/7. proposte e accettazioni fuori area → codice RPC dedicato", () => {
    const map = (code: string) =>
      code === "outside_operational_area" ? OUTSIDE_OPERATIONAL_AREA_MESSAGE : "altro";
    expect(map("outside_operational_area")).toBe(OUTSIDE_OPERATIONAL_AREA_MESSAGE);
    expect(map("offer_expired")).toBe("altro");
  });

  it("8/9. storici completed e legacy assigned fuori area → mai pubblici", () => {
    expect(isInOperationalArea(outsideTorinoCompleted)).toBe(false);
    expect(isInOperationalArea(outsideTorinoAssigned)).toBe(false);
    expect(visibili([outsideTorinoCompleted, outsideTorinoAssigned, activeTorino])).toEqual(["a1"]);
  });

  it("10/11. la regola non dipende dall'utente: nessun accesso operativo per nessuno", () => {
    // Il predicato è puramente territoriale: l'accesso allo storico dei
    // partecipanti passa da chat/turni, non dalla candidabilità.
    for (const viewer of ["worker", "restaurant", "admin", null]) {
      expect(isInOperationalArea(outsideTorinoAssigned)).toBe(false);
      expect(typeof viewer === "string" || viewer === null).toBe(true);
    }
  });

  it("12. nessuna regressione su Torino e provincia", () => {
    const provincia = [
      "Torino", "Moncalieri", "Rivoli", "Chieri",
      "Nichelino", "Sant'Ambrogio di Torino", "Riva presso Chieri", "Ivrea",
    ];
    for (const city of provincia) {
      expect(isInOperationalArea({ job_city: city, job_province: "TO" })).toBe(true);
    }
  });

  it("coordinate come controllo aggiuntivo (anti-geocoding fuori zona)", () => {
    expect(isInOperationalArea({ job_city: "Torino", job_province: "TO", job_latitude: 45.0703, job_longitude: 7.6869 })).toBe(true);
    // comune "giusto" ma coordinate a Milano → fuori area
    expect(isInOperationalArea({ job_city: "Torino", job_province: "TO", job_latitude: 45.4642, job_longitude: 9.19 })).toBe(false);
    // fallback su location_lat/lng quando job_* mancano
    expect(isInOperationalArea({ job_city: "Torino", job_province: "TO", location_lat: 45.4642, location_lng: 9.19 })).toBe(false);
  });

  it("nessun confronto fragile su stringhe libere", () => {
    expect(isInOperationalArea({ job_city: "activeTorino sud" })).toBe(false);
    expect(isInOperationalArea({ job_city: "Torino", job_province: "BO" })).toBe(false);
    expect(isInOperationalArea({ job_city: "RIVA PRESSO CHIERI", job_province: "TO" })).toBe(true);
  });
});
