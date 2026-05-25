import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side verification of the temporary "site access" password.
// The real password is read from the SITE_ACCESS_PASSWORD env var (server-only).
// To change it: update the SITE_ACCESS_PASSWORD secret in Lovable Cloud settings.
// Optional: set SITE_ACCESS_PASSWORD_HASH (sha256 hex) instead of the plain value.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const verifySiteAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ password: z.string().min(1).max(256) }).parse(data))
  .handler(async ({ data }) => {
    const plain = process.env.SITE_ACCESS_PASSWORD;
    const hash = process.env.SITE_ACCESS_PASSWORD_HASH;
    if (!plain && !hash) {
      // Misconfigured: fail closed.
      return { ok: false as const };
    }
    if (hash) {
      const candidate = await sha256Hex(data.password);
      return { ok: timingSafeEqual(candidate.toLowerCase(), hash.trim().toLowerCase()) };
    }
    return { ok: timingSafeEqual(data.password, plain!) };
  });