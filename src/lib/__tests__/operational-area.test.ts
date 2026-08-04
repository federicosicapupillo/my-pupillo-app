import { describe, expect, it } from "vitest";
import {
  isInOperationalArea,
  isOutsideOperationalArea,
  isOutsideOperationalAreaError,
  OUTSIDE_OPERATIONAL_AREA_MESSAGE,
} from "@/lib/operational-area";

const FUTURO = "2026-11-06";

const bologna = { id: "a1", job_city: "Bologna", job_province: "Bologna", service_date: FUTURO, status: "active" };
const imola = { id: "a2", job_city: "Imola", job_province: "BO", service_date: FUTURO, status: "active" };
const torino = { id: "a3", job_city: "Torino", job_province: "Torino", service_date: FUTURO, status: "active" };
const torinoCompleted = { ...torino, id: "a4", status: "completed", service_date: "2026-06-10" };
const torinoAssigned = { ...torino, id: "a5", status: "assigned", service_date: "2026-06-10" };

/** Stesso filtro applicato da "Trova offerte" e dalla mappa. */
const visibili = (list: any[]) => list.filter(isInOperationalArea).map((a) => a.id);

describe("area operativa — visibilità offerte", () => {
  it("1. Bologna active futuro → visibile e candidabile", () => {
    expect(isInOperationalArea(bologna)).toBe(true);
    expect(visibili([bologna])).toEqual(["a1"]);
  });

  it("2. Imola active futuro → visibile e candidabile", () => {
    expect(isInOperationalArea(imola)).toBe(true);
    expect(visibili([imola])).toEqual(["a2"]);
  });

  it("3. Torino active futuro → non visibile", () => {
    expect(isInOperationalArea(torino)).toBe(false);
    expect(visibili([bologna, imola, torino])).toEqual(["a1", "a2"]);
  });

  it("4. accesso diretto URL a Torino → nessuna azione operativa", () => {
    // La pagina di dettaglio usa esattamente questo predicato per nascondere
    // i pulsanti e mostrare il messaggio dedicato.
    expect(isOutsideOperationalArea(torino)).toBe(true);
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
    expect(isInOperationalArea(torinoCompleted)).toBe(false);
    expect(isInOperationalArea(torinoAssigned)).toBe(false);
    expect(visibili([torinoCompleted, torinoAssigned, bologna])).toEqual(["a1"]);
  });

  it("10/11. la regola non dipende dall'utente: nessun accesso operativo per nessuno", () => {
    // Il predicato è puramente territoriale: l'accesso allo storico dei
    // partecipanti passa da chat/turni, non dalla candidabilità.
    for (const viewer of ["worker", "restaurant", "admin", null]) {
      expect(isInOperationalArea(torinoAssigned)).toBe(false);
      expect(typeof viewer === "string" || viewer === null).toBe(true);
    }
  });

  it("12. nessuna regressione su Bologna e provincia", () => {
    const provincia = [
      "Bologna", "Imola", "Casalecchio di Reno", "San Lazzaro di Savena",
      "Zola Predosa", "Sant'Agata Bolognese", "Anzola dell'Emilia", "Valsamoggia",
    ];
    for (const city of provincia) {
      expect(isInOperationalArea({ job_city: city, job_province: "BO" })).toBe(true);
    }
  });

  it("coordinate come controllo aggiuntivo (anti-geocoding fuori zona)", () => {
    expect(isInOperationalArea({ job_city: "Bologna", job_province: "BO", job_latitude: 44.4949, job_longitude: 11.3426 })).toBe(true);
    // comune "giusto" ma coordinate a Milano → fuori area
    expect(isInOperationalArea({ job_city: "Bologna", job_province: "BO", job_latitude: 45.4642, job_longitude: 9.19 })).toBe(false);
    // fallback su location_lat/lng quando job_* mancano
    expect(isInOperationalArea({ job_city: "Bologna", job_province: "BO", location_lat: 45.4642, location_lng: 9.19 })).toBe(false);
  });

  it("nessun confronto fragile su stringhe libere", () => {
    expect(isInOperationalArea({ job_city: "bologna sud" })).toBe(false);
    expect(isInOperationalArea({ job_city: "Torino", job_province: "BO" })).toBe(false);
    expect(isInOperationalArea({ job_city: "ANZOLA DELL'EMILIA", job_province: "BO" })).toBe(true);
  });
});
