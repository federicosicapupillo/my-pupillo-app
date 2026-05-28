import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMAIL = "admin.test@pupillo.test";
const PASSWORD = "Test1234!";

export const Route = createFileRoute("/api/public/bootstrap-admin-test")({
  server: {
    handlers: {
      POST: async () => {
        const result: Record<string, unknown> = { email: EMAIL };

        // 1. Find or create the auth user.
        let userId: string | null = null;
        const { data: list, error: listErr } =
          await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (listErr) return json({ error: listErr.message }, 500);
        const existing = list.users.find(
          (u) => u.email?.toLowerCase() === EMAIL,
        );
        if (existing) {
          userId = existing.id;
          result.auth_user = "existing";
          // Ensure email confirmed + password set.
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: PASSWORD,
            email_confirm: true,
          });
        } else {
          const { data: created, error: createErr } =
            await supabaseAdmin.auth.admin.createUser({
              email: EMAIL,
              password: PASSWORD,
              email_confirm: true,
            });
          if (createErr || !created.user)
            return json({ error: createErr?.message ?? "create failed" }, 500);
          userId = created.user.id;
          result.auth_user = "created";
        }

        // 2. Ensure profile row exists & marked complete + phone verified.
        await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            email: EMAIL,
            full_name: "Admin Test",
            first_name: "Admin",
            last_name: "Test",
            profile_completed: true,
            phone_verified: true,
            terms_accepted: true,
            account_status: "active",
            is_deleted: false,
          },
          { onConflict: "id" },
        );

        // 3. Ensure admin role.
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const hasAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
        if (!hasAdmin) {
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: "admin" });
          if (roleErr) result.role_insert_error = roleErr.message;
        }

        // 4. Verify.
        const { data: verifyRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        result.user_id = userId;
        result.roles = (verifyRoles ?? []).map((r: any) => r.role);
        result.is_admin = result.roles && (result.roles as string[]).includes("admin");
        return json(result, 200);
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}