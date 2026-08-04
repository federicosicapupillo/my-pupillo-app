import { describe, expect, it } from "vitest";
import {
  findResidenceComune,
  isResidenceComuneValid,
  isValidResidenceCap,
  RESIDENCE_COMUNI,
} from "@/lib/italian-comuni";
import {
  isLocationAllowed,
  isComuneAllowed,
  OPERATIONAL_PROVINCE_CODE,
  OPERATIONAL_PROVINCE_CODES,
  validateLaunchLocation,
} from "@/lib/launch-area";

// Regola: la residenza è ANAGRAFICA (ovunque), l'area operativa è il LUOGO
// DI LAVORO (Bologna e provincia).

describe("residenza lavoratore — anagrafica nazionale", () => {
  const ok = [
    "Bologna",
    "Pontremoli",
    "Milano",
    "Roma",
    "Palermo",
    "Sesto Fiorentino", // comune non capoluogo fuori regione
  ];
  it.each(ok)("%s è una residenza valida (onboarding completabile)", (city) => {
    const entry = findResidenceComune(city);
    expect(entry).not.toBeNull();
    expect(isResidenceComuneValid(city)).toBe(true);
    expect(entry!.province_code).toMatch(/^[A-Z]{2}$/);
  });

  it("associa la provincia corretta senza input manuale", () => {
    expect(findResidenceComune("Pontremoli")!.province_code).toBe("MS");
    expect(findResidenceComune("Palermo")!.province_code).toBe("PA");
    expect(findResidenceComune("San Giovanni in Persiceto")!.province_code).toBe("BO");
  });

  it("rifiuta comuni inesistenti o dati malformati", () => {
    expect(findResidenceComune("Comune Inesistente")).toBeNull();
    expect(isResidenceComuneValid("")).toBe(false);
    expect(isResidenceComuneValid(null)).toBe(false);
    expect(isResidenceComuneValid("   ")).toBe(false);
    expect(isResidenceComuneValid("Milano", "BO")).toBe(false); // provincia incoerente
  });

  it("valida il CAP come dato anagrafico (5 cifre, nessun vincolo territoriale)", () => {
    expect(isValidResidenceCap("54027")).toBe(true); // Pontremoli
    expect(isValidResidenceCap("90100")).toBe(true); // Palermo
    expect(isValidResidenceCap("401")).toBe(false);
    expect(isValidResidenceCap("abcde")).toBe(false);
  });

  it("copre l'intera anagrafica nazionale, non i soli comuni operativi", () => {
    expect(RESIDENCE_COMUNI.length).toBeGreaterThan(7000);
    const provinces = new Set(RESIDENCE_COMUNI.map((c) => c.province_code));
    expect(provinces.size).toBeGreaterThan(90);
  });
});

describe("area operativa — luogo di lavoro", () => {
  it("è configurata in un unico punto", () => {
    expect(OPERATIONAL_PROVINCE_CODE).toBe("BO");
    expect(OPERATIONAL_PROVINCE_CODES).toEqual(["BO"]);
  });

  it("consente annunci a Bologna e nei comuni della provincia", () => {
    expect(isLocationAllowed({ city: "Bologna", province: "Bologna" })).toBe(true);
    expect(isLocationAllowed({ city: "Imola", province: "BO" })).toBe(true);
    expect(isComuneAllowed("Casalecchio di Reno")).toBe(true);
  });

  it("blocca annunci fuori provincia di Bologna", () => {
    for (const city of ["Milano", "Roma", "Palermo", "Pontremoli", "Torino"]) {
      expect(isLocationAllowed({ city })).toBe(false);
    }
    expect(validateLaunchLocation({ city: "Milano", province: "MI" })).toBe(false);
  });

  it("non è aggirabile con testo libero o payload incoerenti", () => {
    expect(isComuneAllowed("bologna sud")).toBe(false);
    expect(isComuneAllowed("Comune di Bologna")).toBe(false);
    expect(validateLaunchLocation({ city: "Bologna", province: "MI" })).toBe(false);
    // coordinate fuori area anche con comune "giusto"
    expect(validateLaunchLocation({ city: "Bologna", province: "BO", lat: 45.4642, lng: 9.19 })).toBe(false);
  });

  it("normalizza accenti/apostrofi e maiuscole (nessun confronto fragile)", () => {
    expect(isComuneAllowed("ANZOLA DELL'EMILIA")).toBe(true);
    expect(isComuneAllowed("anzola dell emilia")).toBe(true);
    expect(isComuneAllowed("Sant'Agata Bolognese")).toBe(true);
  });
});

describe("la residenza non influenza 'Trova offerte'", () => {
  const residenze = ["Bologna", "Pontremoli", "Milano", "Roma"];
  const annunci = [
    { job_city: "Bologna", job_province: "Bologna", visibile: true },
    { job_city: "Imola", job_province: "Bologna", visibile: true },
    { job_city: "Casalecchio di Reno", job_province: "BO", visibile: true },
    { job_city: "Milano", job_province: "Milano", visibile: false },
    { job_city: "Torino", job_province: "Torino", visibile: false },
  ];

  it.each(residenze)("stessi risultati per un lavoratore residente a %s", (residenza) => {
    // la residenza è valida ovunque…
    expect(isResidenceComuneValid(residenza)).toBe(true);
    // …e non entra in alcun modo nel filtro delle offerte
    const visibili = annunci.filter((a) =>
      isLocationAllowed({ city: a.job_city, province: a.job_province }),
    );
    expect(visibili.map((a) => a.job_city)).toEqual([
      "Bologna",
      "Imola",
      "Casalecchio di Reno",
    ]);
    expect(annunci.every((a) => isLocationAllowed({ city: a.job_city, province: a.job_province }) === a.visibile)).toBe(true);
  });
});
