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

const PROFILE_SELECT = [
  "id",
  "avatar_url",
  "id_document_path",
  "id_document_back_path",
].join(",");

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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
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
    });

    if (feedbackError) throw feedbackError;

    const { error: rpcError, data } = await supabaseAdmin.rpc("delete_my_account", {
      _reason: reason,
      _custom_reason: reason === "altro" ? customReason?.trim().slice(0, 500) || null : null,
    });

    if (rpcError) throw rpcError;
    const rpcResult = data as DeletionResult | null;
    if (!rpcResult?.ok) {
      console.error("[deleteAccount] delete_my_account returned failure", rpcResult);
      return rpcResult ?? { ok: false, error_code: "delete_failed" };
    }

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