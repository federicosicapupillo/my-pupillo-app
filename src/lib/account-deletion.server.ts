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
  impact?: Record<string, number>;
  /** "complete" = cleanup RPC succeeded, "partial" = profile hidden but cleanup pending retry. */
  cleanup_status?: "complete" | "partial" | "not_applicable";
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

export type AccountDeletionImpact = {
  announcements: number;
  applications: number;
  proposals: number;
  assigned_shifts: number;
  imminent_shifts: number;
  completed_shifts: number;
};

/**
 * Impact summary for a restaurant account, computed server-side with the
 * admin client (the SQL sibling `get_my_account_deletion_impact()` uses
 * auth.uid() and is meant for the authenticated client).
 */
export async function loadRestaurantDeletionImpact(userId: string): Promise<AccountDeletionImpact> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

  const countOf = async (p: PromiseLike<{ count: number | null }>) => (await p).count ?? 0;

  const [announcements, applications, assignedShifts, imminentShifts, completedShifts] = await Promise.all([
    countOf(
      supabaseAdmin
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", userId)
        .not("status", "in", "(cancelled,completed)") as never,
    ),
    countOf(
      supabaseAdmin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", userId)
        .in("status", ["pending", "interested", "counter_offer"]) as never,
    ),
    countOf(
      supabaseAdmin
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", userId)
        .eq("status", "scheduled")
        .gte("shift_date", todayIso) as never,
    ),
    countOf(
      supabaseAdmin
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", userId)
        .eq("status", "scheduled")
        .lte("shift_date", tomorrowIso) as never,
    ),
    countOf(
      supabaseAdmin
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", userId)
        .eq("status", "completed") as never,
    ),
  ]);

  // Pending proposals = non-final applications that carry a `propose_shift`
  // message. Counted separately because it needs a join on messages.
  let proposals = 0;
  {
    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("restaurant_id", userId)
      .in("status", ["pending", "interested", "counter_offer"]);
    const ids = ((apps as { id: string }[] | null) ?? []).map((a) => a.id);
    if (ids.length > 0) {
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("application_id")
        .eq("action_type", "propose_shift")
        .in("application_id", ids);
      proposals = new Set(((msgs as { application_id: string }[] | null) ?? []).map((m) => m.application_id)).size;
    }
  }

  return {
    announcements,
    applications,
    proposals,
    assigned_shifts: assignedShifts,
    imminent_shifts: imminentShifts,
    completed_shifts: completedShifts,
  };
}

type CleanupOutcome = { status: "complete" | "partial"; error: string | null; result: Record<string, unknown> | null };

/**
 * Runs the restaurant cleanup RPC. Fully idempotent: safe to call again after
 * a partial failure. The UID always comes from the trusted caller (verified
 * session on the server), never from client input.
 */
export async function runRestaurantCleanup(userId: string): Promise<CleanupOutcome> {
  const rpc = (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc;
  try {
    const { data, error } = await rpc.call(supabaseAdmin, "process_restaurant_account_deletion", { _uid: userId });
    const payload = (data ?? null) as Record<string, unknown> | null;
    if (error || payload?.ok !== true) {
      const msg = error?.message ?? `unexpected cleanup payload: ${JSON.stringify(payload)}`;
      console.error("[deleteAccount] restaurant cleanup failed", { userId, error: msg });
      await supabaseAdmin.from("admin_audit_log").insert({
        actor: userId,
        action: "restaurant_account_deleted_cleanup_failed",
        target_user: userId,
        reason: "restaurant_account_deleted",
        metadata: { error: msg, cleanup_status: "partial" },
      } as never);
      return { status: "partial", error: msg, result: payload };
    }
    return { status: "complete", error: null, result: payload };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteAccount] restaurant cleanup threw", { userId, error: msg });
    await supabaseAdmin.from("admin_audit_log").insert({
      actor: userId,
      action: "restaurant_account_deleted_cleanup_failed",
      target_user: userId,
      reason: "restaurant_account_deleted",
      metadata: { error: msg, cleanup_status: "partial" },
    } as never);
    return { status: "partial", error: msg, result: null };
  }
}

