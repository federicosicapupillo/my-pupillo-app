import { supabase } from "@/integrations/supabase/client";

/**
 * Multi-position helpers for announcements.
 *
 * Source of truth:
 *   - `workers_needed` lives on `job_requests` (joined via announcement_id, fallback 1).
 *   - "Filled" = number of applications with status='accepted' for that announcement.
 */

export function isAnnouncementFull(workersNeeded: number | null | undefined, filled: number): boolean {
  const needed = Math.max(1, Number(workersNeeded ?? 1) || 1);
  return filled >= needed;
}

export function positionsLabel(workersNeeded: number | null | undefined, filled: number): string {
  const needed = Math.max(1, Number(workersNeeded ?? 1) || 1);
  if (filled >= needed) return `${needed}/${needed} posizioni assegnate — completo`;
  return `${filled}/${needed} posizioni assegnate`;
}

export async function fetchWorkersNeededMap(annIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!annIds.length) return out;
  const { data } = await supabase
    .from("job_requests")
    .select("announcement_id, workers_needed")
    .in("announcement_id", annIds);
  (data ?? []).forEach((r: any) => {
    if (r.announcement_id) {
      const n = Math.max(1, Number(r.workers_needed ?? 1) || 1);
      // keep largest if multiple job_requests rows share announcement_id
      out[r.announcement_id] = Math.max(out[r.announcement_id] ?? 0, n);
    }
  });
  return out;
}

export async function fetchAcceptedWorkerIds(annId: string): Promise<string[]> {
  const { data } = await supabase
    .from("applications")
    .select("worker_id")
    .eq("announcement_id", annId)
    .eq("status", "accepted");
  return (data ?? []).map((r: any) => r.worker_id).filter(Boolean);
}