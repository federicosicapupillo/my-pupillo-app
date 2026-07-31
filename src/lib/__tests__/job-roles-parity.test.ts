/**
 * Test di PARITÀ del catalogo ruoli: fallisce se una superficie applicativa
 * torna a divergere dal catalogo unico (`src/lib/job-roles.ts`).
 * Serve a impedire regressioni future: elenchi hardcoded, alias ambigui,
 * id/label duplicati, valori salvati non risolvibili.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_JOB_ROLES,
  JOB_ROLE_CATALOG,
  JOB_ROLES,
  roleIdOf,
  roleLabelOf,
} from "@/lib/job-roles";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { DEMO_WORKER_ROLES } from "@/lib/demo-seed-data";

function compact(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

describe("parità catalogo ruoli", () => {
  it("non esistono id duplicati", () => {
    const ids = JOB_ROLE_CATALOG.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("non esistono label duplicate (nemmeno equivalenti)", () => {
    const keys = JOB_ROLE_CATALOG.map((r) => compact(r.label));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("nessun alias ambiguo o in conflitto con id/label di altri ruoli", () => {
    const owner = new Map<string, string>();
    const conflicts: string[] = [];
    for (const role of JOB_ROLE_CATALOG) {
      for (const key of [role.id, role.label]) {
        const k = compact(key);
        if (owner.has(k) && owner.get(k) !== role.id) conflicts.push(`${key} → ${owner.get(k)} / ${role.id}`);
        owner.set(k, role.id);
      }
    }
    for (const role of JOB_ROLE_CATALOG) {
      for (const alias of role.aliases ?? []) {
        const k = compact(alias);
        if (owner.has(k) && owner.get(k) !== role.id) conflicts.push(`${alias} → ${owner.get(k)} / ${role.id}`);
        owner.set(k, role.id);
      }
    }
    expect(conflicts).toEqual([]);
  });

  it("ogni ruolo attivo è risolvibile da id, label e da ogni alias", () => {
    for (const role of ACTIVE_JOB_ROLES) {
      expect(roleIdOf(role.id)).toBe(role.id);
      expect(roleIdOf(role.label)).toBe(role.id);
      expect(roleLabelOf(role.id)).toBe(role.label);
      for (const alias of role.aliases ?? []) {
        expect(roleIdOf(alias)).toBe(role.id);
      }
    }
  });

  it("i ruoli annuncio e i ruoli lavoratore sono lo stesso insieme", () => {
    // un ruolo pubblicabile in annuncio deve essere selezionabile dal lavoratore
    expect([...WORKER_ROLES].sort()).toEqual([...JOB_ROLES].sort());
  });

  it("ogni ruolo attivo è disponibile nella ricerca lavoratori e in Trova offerte", () => {
    // entrambe le superfici derivano da JOB_ROLES: verifichiamo la copertura completa
    for (const role of ACTIVE_JOB_ROLES) {
      expect(JOB_ROLES).toContain(role.label);
      expect(WORKER_ROLES).toContain(role.label);
    }
  });

  it("i ruoli dei dati demo/seed sono valori canonici del catalogo", () => {
    for (const r of DEMO_WORKER_ROLES) {
      expect(roleIdOf(r), `ruolo demo non risolvibile: ${r}`).not.toBeNull();
      expect(roleLabelOf(r)).toBe(r);
    }
  });

  it("i valori legacy noti restano risolvibili", () => {
    const legacy = [
      "dj", "DJ", "DJ e intrattenimento", "dj_entertainment", "dj_intrattenimento",
      "responsabile sala", "maitre", "maître", "banconista", "addetto cassa",
      "aiuto cuoco", "cuoco", "barman", "steward", "chef de rang", "security",
    ];
    for (const v of legacy) {
      expect(roleIdOf(v), `legacy non risolvibile: ${v}`).not.toBeNull();
    }
  });

  it("nessuna superficie applicativa definisce un elenco ruoli alternativo", () => {
    const files = [
      "src/routes/announcements.new.tsx",
      "src/routes/ristoratore.annunci.nuovo.tsx",
      "src/routes/browse.tsx",
      "src/routes/workers.tsx",
      "src/routes/mappa.tsx",
      "src/components/WorkerRolesMultiSelect.tsx",
      "src/lib/demo-seed-data.ts",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(
        /job-roles|worker-roles/.test(src),
        `${f} non usa il catalogo unico dei ruoli`,
      ).toBe(true);
      // array letterale contenente almeno due label di ruolo → sorgente alternativa
      const literalRoleArray = /\[\s*"(?:cameriere|bartender|chef|barista|runner|hostess)"[^\]]*,[^\]]*\]/i;
      expect(literalRoleArray.test(src), `${f} contiene un elenco ruoli hardcoded`).toBe(false);
    }
  });
});