import { describe, expect, it } from "vitest";
import { ACTIVE_JOB_ROLES, JOB_ROLES, isSameRole, roleIdOf, roleLabelOf } from "@/lib/job-roles";
import { WORKER_ROLES } from "@/lib/worker-roles";

describe("catalogo ruoli unico", () => {
  it("non ha id o label duplicati", () => {
    expect(new Set(ACTIVE_JOB_ROLES.map((r) => r.id)).size).toBe(ACTIVE_JOB_ROLES.length);
    expect(new Set(JOB_ROLES).size).toBe(JOB_ROLES.length);
  });

  it("include DJ / intrattenimento", () => {
    expect(JOB_ROLES).toContain("DJ / intrattenimento");
    expect(roleIdOf("DJ e intrattenimento")).toBe("dj_intrattenimento");
    expect(roleIdOf("dj_entertainment")).toBe("dj_intrattenimento");
    expect(roleLabelOf("DJ")).toBe("DJ / intrattenimento");
  });

  it("ruoli lavoratore e ruoli annuncio coincidono", () => {
    expect([...WORKER_ROLES]).toEqual([...JOB_ROLES]);
  });

  it("normalizza le varianti legacy", () => {
    expect(roleLabelOf("aiuto cuoco")).toBe("Aiuto cucina");
    expect(roleLabelOf("Responsabile sala")).toBe("Responsabile di sala");
    expect(roleLabelOf("banconista")).toBe("Addetto banco");
    expect(isSameRole("cameriere", "Cameriere")).toBe(true);
    expect(isSameRole("Chef", "Pizzaiolo")).toBe(false);
  });
});
