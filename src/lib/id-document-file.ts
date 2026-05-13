/**
 * Shared client-side validation for the worker ID document.
 *
 * Server-authoritative checks live in `id-document-upload.functions.ts`
 * (magic-byte sniff + service-role upload). This module exists to give
 * users immediate feedback before the upload round-trip.
 */

export const ID_DOC_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const ID_DOC_ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"] as const;

export const ID_DOC_ACCEPT_ATTR =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export const ID_DOC_MAX_BYTES = 10 * 1024 * 1024;

export const ID_DOC_INVALID_FORMAT_MESSAGE =
  "Formato documento non valido. Carica un file PDF, JPG, JPEG o PNG.";
export const ID_DOC_TOO_LARGE_MESSAGE =
  "File troppo grande. Dimensione massima: 10 MB.";

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Read the first bytes and detect MIME from magic numbers. */
async function sniffMime(file: File): Promise<string | null> {
  const head = await file.slice(0, 16).arrayBuffer();
  const b = new Uint8Array(head);
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export type IdDocCheckResult =
  | { ok: true; mime: (typeof ID_DOC_ALLOWED_MIME)[number] }
  | { ok: false; error: string };

/**
 * Validate a user-picked ID document on the client.
 *
 * Rules:
 * - extension must be in {pdf, jpg, jpeg, png}
 * - browser-reported MIME (when present) must be allowed
 * - magic-byte sniff must yield an allowed MIME
 * - size must be ≤ 10 MB
 */
export async function validateIdDocumentFile(file: File): Promise<IdDocCheckResult> {
  if (file.size > ID_DOC_MAX_BYTES) {
    return { ok: false, error: ID_DOC_TOO_LARGE_MESSAGE };
  }
  const ext = getExt(file.name);
  if (!ID_DOC_ALLOWED_EXT.includes(ext as (typeof ID_DOC_ALLOWED_EXT)[number])) {
    return { ok: false, error: ID_DOC_INVALID_FORMAT_MESSAGE };
  }
  if (file.type && !ID_DOC_ALLOWED_MIME.includes(file.type as (typeof ID_DOC_ALLOWED_MIME)[number])) {
    return { ok: false, error: ID_DOC_INVALID_FORMAT_MESSAGE };
  }
  const sniffed = await sniffMime(file);
  if (!sniffed) {
    return { ok: false, error: ID_DOC_INVALID_FORMAT_MESSAGE };
  }
  return { ok: true, mime: sniffed as (typeof ID_DOC_ALLOWED_MIME)[number] };
}