export async function softDeleteAccount(
  userId: string,
  reason: AccountDeletionReason,
  customReason?: string,
  options: { confirmActiveShifts?: boolean } = {},
): Promise<DeletionResult> {
  try {
    const { data: authBefore, error: authBeforeError } = await supabaseAdmin.auth.admin.getUserById(userId);
    console.info("[deleteAccount] Auth user status before deletion", {
      userId,
      authUserActive: Boolean(authBefore?.user),
      error: authBeforeError?.message ?? null,
    });

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

    // Restaurant accounts: block the deletion until the owner explicitly
    // confirms the cancellation of imminent / in-progress shifts.
    let restaurantImpact: AccountDeletionImpact | null = null;
    if (role === "restaurant") {
      restaurantImpact = await loadRestaurantDeletionImpact(userId);
      if (restaurantImpact.imminent_shifts > 0 && options.confirmActiveShifts !== true) {
        return {
          ok: false,
          error_code: "active_shifts_confirmation_required",
          message:
            "Alcuni lavoratori sono già stati assegnati a turni imminenti o in corso. Eliminando il profilo, questi turni saranno annullati e i lavoratori verranno avvisati.",
          impact: restaurantImpact as unknown as Record<string, number>,
        };
      }
    }

    const { error: feedbackError } = await supabaseAdmin.from("account_deletion_feedback").insert({
      user_id: userId,
      profile_id: userId,
      role,
      reason,
      custom_reason: reason === "altro" ? customReason?.trim().slice(0, 500) || null : null,
    } as never);

    if (feedbackError) throw feedbackError;

    // Transactional cleanup: cancel announcements / applications / proposals /
    // future shifts and notify every involved worker exactly once.
    let cleanupStatus: "complete" | "partial" | "not_applicable" = "not_applicable";
    if (role === "restaurant") {
      // Do NOT abort on failure: the profile must still be flagged as deleted
      // so that its announcements stop being visible to workers. The caller
      // gets `cleanup_status: "partial"` and the cleanup can be retried.
      cleanupStatus = (await runRestaurantCleanup(userId)).status;
    }

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
    console.info("[deleteAccount] profile marked as deleted", { userId, is_deleted: true });

    await removeStoredFiles([
      { bucket: "avatars", path: profile.avatar_url },
      { bucket: "worker-documents", path: profile.id_document_path },
      { bucket: "worker-documents", path: profile.id_document_back_path },
    ]);

    let authAction: "deleted" | "disabled" | "failed" = "failed";
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (!deleteUserError) {
      authAction = "deleted";
      console.info("[deleteAccount] Auth user deleted", { userId });
    } else {
      console.error("[deleteAccount] Auth user deletion failed; trying to disable user", {
        userId,
        error: deleteUserError.message,
      });
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      } as never);
      if (!banError) {
        authAction = "disabled";
        console.info("[deleteAccount] Auth user disabled/banned", { userId });
      } else {
        console.error("[deleteAccount] Auth user disable failed; frontend deleted-account guard remains active", {
          userId,
          error: banError.message,
        });
      }
    }

    const { data: authAfter, error: authAfterError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const afterUser = authAfter?.user as { deleted_at?: string | null; banned_until?: string | null } | undefined;
    console.info("[deleteAccount] Auth user status after cleanup", {
      userId,
      authAction,
      authUserStillReadable: Boolean(authAfter?.user),
      deletedAt: afterUser?.deleted_at ?? null,
      bannedUntil: afterUser?.banned_until ?? null,
      error: authAfterError?.message ?? null,
    });

    return { ok: true, cleanup_status: cleanupStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[deleteAccount] soft delete failed", error);
    return { ok: false, error_code: "delete_failed", technical_message: message };
  }
}