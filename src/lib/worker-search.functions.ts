import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export type SearchWorkerProfile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  languages: string[] | null;
  spoken_languages: Json;
  professional_profile: string | null;
  default_required_skills: string[] | null;
  short_bio: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  city: string | null;
  neighborhood: string | null;
  province: string | null;
  service_area_city: string | null;
  service_area_district: string | null;
  residence_city: string | null;
  available_now_until: string | null;
  badge: string | null;
  rating_avg: number | null;
  reliability_pct: number | null;
  no_shows: number | null;
  weekly_availability: string[] | null;
  last_active_at: string | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  latitude: number | null;
  longitude: number | null;
  service_area_radius_m: number | null;
  reputation_score: number | null;
  reputation_level: string | null;
  completed_shifts: number | null;
  punctuality_pct: number | null;
  rehire_restaurants_count: number | null;
  reviews_count: number | null;
  search_penalty_active: boolean | null;
  search_penalty_reason: string | null;
  search_penalty_until: string | null;
  delay_count: number | null;
  account_status: string | null;
  profile_completed: boolean | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  is_demo: boolean | null;
  seed_batch_id: string | null;
  user_roles: string[];
  role_is_worker: boolean;
  role_is_admin: boolean;
  role_is_restaurant: boolean;
  is_active: boolean;
  is_visible: boolean;
  coordinate_source: "profile_service_area" | "profile_location" | "worker_availability" | "missing";
};

export type WorkerSearchDebug = {
  total_role_rows: number;
  worker_role_user_ids: number;
  blocked_role_user_ids: number;
  allowed_worker_ids: number;
  profiles_received_before_final_filter: number;
  workers_loaded_by_query: number;
  excluded_admin: number;
  excluded_restaurant: number;
  excluded_without_worker_role: number;
  excluded_not_visible: number;
  excluded_deleted: number;
  excluded_inactive: number;
  excluded_demo: number;
  excluded_orphan_auth: number;
};

type ProfileRow = Omit<SearchWorkerProfile, "user_roles" | "role_is_worker" | "role_is_admin" | "role_is_restaurant" | "is_active" | "is_visible"> & {
  email: string | null;
  created_at: string | null;
};

type RoleRow = { user_id: string; role: string };
type AvailabilityCoordinateRow = { worker_id: string; latitude: number | null; longitude: number | null; city: string | null; district: string | null };

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function hasAnyRole(roles: string[], values: string[]) {
  const set = new Set(values);
  return roles.some((role) => set.has(normalizeRole(role)));
}

