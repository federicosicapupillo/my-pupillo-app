import { formatDateIT, formatTariff } from "@/lib/format";
import { formatDisplayLabel } from "@/lib/format-label";

/**
 * Identifier for the "Conferma turno" message sent automatically to the
 * worker after the restaurant clicks "Accetta candidatura". Rendered as a
 * dedicated card in the chat (see `ConfirmationCard` in `messages.$id.tsx`).
 */
export const CONFIRMATION_TEMPLATE_ID = "shift_confirmation";
export const CONFIRMATION_ACTION = "confirm_application";

export type ConfirmationAnnouncement = {
  service_date?: string | null;
  service_time?: string | null;
  end_time?: string | null;
  location_address?: string | null;
  job_city?: string | null;
  job_address?: string | null;
  tariff_amount?: number | string | null;
  tariff_type?: string | null;
  professional_profile?: string | null;
  notes?: string | null;
  required_skills?: string[] | null;
  dress_code_items?: string[] | null;
  dress_code_notes?: string | null;
  job_contact_person_name?: string | null;
  job_contact_person_phone?: string | null;
  job_additional_directions?: string | null;
  job_location_notes?: string | null;
};

function clean(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
  return s;
}

/**
 * Default minutes that the worker should arrive before the shift starts when
 * the restaurant has not specified a custom value.
 */
export const DEFAULT_ARRIVAL_ADVANCE_MINUTES = 10;

/**
 * Subtracts `minutes` from a HH:MM[:SS] service start time and returns the
 * resulting "entry" time as HH:MM. Returns null if the input is invalid.
 * Handles negative roll-over (e.g. 00:05 - 15min → 23:50).
 */
export function computeEntryTime(
  serviceTime: string | null | undefined,
  minutes: number | null | undefined,
): string | null {
  if (!serviceTime) return null;
  const m = /^([0-9]{1,2}):([0-9]{2})/.exec(serviceTime);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  const adv = Number.isFinite(Number(minutes)) && Number(minutes) > 0
    ? Number(minutes)
    : DEFAULT_ARRIVAL_ADVANCE_MINUTES;
  let total = h * 60 + mm - adv;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mn = String(total % 60).padStart(2, "0");
  return `${hh}:${mn}`;
}

/** Plain-text fallback body (also used for chat preview / notifications). */
export function buildConfirmationBody(
  ann: ConfirmationAnnouncement | null,
  venueName: string | null,
  arrivalAdvanceMinutes?: number | null,
): string {
  const lines: string[] = [
    "Proposta accettata: dettagli operativi disponibili",
    "",
    "Hai accettato la proposta di lavoro. Di seguito trovi tutte le informazioni operative per il servizio.",
    "",
    "Dettagli del servizio:",
    "",
  ];
  lines.push(`Locale: ${clean(venueName) || "Locale da confermare"}`);
  const addr = clean(ann?.location_address) || clean(ann?.job_address) || clean(ann?.job_city);
  if (addr) lines.push(`Indirizzo: ${addr}`);
  const role = clean(ann?.professional_profile);
  if (role) lines.push(`Ruolo: ${role}`);
  if (ann?.service_date) lines.push(`Data: ${formatDateIT(ann.service_date)}`);
  if (ann?.service_time) {
    const end = ann.end_time ? ` - ${ann.end_time.slice(0, 5)}` : "";
    lines.push(`Orario: ${ann.service_time.slice(0, 5)}${end}`);
  }
  const advMin = Number.isFinite(Number(arrivalAdvanceMinutes)) && Number(arrivalAdvanceMinutes) > 0
    ? Number(arrivalAdvanceMinutes)
    : DEFAULT_ARRIVAL_ADVANCE_MINUTES;
  const entry = computeEntryTime(ann?.service_time ?? null, advMin);
  if (entry) lines.push(`Orario ingresso: ${entry}`);
  lines.push(`Presentati ${advMin} minuti prima dell'inizio del turno.`);
  const amt = ann?.tariff_amount == null ? null : Number(ann.tariff_amount);
  if (amt != null && Number.isFinite(amt) && amt > 0) {
    lines.push(`Compenso: ${formatTariff(ann?.tariff_amount ?? null, ann?.tariff_type ?? null)}`);
  }
  const ref = clean(ann?.job_contact_person_name);
  const phone = clean(ann?.job_contact_person_phone);
  // Il referente deve sempre comparire nel messaggio operativo lato
  // lavoratore. Se il ristoratore non lo ha indicato, mostriamo il
  // fallback chiaro "non indicato" anziché omettere la riga.
  lines.push(`Referente: ${ref || "non indicato"}${phone ? ` (${phone})` : ""}`);
  if (phone) lines.push(`Telefono: ${phone}`);
  const dressItems = (ann?.dress_code_items ?? []).map((v) => formatDisplayLabel(clean(v))).filter(Boolean);
  const dressNotes = clean(ann?.dress_code_notes);
  const dress = [dressItems.join(", "), dressNotes].filter(Boolean).join(" — ");
  if (dress) lines.push(`Dress code: ${dress}`);
  const ops = clean(ann?.notes) || clean(ann?.job_additional_directions) || clean(ann?.job_location_notes);
  if (ops) lines.push(`Indicazioni operative: ${ops}`);
  lines.push(
    "",
    "Note importanti:",
    "- Presentati con puntualità.",
    "- Porta eventuali documenti richiesti.",
    "- In caso di problemi, scrivi subito in chat.",
    "",
    "A presto.",
  );
  return lines.join("\n");
}

export const CONFIRMATION_EMPTY_LABELS = {
  dressCode: "Dress code non specificato",
  contactPerson: "Referente non ancora indicato",
  notes: "Note operative non presenti",
  endTime: "Orario di fine turno non specificato",
  phone: "Telefono referente non disponibile",
  directions: "Istruzioni per l'arrivo non disponibili",
} as const;