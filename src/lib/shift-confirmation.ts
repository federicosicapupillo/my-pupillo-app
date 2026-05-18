import { formatDateIT, formatTariff } from "@/lib/format";

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

/** Plain-text fallback body (also used for chat preview / notifications). */
export function buildConfirmationBody(
  ann: ConfirmationAnnouncement | null,
  venueName: string | null,
): string {
  const lines: string[] = [
    "Candidatura accettata",
    "",
    "Il ristoratore ha confermato la tua presenza per questo turno.",
    "",
  ];
  lines.push(`Locale: ${clean(venueName) || "Locale da confermare"}`);
  if (ann?.service_date) lines.push(`Data: ${formatDateIT(ann.service_date)}`);
  if (ann?.service_time) {
    const end = ann.end_time ? ` - ${ann.end_time.slice(0, 5)}` : "";
    lines.push(`Orario: ${ann.service_time.slice(0, 5)}${end}`);
  }
  const role = clean(ann?.professional_profile);
  if (role) lines.push(`Ruolo: ${role}`);
  const addr = clean(ann?.location_address) || clean(ann?.job_address) || clean(ann?.job_city);
  if (addr) lines.push(`Indirizzo: ${addr}`);
  const ref = clean(ann?.job_contact_person_name);
  if (ref) lines.push(`Referente: ${ref}`);
  const phone = clean(ann?.job_contact_person_phone);
  if (phone) lines.push(`Telefono referente: ${phone}`);
  const amt = ann?.tariff_amount == null ? null : Number(ann.tariff_amount);
  if (amt != null && Number.isFinite(amt) && amt > 0) {
    lines.push(`Compenso: ${formatTariff(ann?.tariff_amount ?? null, ann?.tariff_type ?? null)}`);
  }
  lines.push("", "Ti consigliamo di arrivare almeno 10 minuti prima dell'orario di ingresso.");
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