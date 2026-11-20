import { describe, expect, it } from "vitest";
import { decideAvatarModeration, isModeratedAvatarPath, sniffImageMime } from "./decision";

const ok = { human_face_count: 1, face_clearly_visible: true, explicit_nudity: false, genitals_visible: false, sexual_activity: false, obscene_gesture: false };

describe("decideAvatarModeration", () => {
  it("approva un solo volto ben visibile", () => expect(decideAvatarModeration(ok)).toEqual({ approved: true }));
  it("rifiuta senza volto", () => expect(decideAvatarModeration({ ...ok, human_face_count: 0 })).toEqual({ approved: false, code: "no_face" }));
  it("rifiuta più volti", () => expect(decideAvatarModeration({ ...ok, human_face_count: 2 })).toEqual({ approved: false, code: "multiple_faces" }));
  it("rifiuta volto non visibile", () => expect(decideAvatarModeration({ ...ok, face_clearly_visible: false })).toEqual({ approved: false, code: "face_not_visible" }));
  it("rifiuta nudità esplicita", () => expect(decideAvatarModeration({ ...ok, explicit_nudity: true }).approved).toBe(false));
  it("rifiuta genitali", () => expect(decideAvatarModeration({ ...ok, genitals_visible: true })).toEqual({ approved: false, code: "explicit_content" }));
  it("rifiuta atti sessuali", () => expect(decideAvatarModeration({ ...ok, sexual_activity: true })).toEqual({ approved: false, code: "explicit_content" }));
  it("rifiuta gesti osceni", () => expect(decideAvatarModeration({ ...ok, obscene_gesture: true })).toEqual({ approved: false, code: "obscene_gesture" }));
});

describe("file e percorsi", () => {
  it("riconosce un JPG dai byte", () => expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe("image/jpeg"));
  it("rifiuta byte sconosciuti", () => expect(sniffImageMime(new Uint8Array([1, 2, 3, 4]))).toBeNull());
  it("accetta solo percorsi moderati del lavoratore", () => {
    expect(isModeratedAvatarPath("u1", "u1/moderated/a.jpg")).toBe(true);
    expect(isModeratedAvatarPath("u1", "u1/avatar-1.jpg")).toBe(false);
    expect(isModeratedAvatarPath("u1", "u2/moderated/a.jpg")).toBe(false);
  });
});
