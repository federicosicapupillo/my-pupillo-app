/**
 * Formatter sicuro per indirizzi/luoghi dei turni Pupillo.
 *
 * Tipicamente l'indirizzo arriva come stringa concatenata
 * ("via roma 3, Centro, Torino, Torino, 10121, Italia") dove
 * city e province coincidono. Questa funzione:
 *  - divide per virgole
 *  - rimuove segmenti vuoti
 *  - rimuove duplicati case-insensitive (non solo consecutivi)
 *  - preserva l'ordine originale
 */
export function formatShiftLocation(
  input:
    | string
    | null
    | undefined
    | {
        address?: string | null;
        zone?: string | null;
        city?: string | null;
        province?: string | null;
        postal_code?: string | null;
        country?: string | null;
      },
): string {
  if (!input) return "";
  const raw =
    typeof input === "string"
      ? input
      : [
          input.address,
          input.zone,
          input.city,
          input.province,
          input.postal_code,
          input.country,
        ]
          .filter(Boolean)
          .join(", ");

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(trimmed);
  }
  return parts.join(", ");
}

export function debugLocationFormat(shiftId: string, raw: string | null | undefined) {
  const before = (raw ?? "").toLowerCase();
  const torinoBefore = (before.match(/\btorino\b/g) ?? []).length > 1;
  const formatted = formatShiftLocation(raw);
  const after = formatted.toLowerCase();
  const torinoAfter = (after.match(/\btorino\b/g) ?? []).length > 1;
  const rawCount = (raw ?? "").split(",").map((p) => p.trim()).filter(Boolean).length;
  const formattedCount = formatted ? formatted.split(",").length : 0;
  console.log("[PUPILLO_LOCATION_FORMAT_DEDUP_DEBUG]", {
    shift_id: shiftId,
    raw_address: raw ?? null,
    formatted_location: formatted,
    duplicates_removed: Math.max(0, rawCount - formattedCount),
    torino_repeated_before: torinoBefore,
    torino_repeated_after: torinoAfter,
  });
  return formatted;
}