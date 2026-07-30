import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const workerAvailabilityStatusKey = (userId: string | null | undefined) =>
  ["worker-availability-status", userId ?? "anon"] as const;

type AvailabilityCheckRow = {
  start_time: string | null;
  end_time: string | null;
  is_flexible: boolean | null;
  is_last_minute: boolean | null;
};

/** Una riga è valida se è flessibile/last-minute oppure ha un intervallo orario completo. */
export function isValidAvailabilityRow(r: AvailabilityCheckRow): boolean {
  if (r.is_flexible || r.is_last_minute) return true;
  return !!(r.start_time && r.end_time);
}

/**
 * Legge `worker_availability` per il lavoratore corrente e dice se esiste
 * almeno una disponibilità valida. Query condivisa (stessa key) tra dashboard
 * e pagina "Le mie disponibilità" per evitare letture duplicate.
 */
export function useWorkerAvailabilityStatus(userId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: workerAvailabilityStatusKey(userId),
    enabled: !!userId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("worker_availability")
        .select("start_time, end_time, is_flexible, is_last_minute")
        .eq("worker_id", userId as string);
      if (error) throw error;
      return ((data ?? []) as AvailabilityCheckRow[]).some(isValidAvailabilityRow);
    },
  });

  return {
    hasAvailability: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  };
}

export function useInvalidateWorkerAvailabilityStatus() {
  const qc = useQueryClient();
  return (userId: string | null | undefined) =>
    qc.invalidateQueries({ queryKey: workerAvailabilityStatusKey(userId) });
}
