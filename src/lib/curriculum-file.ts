export const CURRICULUM_MAX_BYTES = 5 * 1024 * 1024;
export const CURRICULUM_BUCKET = "worker-curricula";
export function validateCurriculumBytes(bytes: Uint8Array): string | null {
  if (!bytes.length) return "Seleziona un curriculum.";
  if (bytes.length > CURRICULUM_MAX_BYTES) return "Il curriculum supera il limite di 5 MB.";
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return "Carica il curriculum in formato PDF.";
  return null;
}