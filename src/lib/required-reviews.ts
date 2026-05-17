import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getShiftEndDate } from "@/lib/announcement-time";

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

/**
 * Turno che richiede un'azione del ristoratore prima di poter contattare nuovi lavoratori.
 *   - `to_close`         → turno con stato `scheduled` ma fine turno già passata
 *   - `review_pending`   → turno con stato `completed` senza recensione del ristoratore
 */
export type ActionShiftKind = "to_close" | "review_pending";

export type ActionShift = {
  shift_id: string;
  announcement_id: string | null;
  application_id: string | null;
  worker_id: string;
  worker_name: string | null;
  worker_role: string | null;
  service_date: string;
  service_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  location_address: string | null;
  kind: ActionShiftKind;
  end_datetime: string | null;
  /** Scadenza recensione: end_datetime + 3 giorni (ISO). */
  review_deadline: string | null;
  /** True quando la scadenza recensione è passata. */
  is_overdue: boolean;
  /** Millisecondi rimanenti fino alla scadenza (negativo se scaduta). */
  ms_until_deadline: number | null;
};

/** Finestra di tolleranza prima del blocco: 3 giorni dalla fine turno. */
export const REVIEW_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function useRequiredReviews() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<RequiredReviewWithMeta[]>([]);
  const [actionShifts, setActionShifts] = useState<ActionShift[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || role !== "restaurant") {
      setItems([]);
      setActionShifts([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Legacy required_reviews list (kept for backwards-compat + email reminders)
    const reqPromise = (supabase as any)
      .from("required_reviews")
      .select("*")
      .eq("restaurant_user_id", user.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true });

    // Restaurant own profile (for venue name)
    const venuePromise = supabase
      .from("profiles")
      .select("business_name, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // All shifts for this restaurant that could require action
    const shiftsPromise = supabase
      .from("shifts")
      .select("id, announcement_id, worker_id, shift_date, status, completed_at")
      .eq("restaurant_id", user.id)
      .in("status", ["scheduled", "completed"]);

    const [{ data: reqData }, { data: venueData }, { data: shiftsData }] = await Promise.all([
      reqPromise,
      venuePromise,
      shiftsPromise,
    ]);

    const reqRows = (reqData ?? []) as RequiredReview[];
    const shifts = (shiftsData ?? []) as Array<{
      id: string;
      announcement_id: string | null;
      worker_id: string;
      shift_date: string;
      status: string;
      completed_at: string | null;
    }>;

    const venueName =
      (venueData as any)?.business_name || (venueData as any)?.full_name || null;

    // Pre-load related announcements + reviews + worker profiles
    const annIds = Array.from(
      new Set(shifts.map((s) => s.announcement_id).filter(Boolean) as string[])
    );
    const workerIds = Array.from(new Set(shifts.map((s) => s.worker_id)));
    const shiftIds = shifts.map((s) => s.id);

    const [{ data: anns }, { data: profs }, { data: reviews }, { data: applications }] =
      await Promise.all([
        annIds.length
          ? supabase
              .from("announcements")
              .select("id, service_date, service_time, end_time, end_date, duration_hours, shift_duration_hours, location_address")
              .in("id", annIds)
          : Promise.resolve({ data: [] as any[] }),
        workerIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, primary_role")
              .in("id", workerIds)
          : Promise.resolve({ data: [] as any[] }),
        shiftIds.length
          ? supabase
              .from("reviews")
              .select("shift_id")
              .eq("author_id", user.id)
              .in("shift_id", shiftIds)
          : Promise.resolve({ data: [] as any[] }),
        shifts.length
          ? supabase
              .from("applications")
              .select("id, announcement_id, worker_id")
              .eq("restaurant_id", user.id)
              .in("worker_id", workerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const annMap = new Map<string, any>();
    (anns ?? []).forEach((a: any) => annMap.set(a.id, a));
    const profMap = new Map<string, any>();
    (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
    const reviewedShiftIds = new Set(
      ((reviews ?? []) as any[]).map((r) => r.shift_id).filter(Boolean)
    );
    const appByPair = new Map<string, string>();
    ((applications ?? []) as any[]).forEach((a) => {
      if (a.announcement_id && a.worker_id) {
        appByPair.set(`${a.announcement_id}:${a.worker_id}`, a.id);
      }
    });

    const now = new Date();
    const action: ActionShift[] = [];

    for (const s of shifts) {
      const ann = s.announcement_id ? annMap.get(s.announcement_id) : null;
      const endDateTime = ann
        ? getShiftEndDate(ann)
        : (() => {
            // Fallback if announcement is missing: treat shift_date end-of-day
            const d = new Date(`${s.shift_date}T23:59:00`);
            return isNaN(d.getTime()) ? null : d;
          })();

      let kind: ActionShiftKind | null = null;
      if (s.status === "scheduled") {
        if (endDateTime && endDateTime.getTime() < now.getTime()) kind = "to_close";
      } else if (s.status === "completed") {
        if (!reviewedShiftIds.has(s.id)) kind = "review_pending";
      }
      if (!kind) continue;

      const prof = profMap.get(s.worker_id);
      const appId =
        s.announcement_id && appByPair.get(`${s.announcement_id}:${s.worker_id}`)
          ? appByPair.get(`${s.announcement_id}:${s.worker_id}`)!
          : null;
      const deadlineMs =
        endDateTime ? endDateTime.getTime() + REVIEW_GRACE_MS : null;
      const isOverdue = deadlineMs != null && now.getTime() >= deadlineMs;
      const msUntilDeadline = deadlineMs != null ? deadlineMs - now.getTime() : null;
      action.push({
        shift_id: s.id,
        announcement_id: s.announcement_id,
        application_id: appId,
        worker_id: s.worker_id,
        worker_name: prof?.full_name ?? null,
        worker_role: prof?.primary_role ?? null,
        service_date: ann?.service_date ?? s.shift_date,
        service_time: ann?.service_time ?? null,
        end_time: ann?.end_time ?? null,
        venue_name: venueName,
        location_address: ann?.location_address ?? null,
        kind,
        end_datetime: endDateTime ? endDateTime.toISOString() : null,
        review_deadline: deadlineMs != null ? new Date(deadlineMs).toISOString() : null,
        is_overdue: isOverdue,
        ms_until_deadline: msUntilDeadline,
      });
    }

    // Sort: oldest end_datetime first
    action.sort((a, b) => (a.end_datetime ?? "").localeCompare(b.end_datetime ?? ""));
    setActionShifts(action);

    // Enrich legacy required_reviews list
    if (reqRows.length === 0) {
      setItems([]);
    } else {
      const reqWorkerIds = Array.from(new Set(reqRows.map((r) => r.worker_user_id)));
      const reqAnnIds = Array.from(new Set(reqRows.map((r) => r.announcement_id).filter(Boolean))) as string[];
      const reqShiftIds = Array.from(new Set(reqRows.map((r) => r.shift_id).filter(Boolean))) as string[];
      const [{ data: pr }, { data: an }, { data: sh }] = await Promise.all([
        reqWorkerIds.length
          ? supabase.from("profiles").select("id, full_name, primary_role").in("id", reqWorkerIds)
          : Promise.resolve({ data: [] as any[] }),
        reqAnnIds.length
          ? supabase.from("announcements").select("id, location_address").in("id", reqAnnIds)
          : Promise.resolve({ data: [] as any[] }),
        reqShiftIds.length
          ? supabase.from("shifts").select("id, shift_date").in("id", reqShiftIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pmap: Record<string, any> = {};
      (pr ?? []).forEach((p: any) => (pmap[p.id] = p));
      const amap: Record<string, any> = {};
      (an ?? []).forEach((a: any) => (amap[a.id] = a));
      const smap: Record<string, any> = {};
      (sh ?? []).forEach((x: any) => (smap[x.id] = x));
      setItems(
        reqRows.map((r) => ({
          ...r,
          worker_name: pmap[r.worker_user_id]?.full_name ?? null,
          worker_role: pmap[r.worker_user_id]?.primary_role ?? null,
          shift_date: r.shift_id ? smap[r.shift_id]?.shift_date ?? null : null,
          announcement_address: r.announcement_id ? amap[r.announcement_id]?.location_address ?? null : null,
        }))
      );
    }

    setLoading(false);
  }, [user, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  // Blocco contatti: scatta SOLO quando almeno un turno ha superato la finestra
  // di tolleranza di 3 giorni dalla fine effettiva del turno. Durante i 3 giorni
  // il ristoratore vede un avviso ma può continuare a usare l'app.
  const overdueShifts = actionShifts.filter((s) => s.is_overdue);
  const warningShifts = actionShifts.filter((s) => !s.is_overdue);
  const isBlocked = overdueShifts.length > 0;
  const blockedCount = overdueShifts.length;
  const warningCount = warningShifts.length;
  const nearestDeadline = actionShifts.reduce<string | null>((acc, s) => {
    if (!s.review_deadline) return acc;
    if (!acc) return s.review_deadline;
    return s.review_deadline < acc ? s.review_deadline : acc;
  }, null);

  return {
    items,
    actionShifts,
    overdueShifts,
    warningShifts,
    loading,
    overdueCount,
    pendingCount,
    isBlocked,
    blockedCount,
    warningCount,
    nearestDeadline,
    refresh,
  };
}

export async function fetchReviewBlockedFlag(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("review_blocked").eq("id", userId).maybeSingle();
  return !!(data as any)?.review_blocked;
}
