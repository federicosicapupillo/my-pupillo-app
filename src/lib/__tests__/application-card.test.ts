import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldShowNewApplicationCard,
  nextApplicationStatus,
  type ApplicationStatus,
} from "../application-card";

describe("shouldShowNewApplicationCard", () => {
  it("è visibile per il ristoratore quando la candidatura è pending", () => {
    expect(
      shouldShowNewApplicationCard({
        role: "restaurant",
        status: "pending",
        hasWorkerReputation: true,
      }),
    ).toBe(true);
  });

  it("NON è visibile per il lavoratore anche se pending", () => {
    expect(
      shouldShowNewApplicationCard({
        role: "worker",
        status: "pending",
        hasWorkerReputation: true,
      }),
    ).toBe(false);
  });

  it.each<ApplicationStatus>([
    "interested",
    "not_interested",
    "accepted",
    "rejected",
    "cancelled",
  ])("NON è visibile per il ristoratore se lo stato è %s", (status) => {
    expect(
      shouldShowNewApplicationCard({
        role: "restaurant",
        status,
        hasWorkerReputation: true,
      }),
    ).toBe(false);
  });

  it("NON è visibile se la reputazione del lavoratore non è ancora caricata", () => {
    expect(
      shouldShowNewApplicationCard({
        role: "restaurant",
        status: "pending",
        hasWorkerReputation: false,
      }),
    ).toBe(false);
  });

  it("NON è visibile con stato null/undefined", () => {
    expect(
      shouldShowNewApplicationCard({
        role: "restaurant",
        status: null,
        hasWorkerReputation: true,
      }),
    ).toBe(false);
    expect(
      shouldShowNewApplicationCard({
        role: "restaurant",
        status: undefined,
        hasWorkerReputation: true,
      }),
    ).toBe(false);
  });
});

describe("nextApplicationStatus", () => {
  it("Accetta su pending → accepted", () => {
    expect(nextApplicationStatus("pending", "accepted")).toBe("accepted");
  });

  it("Rifiuta su pending → rejected", () => {
    expect(nextApplicationStatus("pending", "rejected")).toBe("rejected");
  });

  it.each<ApplicationStatus>([
    "accepted",
    "rejected",
    "cancelled",
    "interested",
    "not_interested",
  ])("rifiuta la transizione se la candidatura non è più pending (%s)", (s) => {
    expect(nextApplicationStatus(s, "accepted")).toBeNull();
    expect(nextApplicationStatus(s, "rejected")).toBeNull();
  });
});

/**
 * Simulazione integrata: il flusso di Accetta/Rifiuta deve aggiornare
 * lo stato della candidatura via una update sulla tabella `applications`
 * e non deve lanciare errori. Mockiamo il client supabase per verificare
 * che venga invocato con i parametri attesi.
 */
describe("flusso Accetta/Rifiuta (integrazione con client mock)", () => {
  type UpdateCall = { table: string; values: Record<string, unknown>; eqId: string };

  function makeSupabaseMock(opts: { failOn?: ApplicationStatus } = {}) {
    const calls: UpdateCall[] = [];
    const supabase = {
      from(table: string) {
        return {
          update(values: Record<string, unknown>) {
            return {
              eq(_col: string, eqId: string) {
                calls.push({ table, values, eqId });
                if (opts.failOn && values.status === opts.failOn) {
                  return Promise.resolve({ error: { message: "boom" } });
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
    return { supabase, calls };
  }

  async function transition(
    supabase: ReturnType<typeof makeSupabaseMock>["supabase"],
    appId: string,
    current: ApplicationStatus,
    action: DecisionActionLocal,
  ): Promise<{ ok: boolean; next: ApplicationStatus | null; error?: string }> {
    const next = nextApplicationStatus(current, action);
    if (!next) return { ok: false, next: null, error: "transizione non ammessa" };
    const { error } = await supabase
      .from("applications")
      .update({ status: next })
      .eq("id", appId);
    if (error) return { ok: false, next, error: (error as { message: string }).message };
    return { ok: true, next };
  }

  type DecisionActionLocal = "accepted" | "rejected";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Accetta aggiorna lo stato a 'accepted' senza errori", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await transition(supabase, "app-1", "pending", "accepted");
    expect(res).toEqual({ ok: true, next: "accepted" });
    expect(calls).toEqual([
      { table: "applications", values: { status: "accepted" }, eqId: "app-1" },
    ]);
  });

  it("Rifiuta aggiorna lo stato a 'rejected' senza errori", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await transition(supabase, "app-1", "pending", "rejected");
    expect(res).toEqual({ ok: true, next: "rejected" });
    expect(calls[0].values).toEqual({ status: "rejected" });
  });

  it("non chiama il database se la candidatura non è più pending", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await transition(supabase, "app-1", "accepted", "rejected");
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("propaga l'errore se l'update fallisce", async () => {
    const { supabase } = makeSupabaseMock({ failOn: "accepted" });
    const res = await transition(supabase, "app-1", "pending", "accepted");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("boom");
  });
});