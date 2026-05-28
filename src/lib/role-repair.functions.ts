import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export type RoleStatus =
  | "ok"
  | "missing_profile"
  | "missing_user_role"
  | "missing_both"
  | "role_mismatch";

export type RoleIssueRow = {
  id: string;
  email: string | null;
  createdAt: string;
  metaRole: string | null;
  profileRole: string | null;
  userRoles: string[];
  status: RoleStatus;
  suggestedRole: "admin" | "worker" | "restaurant" | null;
};

export type RoleMismatchReport = {
  authUsers: number;
  profiles: number;
  userRoles: number;
  issues: RoleIssueRow[];
  orphanProfiles: number;
  orphanRoles: number;
  admins: Array<{ id: string; email: string | null }>;
};

export const listRoleMismatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleMismatchReport> => {
    await assertAdmin(context.supabase, context.userId);

    const [{ data: authList, error: authErr }, profilesRes, rolesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, primary_role"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (authErr) throw new Error(authErr.message);

    const profileById = new Map<string, { primary_role: string | null }>();
    for (const p of profilesRes.data ?? []) {
      profileById.set(p.id, { primary_role: (p as any).primary_role ?? null });
    }
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const authIds = new Set((authList.users ?? []).map((u) => u.id));

    const VALID = new Set(["admin", "worker", "restaurant"]);
    const issues: RoleIssueRow[] = [];
    for (const u of authList.users ?? []) {
      const prof = profileById.get(u.id);
      const profileRole = prof?.primary_role ?? null;
      const userRoles = rolesByUser.get(u.id) ?? [];
      const hasProfile = !!prof;
      const hasRoleRow = userRoles.length > 0;
      const metaRole = (u.user_metadata?.role as string) ?? null;

      let status: RoleStatus = "ok";
      if (!hasProfile && !hasRoleRow) status = "missing_both";
      else if (!hasProfile) status = "missing_profile";
      else if (!hasRoleRow) status = "missing_user_role";
      else if (profileRole && !userRoles.includes(profileRole)) status = "role_mismatch";

      if (status === "ok") continue;

      // Suggest a role from existing data, in priority order.
      const candidates = [
        userRoles.find((r) => r === "admin"),
        userRoles.find((r) => r === "restaurant"),
        userRoles.find((r) => r === "worker"),
        profileRole,
        metaRole,
      ].filter((v): v is string => !!v && VALID.has(v));
      const suggestedRole = (candidates[0] as RoleIssueRow["suggestedRole"]) ?? null;

      issues.push({
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at ?? "",
        metaRole,
        profileRole,
        userRoles,
        status,
        suggestedRole,
      });
    }

    console.info("[PUPILLO_ROLE_MISMATCH_DEBUG] report", {
      authUsers: authList.users?.length ?? 0,
      profiles: profileById.size,
      userRoles: rolesRes.data?.length ?? 0,
      issuesCount: issues.length,
      issuesByStatus: issues.reduce<Record<string, number>>((acc, i) => {
        acc[i.status] = (acc[i.status] ?? 0) + 1;
        return acc;
      }, {}),
    });

    let orphanProfiles = 0;
    for (const id of profileById.keys()) if (!authIds.has(id)) orphanProfiles++;
    let orphanRoles = 0;
    for (const uid of rolesByUser.keys()) if (!authIds.has(uid)) orphanRoles++;

    const admins = (authList.users ?? [])
      .filter((u) => (rolesByUser.get(u.id) ?? []).includes("admin"))
      .map((u) => ({ id: u.id, email: u.email ?? null }));

    return {
      authUsers: authList.users?.length ?? 0,
      profiles: profileById.size,
      userRoles: rolesRes.data?.length ?? 0,
      issues,
      orphanProfiles,
      orphanRoles,
      admins,
    };
  });

const RepairInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "worker", "restaurant"]),
});

export const repairUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RepairInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // Verify the user actually exists in Supabase Auth.
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (authErr || !authUser?.user) {
      throw new Error("Utente Auth non trovato per questo id.");
    }
    const u = authUser.user;

    // Ensure profile exists and primary_role matches the target role.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, primary_role")
      .eq("id", u.id)
      .maybeSingle();
    if (!existingProfile) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const { error: insErr } = await supabaseAdmin.from("profiles").insert({
        id: u.id,
        email: u.email ?? null,
        full_name: (meta.full_name as string) ?? null,
        first_name: (meta.first_name as string) ?? null,
        last_name: (meta.last_name as string) ?? null,
        primary_role: data.role,
        profile_completed: false,
        phone_verified: data.role === "admin",
        account_status: "active",
        is_deleted: false,
      });
      if (insErr) throw new Error(`Creazione profilo fallita: ${insErr.message}`);
    } else if (existingProfile.primary_role !== data.role) {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ primary_role: data.role })
        .eq("id", u.id);
      if (updErr) throw new Error(`Aggiornamento primary_role fallito: ${updErr.message}`);
    }

    // Ensure user_roles row exists for the target role (idempotent).
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(`Assegnazione ruolo fallita: ${roleErr.message}`);

    console.info("[PUPILLO_ROLE_REPAIR_DEBUG] repaired", {
      user_id: u.id,
      email: u.email,
      assigned_role: data.role,
    });

    return { ok: true, userId: u.id, email: u.email ?? null, role: data.role };
  });