// Helpers to read/write the restaurant's default announcement settings
// from the unified `profiles` table.
import type { RestaurantRequirements } from "@/components/RestaurantRequirements";
import { reqToProfileUpdate } from "@/components/RestaurantRequirements";

export type LocationDefaults = {
  address?: string | null;
  city?: string | null;
  district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  access_restrictions?: string | null;
  additional_directions?: string | null;
  location_notes?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
  contact_person_role?: string | null;
  contact_person_role_other?: string | null;
  arrival_advance_minutes?: number | null;
  arrival_advance_reason?: string | null;
};

export type VenueDefaults = {
  venue_type?: string | null;
  venue_type_other?: string | null;
  price_range?: string | null;
};

export function buildDefaultsUpdate(opts: {
  location: LocationDefaults;
  requirements: RestaurantRequirements;
  venue: VenueDefaults;
}) {
  const { location, requirements, venue } = opts;
  // Split contact_person_name into first/last (best effort) for the existing schema.
  const contactName = (location.contact_person_name || "").trim();
  const [firstName, ...rest] = contactName.split(/\s+/);
  const lastName = rest.join(" ");
  // Avoid wiping previously saved defaults when the user leaves a field blank:
  // only persist contact-person fields when the user actually provided a value.
  const contactFields: Record<string, unknown> = {};
  if (contactName.length > 0) {
    contactFields.contact_person_first_name = firstName || null;
    contactFields.contact_person_last_name = lastName || null;
    contactFields.default_contact_person_name = contactName;
  }
  if ((location.contact_person_phone || "").trim().length > 0) {
    contactFields.contact_person_phone = location.contact_person_phone;
  }
  if ((location.contact_person_email || "").trim().length > 0) {
    contactFields.contact_person_email = location.contact_person_email;
  }
  const arrivalFields: Record<string, unknown> = {};
  if (typeof location.arrival_advance_minutes === "number" && Number.isFinite(location.arrival_advance_minutes)) {
    arrivalFields.default_arrival_advance_minutes = location.arrival_advance_minutes;
    arrivalFields.default_arrival_advance_reason =
      (location.arrival_advance_reason || "").trim() || null;
  }
  // Non sovrascrivere con stringhe vuote: persisti solo i campi testuali realmente compilati.
  const textIfPresent = (v: string | null | undefined): Record<string, unknown> | null => {
    const t = (v || "").trim();
    return t.length > 0 ? { value: t } : null;
  };
  const accessFields: Record<string, unknown> = {};
  const ar = textIfPresent(location.access_restrictions);
  if (ar) accessFields.access_restrictions = ar.value;
  const ad = textIfPresent(location.additional_directions);
  if (ad) accessFields.additional_directions = ad.value;
  const ln = textIfPresent(location.location_notes);
  if (ln) accessFields.location_notes = ln.value;
  const roleFields: Record<string, unknown> = {};
  if ((location.contact_person_role || "").trim().length > 0) {
    roleFields.contact_person_role = location.contact_person_role!.trim();
    roleFields.contact_person_role_other =
      location.contact_person_role === "Altro"
        ? (location.contact_person_role_other || "").trim() || null
        : null;
  }
  // Per i requisiti, evita di azzerare le note dress code se l'utente non le ha compilate.
  const reqUpdate = reqToProfileUpdate(requirements) as Record<string, unknown>;
  if (!(requirements.dress_code_notes && requirements.dress_code_notes.trim().length > 0)) {
    delete reqUpdate.default_dress_code_notes;
  }
  return {
    // Luogo (riusa colonne profilo esistenti)
    address: location.address || null,
    city: location.city || null,
    neighborhood: location.district || null,
    province: location.province || null,
    postal_code: location.postal_code || null,
    country: location.country || null,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    ...accessFields,
    ...roleFields,
    ...contactFields,
    ...arrivalFields,
    // Requisiti / dress code
    ...reqUpdate,
    // Tipologia / fascia
    venue_type: venue.venue_type ?? null,
    venue_type_other: venue.venue_type_other ?? null,
    price_range: venue.price_range ?? null,
    // Timestamp
    default_settings_updated_at: new Date().toISOString(),
  };
}

export function hasSavedDefaults(p: any | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.default_settings_updated_at ||
      p.default_license_requirement ||
      (p.default_required_skills && p.default_required_skills.length) ||
      (p.default_dress_code_items && p.default_dress_code_items.length) ||
      p.default_dress_code_notes ||
      (p.default_language_requirements && p.default_language_requirements.length)
  );
}
