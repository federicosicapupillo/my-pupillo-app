import { supabase } from "@/integrations/supabase/client";

/**
 * Fase 5-bis — accesso in scrittura al proprio profilo.
 *
 * Il ruolo `authenticated` non ha più `UPDATE` diretto su `public.profiles`:
 * ogni scrittura self passa da RPC tipizzate e allowlistate lato database.
 * Il trigger difensivo `trg_00_profiles_guard_admin_columns` resta attivo
 * come seconda barriera.
 */

type Patch = Record<string, unknown>;

/** Chiavi gestite dalla RPC delle impostazioni predefinite annuncio. */
export const ANNOUNCEMENT_DEFAULTS_KEYS = new Set<string>([
  "default_license_requirement",
  "default_language_requirements",
  "default_tattoos_allowed",
  "default_piercings_allowed",
  "default_beard_allowed",
  "default_required_skills",
  "default_dress_code_items",
  "default_dress_code_notes",
  "default_contact_person_name",
  "default_arrival_advance_minutes",
  "default_arrival_advance_reason",
  "default_settings_updated_at",
]);

function splitPatch(patch: Patch): { profile: Patch; defaults: Patch } {
  const profile: Patch = {};
  const defaults: Patch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ANNOUNCEMENT_DEFAULTS_KEYS.has(k)) defaults[k] = v;
    else profile[k] = v;
  }
  return { profile, defaults };
}

/** Aggiorna il proprio profilo (anagrafica, contatti, area, documento, attività). */
export async function updateMyProfile(patch: Patch): Promise<{ error: { message: string } | null }> {
  const { profile, defaults } = splitPatch(patch);
  if (Object.keys(profile).length > 0) {
    const { error } = await supabase.rpc("update_my_profile" as never, { _patch: profile } as never);
    if (error) return { error };
  }
  if (Object.keys(defaults).length > 0) {
    const { error } = await supabase.rpc("update_my_announcement_defaults" as never, { _patch: defaults } as never);
    if (error) return { error };
  }
  return { error: null };
}

/** Salva le impostazioni predefinite usate per creare un annuncio. */
export async function updateMyAnnouncementDefaults(patch: Patch): Promise<{ error: { message: string } | null }> {
  const { profile, defaults } = splitPatch(patch);
  const { error } = await supabase.rpc(
    "update_my_announcement_defaults" as never,
    { _patch: { ...profile, ...defaults } } as never,
  );
  return { error: error ?? null };
}

/** Imposta (o rimuove) la propria immagine profilo. */
export async function setMyAvatar(path: string | null): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("set_my_avatar" as never, { _path: path } as never);
  return { error: error ?? null };
}

/** Attiva/disattiva la disponibilità immediata del lavoratore. */
export async function setMyAvailableNow(until: string | null): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc("set_my_available_now" as never, { _until: until } as never);
  return { error: error ?? null };
}
