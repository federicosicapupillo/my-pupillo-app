import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function deleteAuthUserSafely(userId: string) {
  return supabaseAdmin.auth.admin.deleteUser(userId);
}