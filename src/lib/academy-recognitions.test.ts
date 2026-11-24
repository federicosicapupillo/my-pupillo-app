import { describe, it, expect } from "vitest";
import { pickRecognitions } from "./academy-recognitions";
const id = "11111111-1111-1111-1111-111111111111";
describe("pickRecognitions", () => {
  it("returns only the requested worker's valid modules", () => {
    const body = { workers: [
      { pupillo_subject: "other", modules: [{ module: "m1", title: "X", award: "A", passed_at: "2026-11-20T10:00:00Z" }] },
      { pupillo_subject: id, modules: [{ module: "m1", title: "Squadra di Sala", award: "Scudetto", passed_at: "2026-11-20T10:00:00Z" }, { module: "bad", title: "Y" }] },
    ] };
    expect(pickRecognitions(body, id)).toEqual([{ module: "m1", title: "Squadra di Sala", award: "Scudetto", passed_at: "2026-11-20T10:00:00Z" }]);
  });
  it("shows nothing when the worker did not choose to show them", () => {
    expect(pickRecognitions({ workers: [] }, id)).toEqual([]);
  });
});
