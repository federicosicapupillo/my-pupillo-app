import { z } from "zod";

/** Output strutturato del controllo visivo: nessuna identità, nessun punteggio. */
export const avatarModerationOutput = z.object({
  human_face_count: z.number().int().min(0),
  face_clearly_visible: z.boolean(),
  explicit_nudity: z.boolean(),
  genitals_visible: z.boolean(),
  sexual_activity: z.boolean(),
  obscene_gesture: z.boolean(),
});
export type AvatarModerationOutput = z.infer<typeof avatarModerationOutput>;

export type AvatarRejectCode =
  | "no_face"
  | "multiple_faces"
  | "face_not_visible"
  | "explicit_content"
  | "obscene_gesture";

export const AVATAR_REJECT_MESSAGES: Record<AvatarRejectCode, string> = {
  no_face: "Nella foto non si vede un volto. Scatta o scegli una foto del tuo viso.",
  multiple_faces: "Nella foto ci sono più persone. Serve una foto con solo il tuo viso.",
  face_not_visible: "Il viso non è ben visibile. Usa una foto frontale, nitida e ben illuminata.",
  explicit_content: "La foto contiene contenuti non consentiti. Usa una foto del viso adatta a un profilo professionale.",
  obscene_gesture: "La foto contiene un gesto non consentito. Usa una foto del viso adatta a un profilo professionale.",
};

export type AvatarDecision = { approved: true } | { approved: false; code: AvatarRejectCode };

/** Regola di approvazione: un solo volto umano ben visibile, nessun contenuto vietato. */
export function decideAvatarModeration(o: AvatarModerationOutput): AvatarDecision {
  if (o.explicit_nudity || o.genitals_visible || o.sexual_activity) return { approved: false, code: "explicit_content" };
  if (o.obscene_gesture) return { approved: false, code: "obscene_gesture" };
  if (o.human_face_count === 0) return { approved: false, code: "no_face" };
  if (o.human_face_count > 1) return { approved: false, code: "multiple_faces" };
  if (!o.face_clearly_visible) return { approved: false, code: "face_not_visible" };
  return { approved: true };
}

/** Riconosce JPG/PNG/WEBP dai primi byte, senza fidarsi del tipo dichiarato. */
export function sniffImageMime(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Percorso privato riservato alle foto approvate dal server. */
export function isModeratedAvatarPath(userId: string, path: string | null | undefined): boolean {
  return !!path && path.startsWith(`${userId}/moderated/`);
}
