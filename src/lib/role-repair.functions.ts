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

export type RoleMismatchReport = {
  authUsers: number;
  profiles: number;
  userRoles: number;
  authWithoutRole: Array<{ id: string; email: string | null; metaRole: string | null; createdAt: string }>;
  authWithoutProfile: Array<{ id: string; email: string | null; metaRole: string | null }>;
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
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (authErr) throw new Error(authErr.message);

    const profileIds = new Set((profilesRes.data ?? []).map((r: any) => r.id));
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const authIds = new Set((authList.users ?? []).map((u) => u.id));

    const authWithoutRole = (authList.users ?? [])
      .filter((u) => !rolesByUser.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        metaRole: (u.user_metadata?.role as string) ?? null,
        createdAt: u.created_at ?? "",
      }));
    const authWithoutProfile = (authList.users ?? [])
      .filter((u) => !profileIds.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email ?? null,
        metaRole: (u.user_metadata?.role as string) ?? null,
      }));

    let orphanProfiles = 0;
    for (const id of profileIds) if (!authIds.has(id)) orphanProfiles++;
    let orphanRoles = 0;
    for (const uid of rolesByUser.keys()) if (!authIds.has(uid)) orphanRoles++;

    const admins = (authList.users ?? [])
      .filter((u) => (rolesByUser.get(u.id) ?? []).includes("admin"))
      .map((u) => ({ id: u.id, email: u.email ?? null }));

    return {
      authUsers: authList.users?.length ?? 0,
      profiles: profileIds.size,
      userRoles: rolesRes.data?.length ?? 0,
      authWithoutRole,
      authWithoutProfile,
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

    // Ensure profile exists.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
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
    } else if (data.role === "admin") {
      await supabaseAdmin.from("profiles").update({ primary_role: "admin" }).eq("id", u.id);
    }

    // Insert role row (idempotent).
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(`Assegnazione ruolo fallita: ${roleErr.message}`);

    return { ok: true, userId: u.id, email: u.email ?? null, role: data.role };
  });