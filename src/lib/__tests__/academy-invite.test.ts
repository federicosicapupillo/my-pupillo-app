import { describe, expect, it } from "vitest";
import { ACADEMY_EXTERNAL_URL, dismissAcademyInvite, isAcademyInvitePending, markAcademyInvitePending } from "@/lib/academy";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("Pupillo Academy invite", () => {
  it("uses the confirmed public Academy address", () => {
    expect(ACADEMY_EXTERNAL_URL).toBe("https://accademy.pupillo.life/");
  });
  it("shows the invite only after a completion signal for that user", () => {
    const s = mem();
    expect(isAcademyInvitePending("a", s)).toBe(false);
    markAcademyInvitePending("a", s);
    expect(isAcademyInvitePending("a", s)).toBe(true);
  });
  it("«Più tardi»/«Scopri» hides it for good, also after reload", () => {
    const s = mem();
    markAcademyInvitePending("a", s);
    dismissAcademyInvite("a", s);
    expect(isAcademyInvitePending("a", s)).toBe(false);
    markAcademyInvitePending("a", s);
    expect(isAcademyInvitePending("a", s)).toBe(false);
  });
  it("a second account on the same device does not inherit the flag", () => {
    const s = mem();
    markAcademyInvitePending("a", s);
    expect(isAcademyInvitePending("b", s)).toBe(false);
    dismissAcademyInvite("b", s);
    expect(isAcademyInvitePending("a", s)).toBe(true);
  });
  it("ignores the old browser-wide pending flag", () => {
    const s = mem();
    s.setItem("pupillo_academy_invite_pending", "true");
    expect(isAcademyInvitePending("a", s)).toBe(false);
  });
});