async function listAuthUserIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Errore lettura utenti auth: ${error.message}`);
    for (const u of data.users ?? []) ids.add(u.id);
    if ((data.users ?? []).length < 1000) break;
  }
  return ids;
}

export const loadRestaurantWorkerSearchResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reason?: string } | undefined) => ({
    reason: typeof input?.reason === "string" ? input.reason.slice(0, 80) : "page_enter",
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: isRestaurant, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "restaurant",
    });
    if (roleError) throw new Error(`Errore verifica ruolo ristoratore: ${roleError.message}`);
    if (!isRestaurant) throw new Response("Solo i ristoratori possono cercare lavoratori", { status: 403 });

    const [{ data: rolesData, error: rolesError }, authUserIds] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      listAuthUserIds(),
    ]);
    if (rolesError) throw new Error(`Errore lettura ruoli: ${rolesError.message}`);

    const roles = (rolesData ?? []) as RoleRow[];
    const rolesByUser = new Map<string, string[]>();
    for (const row of roles) {
      if (!row.user_id) continue;
      const arr = rolesByUser.get(row.user_id) ?? [];
      arr.push(row.role);
      rolesByUser.set(row.user_id, arr);
    }

    const workerRoleUserIds = new Set<string>();
    const blockedUserIds = new Set<string>();
    for (const row of roles) {
      const role = normalizeRole(row.role);
      if (!row.user_id) continue;
      if (role === "worker") workerRoleUserIds.add(row.user_id);
      if (role === "admin" || role === "restaurant" || role === "ristoratore") blockedUserIds.add(row.user_id);
    }
    const allowedWorkerIds = Array.from(workerRoleUserIds).filter((id) => !blockedUserIds.has(id));

    let profiles: ProfileRow[] = [];
    let availabilityCoordinates: AvailabilityCoordinateRow[] = [];
    if (allowedWorkerIds.length > 0) {
      const [{ data: profilesData, error: profilesError }, { data: availabilityData, error: availabilityError }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id,email,full_name,first_name,last_name,age,languages,spoken_languages,professional_profile,default_required_skills,short_bio,primary_role,secondary_roles,city,neighborhood,province,service_area_city,service_area_district,residence_city,available_now_until,badge,rating_avg,reliability_pct,no_shows,weekly_availability,last_active_at,service_area_lat,service_area_lng,latitude,longitude,service_area_radius_m,reputation_score,reputation_level,completed_shifts,punctuality_pct,rehire_restaurants_count,reviews_count,search_penalty_active,search_penalty_reason,search_penalty_until,delay_count,account_status,profile_completed,is_deleted,deleted_at,is_demo,seed_batch_id,created_at")
          .in("id", allowedWorkerIds),
        supabaseAdmin
          .from("worker_availability")
          .select("worker_id, latitude, longitude, city, district")
          .in("worker_id", allowedWorkerIds)
          .not("latitude", "is", null)
          .not("longitude", "is", null),
      ]);
      if (profilesError) throw new Error(`Errore lettura profili worker: ${profilesError.message}`);
      if (availabilityError) throw new Error(`Errore lettura coordinate disponibilità worker: ${availabilityError.message}`);
      profiles = (profilesData ?? []) as ProfileRow[];
      availabilityCoordinates = (availabilityData ?? []) as AvailabilityCoordinateRow[];
    }
    const availabilityCoordinateByWorker = new Map<string, AvailabilityCoordinateRow>();
    for (const row of availabilityCoordinates) {
      if (row.worker_id && row.latitude != null && row.longitude != null && !availabilityCoordinateByWorker.has(row.worker_id)) {
        availabilityCoordinateByWorker.set(row.worker_id, row);
      }
    }

    const auditSearchResults = profiles
      .filter((p) => {
        const pRole = normalizeRole(p.primary_role);
        const userRoles = rolesByUser.get(p.id) ?? [];
        return (
          ["worker", "admin", "restaurant", "ristoratore"].includes(pRole) ||
          hasAnyRole(userRoles, ["worker", "admin", "restaurant"]) ||
          normalizeRole(p.email).includes("pupillo.test") ||
          normalizeRole(p.full_name).includes("nikla") ||
          normalizeRole(p.first_name).includes("nikla") ||
          normalizeRole(p.full_name).includes("cameriere")
        );
      })
      .map((p) => {
        const userRoles = rolesByUser.get(p.id) ?? [];
        return {
          user_id: p.id,
          email: p.email,
          nome: p.first_name ?? p.full_name,
          cognome: p.last_name,
          primary_role: p.primary_role,
          user_roles_role: userRoles,
          is_active: normalizeRole(p.account_status) === "active",
          is_visible: p.profile_completed === true && p.is_deleted !== true && !p.deleted_at,
          deleted_at: p.deleted_at,
          created_at: p.created_at,
        };
      });

    const auditPayload = {
      reason: data.reason,
      restaurant_user_id: userId,
      source: "user_roles(role=worker) -> profiles(id in allowedWorkerIds)",
      totale_profili_profiles_caricati_dopo_ruoli: profiles.length,
      totale_user_roles: roles.length,
      workerRoleUserIds: workerRoleUserIds.size,
      blockedUserIds: blockedUserIds.size,
      allowedWorkerIds: allowedWorkerIds.length,
      profili_allowed_con_primary_role_admin: profiles.filter((p) => normalizeRole(p.primary_role) === "admin").length,
      profili_allowed_con_primary_role_restaurant: profiles.filter((p) => ["restaurant", "ristoratore"].includes(normalizeRole(p.primary_role))).length,
      user_roles_admin: roles.filter((r) => normalizeRole(r.role) === "admin").length,
      user_roles_restaurant: roles.filter((r) => normalizeRole(r.role) === "restaurant").length,
      user_roles_worker: roles.filter((r) => normalizeRole(r.role) === "worker").length,
      elenco_profili_che_possono_apparire_nella_ricerca: auditSearchResults,
    };
    console.log("[PUPILLO_DB_WORKER_AUDIT_BEFORE_CLEANUP]", auditPayload);

    const excluded = {
      admin: 0,
      restaurant: 0,
      not_visible: 0,
      deleted: 0,
      inactive: 0,
      demo: 0,
      orphan_auth: 0,
      without_worker_role: 0,
    };

    const workers: SearchWorkerProfile[] = [];

    for (const p of profiles) {
      const userRoles = rolesByUser.get(p.id) ?? [];
      const primaryRole = normalizeRole(p.primary_role);
      const roleIsWorker = hasAnyRole(userRoles, ["worker"]);
      const roleIsAdmin = hasAnyRole(userRoles, ["admin"]) || primaryRole === "admin";
      const roleIsRestaurant = hasAnyRole(userRoles, ["restaurant"]) || primaryRole === "restaurant" || primaryRole === "ristoratore";
      const isDeleted = p.is_deleted === true || Boolean(p.deleted_at);
      const isActive = normalizeRole(p.account_status) === "active";
      const isVisible = p.profile_completed === true;
      const isDemo = p.is_demo === true || Boolean(p.seed_batch_id);
      const hasAuthUser = authUserIds.has(p.id);

      if (!roleIsWorker) { excluded.without_worker_role += 1; continue; }
      if (roleIsAdmin) { excluded.admin += 1; continue; }
      if (roleIsRestaurant) { excluded.restaurant += 1; continue; }
      if (isDeleted) { excluded.deleted += 1; continue; }
      if (!isActive) { excluded.inactive += 1; continue; }
      if (!isVisible) { excluded.not_visible += 1; continue; }
      if (isDemo) { excluded.demo += 1; continue; }
      if (!hasAuthUser) { excluded.orphan_auth += 1; continue; }

      const { email: _email, ...safeProfile } = p;
      const availabilityCoord = availabilityCoordinateByWorker.get(p.id);
      const lat = p.service_area_lat ?? p.latitude ?? availabilityCoord?.latitude ?? null;
      const lng = p.service_area_lng ?? p.longitude ?? availabilityCoord?.longitude ?? null;
      const coordinateSource: SearchWorkerProfile["coordinate_source"] = p.service_area_lat != null && p.service_area_lng != null
        ? "profile_service_area"
        : p.latitude != null && p.longitude != null
        ? "profile_location"
        : availabilityCoord
        ? "worker_availability"
        : "missing";
      workers.push({
        ...safeProfile,
        service_area_lat: lat,
        service_area_lng: lng,
        user_roles: Array.from(new Set(userRoles.map(normalizeRole).filter(Boolean))),
        role_is_worker: roleIsWorker,
        role_is_admin: roleIsAdmin,
        role_is_restaurant: roleIsRestaurant,
        is_active: isActive,
        is_visible: isVisible,
        coordinate_source: coordinateSource,
      });
    }

    const deduped = new Map<string, SearchWorkerProfile>();
    for (const worker of workers) {
      if (!deduped.has(worker.id)) deduped.set(worker.id, worker);
    }

    const debug: WorkerSearchDebug = {
      total_role_rows: roles.length,
      worker_role_user_ids: workerRoleUserIds.size,
      blocked_role_user_ids: blockedUserIds.size,
      allowed_worker_ids: allowedWorkerIds.length,
      profiles_received_before_final_filter: profiles.length,
      workers_loaded_by_query: deduped.size,
      excluded_admin: excluded.admin,
      excluded_restaurant: excluded.restaurant,
      excluded_without_worker_role: excluded.without_worker_role,
      excluded_not_visible: excluded.not_visible,
      excluded_deleted: excluded.deleted,
      excluded_inactive: excluded.inactive,
      excluded_demo: excluded.demo,
      excluded_orphan_auth: excluded.orphan_auth,
    };

    console.log("[PUPILLO_WORKER_SEARCH_FINAL_CHECK]", {
      ...debug,
      final_workers_in_list_before_ui_filters: deduped.size,
    });

    return {
      workers: Array.from(deduped.values()).sort((a, b) => new Date(b.last_active_at ?? 0).getTime() - new Date(a.last_active_at ?? 0).getTime()),
      debug,
    };
  });
