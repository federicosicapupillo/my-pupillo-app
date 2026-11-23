/** Box del volto in pixel del video (origine in alto a sinistra). */
export type FaceBox = { x: number; y: number; width: number; height: number };
export type GuideStatus = "none" | "many" | "far" | "near" | "off-center" | "ok";

/** Ovale guida centrato: larghezza 55% del lato corto, altezza 1.3x. */
export const GUIDE = { widthRatio: 0.55, aspect: 1.3 };

/** Decide se c'è un solo volto ben dentro il cerchio guida. */
export function evaluateFaceGuide(faces: FaceBox[], w: number, h: number): GuideStatus {
  if (faces.length === 0) return "none";
  if (faces.length > 1) return "many";
  const f = faces[0]!;
  const gw = Math.min(w, h) * GUIDE.widthRatio;
  const ratio = f.width / gw;
  if (ratio < 0.45) return "far";
  if (ratio > 1.05) return "near";
  const dx = Math.abs(f.x + f.width / 2 - w / 2) / gw;
  const dy = Math.abs(f.y + f.height / 2 - h / 2) / (gw * GUIDE.aspect);
  if (dx > 0.18 || dy > 0.2) return "off-center";
  return "ok";
}

export const GUIDE_MESSAGES: Record<GuideStatus, string> = {
  none: "Inquadra il tuo viso nel cerchio.",
  many: "Deve esserci solo il tuo viso.",
  far: "Avvicinati un po'.",
  near: "Allontanati un po'.",
  "off-center": "Centra il viso nel cerchio.",
  ok: "Perfetto, puoi scattare!",
};
