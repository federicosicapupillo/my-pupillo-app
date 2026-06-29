// Shared formatting helpers for tariffs and dates (Italian locale).

/**
 * Pulisce un indirizzo testuale rimuovendo CAP, nazione (Italia),
 * duplicati di città/provincia e virgole inutili.
 * Esempio: "via roma, Centro, Torino, Torino, 10121, Italia"
 *   →     "via Roma · Centro · Torino"
 */
export function formatJobLocation(input: {
  address?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  province?: string | null;
}): string {
  const isCap = (s: string) => /^\d{4,5}$/.test(s);
  const isCountry = (s: string) =>
    /^(italia|italy|it)$/i.test(s.trim());
  const cap = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");

  const raw = (input.address ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const city = (input.city ?? "").trim();
  const neighborhood = (input.neighborhood ?? "").trim();
  const province = (input.province ?? "").trim();

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string) => {
    if (!s) return;
    if (isCap(s) || isCountry(s)) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(cap(s));
  };

  for (const p of raw) push(p);
  push(neighborhood);
  push(city);
  // Provincia mostrata solo se diversa dalla città già aggiunta.
  if (province && !seen.has(province.toLowerCase())) push(province);

  return out.join(" · ");
}

/**
 * Formatta l'indirizzo di un annuncio per le schede UI:
 * mostra solo via/indirizzo, città e zona (quando presente).
 * Esclude CAP, nazione, provincia duplicata e valori vuoti.
 * Esempio: "via roma, Centro, Torino, Torino, 10121, Italia" → "via Roma · Torino · Centro"
 */
export function formatAnnouncementLocation(a: {
  location_address?: string | null;
  job_address?: string | null;
  job_city?: string | null;
  job_province?: string | null;
  job_postal_code?: string | null;
  job_country?: string | null;
}): string {
  const street = (a.job_address || "").trim();
  const city = (a.job_city || "").trim();

  if (!a.location_address && !street && !city) return "—";

  // Determine display street
  let displayStreet = street;
  if (!displayStreet && a.location_address) {
    const firstPart = a.location_address.split(",")[1]?.trim();
    if (firstPart) displayStreet = firstPart;
  }

  // Try to extract zone from location_address
  let zone = "";
  if (a.location_address && city) {
    const parts = a.location_address.split(",").map((p) => p.trim()).filter(Boolean);

    // Find city in the parts (case-insensitive)
    const cityIdx = parts.findIndex((p) => p.toLowerCase() === city.toLowerCase());

    if (cityIdx > 1) {
      const provinceLC = (a.job_province || "").trim().toLowerCase();
      const countryLC = (a.job_country || "").trim().toLowerCase();

      // Collect candidates between street (index 0) and city
      const candidates = parts.slice(1, cityIdx).filter((p) => {
        const pl = p.toLowerCase();
        // Must look like a zone (not just numbers)
        if (!/[a-zA-Z]{2,}/.test(p)) return false;
        // Skip known parts
        if (pl === city.toLowerCase()) return false;
        if (pl === provinceLC) return false;
        if (/^\d{5}$/.test(p)) return false; // postal code
        if (pl === "italia") return false;
        if (pl === countryLC) return false;
        // Skip street if already known
        if (displayStreet && pl === displayStreet.toLowerCase()) return false;
        return true;
      });

      if (candidates.length > 1) {
        // Take the last candidate (closest to city = most likely zone)
        zone = candidates[candidates.length - 1];
      }
    }
  }

  const out: string[] = [];
  if (displayStreet) out.push(displayStreet);
  if (city) out.push(city);
  if (zone) out.push(zone);

  // Deduplicate case-insensitively
  const seen = new Set<string>();
  const clean = out.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return clean.length > 1 ? clean.join(" · ") : clean.length === 1 ? clean[0] : "—";
}

/**
 * Formatta data + orario di un turno per la UI:
 *   "28/05/2026 · 19:00 - 23:00"
 *   "28/05/2026 · 22:00 - 29/05/2026 · 02:00"  (turno oltre mezzanotte)
 */
export function formatOfferDateTime(input: {
  service_date?: string | null;
  service_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
}): string {
  const startDate = formatDateIT(input.service_date ?? null);
  if (!startDate) return "—";
  const start = (input.service_time ?? "").slice(0, 5);
  const end = (input.end_time ?? "").slice(0, 5);
  const endDateRaw = input.end_date ?? null;
  const endDiffers =
    !!endDateRaw && !!input.service_date && endDateRaw !== input.service_date;
  let out = startDate;
  if (start) out += ` · ${start}`;
  if (end) {
    if (endDiffers) {
      const endDate = formatDateIT(endDateRaw);
      out += ` - ${endDate} · ${end}`;
    } else {
      out += ` - ${end}`;
    }
  }
  return out;
}

