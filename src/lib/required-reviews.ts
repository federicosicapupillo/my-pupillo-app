import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type RequiredReview = {
  id: string;
  restaurant_user_id: string;
  worker_user_id: string;
  shift_id: string | null;
  application_id: string | null;
  announcement_id: string | null;
  status: "pending" | "overdue" | "completed" | "dismissed_by_admin";
  due_date: string;
  completed_at: string | null;
  created_at: string;
};

export type RequiredReviewWithMeta = RequiredReview & {
  worker_name?: string | null;
  worker_role?: string | null;
  shift_date?: string | null;
  announcement_address?: string | null;
};

export function useRequiredReviews() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<RequiredReviewWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || role !== "restaurant") {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("required_reviews")
      .select("*")
      .eq("restaurant_user_id", user.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true });
    const rows = (data ?? []) as RequiredReview[];
    if (rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const workerIds = Array.from(new Set(rows.map((r) => r.worker_user_id)));
    const annIds = Array.from(new Set(rows.map((r) => r.announcement_id).filter(Boolean))) as string[];
    const shiftIds = Array.from(new Set(rows.map((r) => r.shift_id).filter(Boolean))) as string[];
    const [{ data: profs }, { data: anns }, { data: shifts }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, primary_role").in("id", workerIds),
      annIds.length
        ? supabase.from("announcements").select("id, location_address").in("id", annIds)
        : Promise.resolve({ data: [] as any[] }),
      shiftIds.length
        ? supabase.from("shifts").select("id, shift_date").in("id", shiftIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => (pmap[p.id] = p));
    const amap: Record<string, any> = {};
    (anns ?? []).forEach((a: any) => (amap[a.id] = a));
    const smap: Record<string, any> = {};
    (shifts ?? []).forEach((s: any) => (smap[s.id] = s));
    setItems(
      rows.map((r) => ({
        ...r,
        worker_name: pmap[r.worker_user_id]?.full_name ?? null,
        worker_role: pmap[r.worker_user_id]?.primary_role ?? null,
        shift_date: r.shift_id ? smap[r.shift_id]?.shift_date ?? null : null,
        announcement_address: r.announcement_id ? amap[r.announcement_id]?.location_address ?? null : null,
      }))
    );
    setLoading(false);
  }, [user, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return { items, loading, overdueCount, pendingCount, isBlocked: overdueCount > 0, refresh };
}

export async function fetchReviewBlockedFlag(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("review_blocked").eq("id", userId).maybeSingle();
  return !!(data as any)?.review_blocked;
}