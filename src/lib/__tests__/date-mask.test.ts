import { describe, it, expect } from "vitest";
import {
  formatDateMask,
  digitsBeforeCaret,
  caretAfterDigit,
} from "@/lib/date-mask";

describe("formatDateMask", () => {
  it("inserts slashes after positions 2 and 4", () => {
    expect(formatDateMask("1")).toBe("1");
    expect(formatDateMask("13")).toBe("13");
    expect(formatDateMask("130")).toBe("13/0");
    expect(formatDateMask("1305")).toBe("13/05");
    expect(formatDateMask("13052")).toBe("13/05/2");
    expect(formatDateMask("13052026")).toBe("13/05/2026");
  });

  it("strips non-digit characters", () => {
    expect(formatDateMask("13a05b2026")).toBe("13/05/2026");
    expect(formatDateMask("13/05/2026")).toBe("13/05/2026");
    expect(formatDateMask("13-05-2026")).toBe("13/05/2026");
    expect(formatDateMask("ab.cd!ef@gh")).toBe("");
  });

  it("caps at 8 digits (no overflow past yyyy)", () => {
    expect(formatDateMask("130520269999")).toBe("13/05/2026");
  });
});

describe("digitsBeforeCaret / caretAfterDigit — cursor preservation", () => {
  it("counts digits before the caret, ignoring slashes", () => {
    expect(digitsBeforeCaret("13/05/2026", 0)).toBe(0);
    expect(digitsBeforeCaret("13/05/2026", 2)).toBe(2);
    expect(digitsBeforeCaret("13/05/2026", 3)).toBe(2); // caret right after "/"
    expect(digitsBeforeCaret("13/05/2026", 5)).toBe(4);
    expect(digitsBeforeCaret("13/05/2026", 10)).toBe(8);
  });

  it("places the caret after the Nth digit, skipping a freshly-inserted slash", () => {
    expect(caretAfterDigit("13/05/2026", 0)).toBe(0);
    // After the 2nd digit the mask just inserted "/", caret jumps past it
    // so the next typed digit lands in the month group, not before the slash.
    expect(caretAfterDigit("13/05/2026", 2)).toBe(3);
    expect(caretAfterDigit("13/05/2026", 4)).toBe(6);
    expect(caretAfterDigit("13/05/2026", 8)).toBe(10);
  });

  it("round-trips for the common 'type a single digit in the middle' case", () => {
    // User has "13/05/2026", caret at index 5 (after "5"), types "6":
    // raw becomes "13/056/2026" → mask reflows to "13/05/62026" capped → "13/05/6202".
    const before = "13/05/2026";
    const caret = 5;
    const digits = digitsBeforeCaret(before, caret); // 4
    const formatted = formatDateMask("13/056/2026");
    expect(formatted).toBe("13/05/6202");
    expect(caretAfterDigit(formatted, digits + 1)).toBe(7); // after the new "6"
  });
});