/** Format an announcement label for dropdown display:
 *  "25/05/2026 · 19:00-23:00 · Torino · Centro · Cameriere"
 *  Skips address, postal code, country. Deduplicates city/province.
 */
export function formatAnnouncementLabel(a: {
  service_date: string;
  service_time?: string | null;
  end_time?: string | null;
  job_city?: string | null;
  job_province?: string | null;
  professional_profile?: string | null;
}): string {
  const parts: string[] = [];

  // Date
  const date = formatDateIT(a.service_date);
  if (date) parts.push(date);

  // Time range
  const start = (a.service_time ?? "").trim();
  const end = (a.end_time ?? "").trim();
  const startShort = start.length >= 5 ? start.slice(0, 5) : start;
  const endShort = end.length >= 5 ? end.slice(0, 5) : end;
  if (startShort && endShort) {
    parts.push(`${startShort}-${endShort}`);
  } else if (startShort) {
    parts.push(startShort);
  }

  // City (deduplicate province if identical)
  const city = (a.job_city ?? "").trim();
  const province = (a.job_province ?? "").trim();
  if (city && province && city.toLowerCase() !== province.toLowerCase()) {
    parts.push(`${city}`);
  } else if (city) {
    parts.push(city);
  } else if (province) {
    parts.push(province);
  }

  // Role
  const role = (a.professional_profile ?? "").trim();
  parts.push(role || "Ruolo non specificato");

  return parts.join(" · ");
}


/**
 * Format an announcement tariff for display in Italian style, with the
 * euro symbol AFTER the amount and a single, non-duplicated symbol:
 *   "10 €/ora"            (hourly)
 *   "10 € (a servizio)"   (flat)
 * Never produces `€10`, `€ 10`, `10€` or duplicated euro symbols.
 */
export function formatTariff(
  amount: number | string | null | undefined,
  type?: string | null,
): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  if (type === "hourly" || type == null) return `${pretty} €/ora`;
  return `${pretty} € (a servizio)`;
}

/** Format an ISO yyyy-mm-dd (or Date) as dd/MM/yyyy (it-IT). */
export function formatDateIT(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T00:00:00" : value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Format an ISO timestamp as the canonical Italian "dd/MM/yyyy HH:mm".
 * Always two-digit day/month, four-digit year, colon-separated time.
 * Use this everywhere an offer / shift / event date+time is rendered so
 * the UI stays consistent (avoid `toLocaleString("it-IT", ...)` which
 * may emit "26 giu, 20.30" depending on the runtime).
 */
export function formatDateTimeIT(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T00:00:00" : value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

/**
 * Format a euro amount in Italian style with the symbol AFTER the
 * number and a single space: "10 €", "12,50 €". Never `€10` or `€ 10`.
 */
export function formatEuro(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${pretty} €`;
}

/** Convert a Date to ISO yyyy-mm-dd (local time). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse yyyy-mm-dd into a local Date (no TZ shift). */
export function fromISODate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Compute duration in hours from start/end time strings (HH:MM).
    Handles overnight shifts. Returns null if inputs invalid. */
export function computeDurationHours(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  const diff = endMin - startMin;
  if (diff <= 1) return null;
  return diff / 60;
}

/** Compute total service amount given tariff, type and duration.
    For flat-rate returns amount as-is; for hourly multiplies by duration.
    Falls back to start/end times if duration is missing.
    Returns null if unable to compute. */
export function computeServiceTotal(
  amount: number,
  type: string,
  durationHours?: number | null,
  start?: string | null,
  end?: string | null,
): number | null {
  if (type === "flat") return amount;
  if (type !== "hourly") return null;
  let dur = durationHours;
  if (dur == null && start && end) {
    dur = computeDurationHours(start, end);
  }
  if (dur == null || dur <= 1) return null;
  return Math.round(amount * dur * 100) / 100;
}

/** Format total service for display in Italian style: e.g. "60 €". */
export function formatTotalService(
  amount: number,
  type: string,
  durationHours?: number | null,
  start?: string | null,
  end?: string | null,
): string | null {
  const total = computeServiceTotal(amount, type, durationHours, start, end);
  if (total == null) return null;
  return formatEuro(total);
}