import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users, AlertCircle, Briefcase, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { firstNameOnly } from "@/lib/candidate-display";

type Candidate = {
  workerId: string;
  applicationId: string;
  status: string;
  firstName: string;
  primaryRole: string | null;
  reliabilityPct: number | null;
  completedShifts: number | null;
  ratingAvg: number | null;
};

/**
 * Lista "Candidati precedenti" mostrata al ristoratore quando il lavoratore
 * assegnato ha annullato e l'annuncio è tornato disponibile. Esclude:
 *  - il lavoratore che ha annullato (`excludeWorkerId`);
 *  - chi si era già ritirato (`not_interested` / `cancelled`);
 *  - chi è stato rifiutato (`rejected`);
 *  - profili eliminati/disattivati.
 */
export function PreviousCandidatesSection(props: {
  announcementId: string;
  excludeWorkerId: string | null;
  className?: string;
}) {
  const { announcementId, excludeWorkerId } = props;
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      const { data: apps } = await supabase
        .from("applications")
        .select("id, worker_id, status")
        .eq("announcement_id", announcementId);
      const rows = (apps ?? []) as any[];
      const excluded = new Set(["not_interested", "cancelled", "rejected"]);
      const workerIds = Array.from(
        new Set(
          rows
            .filter((a) => a.worker_id && a.worker_id !== excludeWorkerId)
            .filter((a) => !excluded.has(String(a.status)))
            .map((a) => a.worker_id as string),
        ),
      );
      if (workerIds.length === 0) {
        if (!aborted) { setCandidates([]); setLoading(false); }
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, primary_role, reliability_pct, completed_shifts, rating_avg, is_deleted")
        .in("id", workerIds);
      const validProfiles = ((profiles ?? []) as any[]).filter((p) => !p.is_deleted);
      const byId = new Map(validProfiles.map((p) => [p.id, p]));
      const items: Candidate[] = rows
        .filter((a) => byId.has(a.worker_id) && a.worker_id !== excludeWorkerId)
        .filter((a) => !excluded.has(String(a.status)))
        .map((a) => {
          const p = byId.get(a.worker_id)!;
          return {
            workerId: a.worker_id,
            applicationId: a.id,
            status: String(a.status),
            firstName: firstNameOnly((p.first_name as string) || (p.full_name as string)),
            primaryRole: (p.primary_role as string | null) ?? null,
            reliabilityPct: (p.reliability_pct as number | null) ?? null,
            completedShifts: (p.completed_shifts as number | null) ?? null,
            ratingAvg: (p.rating_avg as number | null) ?? null,
          };
        });
      // Dedup by worker keeping the latest row.
      const seen = new Set<string>();
      const unique = items.filter((c) => (seen.has(c.workerId) ? false : (seen.add(c.workerId), true)));
      if (!aborted) { setCandidates(unique); setLoading(false); }
    })();
    return () => { aborted = true; };
  }, [announcementId, excludeWorkerId]);

  return (
    <div className={`rounded-2xl border bg-card p-5 ${props.className ?? ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
        <div className="text-sm font-semibold">Candidati già interessati</div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Il lavoratore selezionato ha annullato. Puoi scegliere un altro candidato tra
        quelli che si erano già candidati oppure cercare nuovi lavoratori.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Caricamento candidati…</div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
          <div>
            Nessun candidato precedente disponibile.
            <div className="mt-2">
              <Link to="/workers">
                <Button size="sm" variant="outline">Cerca nuovi lavoratori</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3">
          {candidates.map((c) => (
            <li key={c.workerId} className="rounded-xl border bg-background p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.firstName}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.primaryRole && (
                    <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{c.primaryRole}</span>
                  )}
                  {typeof c.reliabilityPct === "number" && (c.completedShifts ?? 0) >= 3 && (
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Affidabilità {c.reliabilityPct}%</span>
                  )}
                  {typeof c.completedShifts === "number" && c.completedShifts > 0 && (
                    <span>{c.completedShifts} servizi</span>
                  )}
                  {typeof c.ratingAvg === "number" && c.ratingAvg > 0 && (
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{c.ratingAvg.toFixed(1)}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to="/workers/$id" params={{ id: c.workerId }}>
                  <Button size="sm" variant="outline">Vedi profilo</Button>
                </Link>
                <Link to="/workers/$id" params={{ id: c.workerId }}>
                  <Button size="sm">Invita di nuovo</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Link to="/workers">
          <Button size="sm" variant="ghost">Cerca nuovi lavoratori →</Button>
        </Link>
      </div>
    </div>
  );
}