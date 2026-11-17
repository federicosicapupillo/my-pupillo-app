import { describe, expect, it } from "vitest";
import { suggestionSchema } from "../suggestions-schema";

describe("suggestion validation", () => {
  it("rejects empty suggestions", () => {
    expect(suggestionSchema.safeParse({ message: "  " }).success).toBe(false);
  });
  it("accepts a trimmed suggestion", () => {
    expect(suggestionSchema.parse({ message: "  Migliorare la ricerca  " })).toEqual({ message: "Migliorare la ricerca" });
  });
  it("rejects oversized input", () => {
    expect(suggestionSchema.safeParse({ message: "a".repeat(2001) }).success).toBe(false);
  });
});