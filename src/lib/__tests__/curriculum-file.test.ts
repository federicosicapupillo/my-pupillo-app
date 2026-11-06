import { describe, expect, it } from "vitest";
import { CURRICULUM_MAX_BYTES, validateCurriculumBytes } from "@/lib/curriculum-file";
describe("curriculum PDF validation", () => {
  it("accepts PDF signature", () => expect(validateCurriculumBytes(new TextEncoder().encode("%PDF-1.7"))).toBeNull());
  it("rejects files renamed as PDF", () => expect(validateCurriculumBytes(new TextEncoder().encode("not a PDF"))).not.toBeNull());
  it("rejects empty files", () => expect(validateCurriculumBytes(new Uint8Array())).not.toBeNull());
  it("limits files to 5 MB", () => {
    expect(CURRICULUM_MAX_BYTES).toBe(5242880);
    expect(validateCurriculumBytes(new Uint8Array(5242881))).not.toBeNull();
    const max = new Uint8Array(5242880);
    max.set(new TextEncoder().encode("%PDF-"));
    expect(validateCurriculumBytes(max)).toBeNull();
  });
});