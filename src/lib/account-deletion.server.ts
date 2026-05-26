import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AccountDeletionReason =
  | "non_uso_piu"
  | "lavoro_altro_modo"
  | "problemi_piattaforma"
  | "problemi_notifiche_chat"
  | "problemi_pagamenti_crediti"
  | "cancellare_dati"
  | "altro";

type DeletionResult = {
  ok: boolean;
  error_code?: string;
  message?: string;
  technical_message?: string;
};

const PROFILE_SELECT = "id, avatar_url, id_document_path, id_document_back_path";

async function removeStoredFiles(paths: { bucket: string; path: string | null | undefined }[]) {
  const grouped = new Map<string, string[]>();
  for (const item of paths) {
    const path = item.path?.trim();
    if (!path || path.startsWith("http://") || path.startsWith("https://")) continue;
    const list = grouped.get(item.bucket) ?? [];
    list.push(path);
    grouped.set(item.bucket, list);
  }

  for (const [bucket, bucketPaths] of grouped) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(Array.from(new Set(bucketPaths)));
    if (error) {
      console.error(`[deleteAccount] storage cleanup failed for bucket ${bucket}`, error);
    }
  }
}

export async function softDeleteAccount(userId: string, reason: AccountDeletionReason, customReason?: string): Promise<DeletionResult> {
  try {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    const profile = profileData as { avatar_url: string | null; id_document_path: string | null; id_document_back_path: string | null } | null;
    if (!profile) return { ok: false, error_code: "profile_not_found" };

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleError) throw roleError;
    const role = roles?.some((r) => r.role === "restaurant")
      ? "restaurant"
      : roles?.some((r) => r.role === "worker")
        ? "worker"
        : roles?.[0]?.role ?? null;

    const { error: feedbackError } = await supabaseAdmin.from("account_deletion_feedback").insert({
      user_id: userId,
      profile_id: userId,
      role,
      reason,
      custom_reason: reason === "altro" ? customReason?.trim().slice(0, 500) || null : null,
    } as never);

    if (feedbackError) throw feedbackError;

    const anonymizedProfile = {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deletion_reason: reason,
      account_status: "suspended",
      profile_completed: false,
      full_name: null,
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      phone_full: null,
      phone_country_code: null,
      phone_number: null,
      phone_verified: false,
      phone_verified_at: null,
      whatsapp_connected: false,
      avatar_url: null,
      business_name: null,
      vat_number: null,
      vat_company_name: null,
      vat_verified_at: null,
      tax_code: null,
      company_tax_code: null,
      address: null,
      street: null,
      street_number: null,
      city: null,
      province: null,
      postal_code: null,
      country: null,
      latitude: null,
      longitude: null,
      residence_address: null,
      residence_city: null,
      residence_postal_code: null,
      residence_province: null,
      birth_place: null,
      birth_date: null,
      age: null,
      representative_age: null,
      age_verified: false,
      age_verified_at: null,
      nationality: null,
      id_document_path: null,
      id_document_back_path: null,
      id_document_number: null,
      id_document_type: null,
      id_document_issued_at: null,
      id_document_expires_at: null,
      id_document_issuer: null,
      contact_person_first_name: null,
      contact_person_last_name: null,
      contact_person_phone: null,
      contact_person_email: null,
      contact_person_role: null,
      contact_person_role_other: null,
      default_contact_person_name: null,
      service_area_lat: null,
      service_area_lng: null,
      service_area_city: null,
      service_area_district: null,
      selected_zones: [],
      all_zones: false,
      short_bio: null,
      professional_profile: null,
      pec_email: null,
      sdi_code: null,
      registered_office_address: null,
      registered_office_city: null,
      registered_office_province: null,
      registered_office_postal_code: null,
      default_license_requirement: null,
      default_language_requirements: [],
      default_tattoos_allowed: null,
      default_piercings_allowed: null,
      default_beard_allowed: null,
      default_required_skills: [],
      default_dress_code_items: [],
      default_dress_code_notes: null,
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(anonymizedProfile as never)
      .eq("id", userId);

    if (updateError) throw updateError;

    await removeStoredFiles([
      { bucket: "avatars", path: profile.avatar_url },
      { bucket: "worker-documents", path: profile.id_document_path },
      { bucket: "worker-documents", path: profile.id_document_back_path },
    ]);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[deleteAccount] soft delete failed", error);
    return { ok: false, error_code: "delete_failed", technical_message: message };
  }
}