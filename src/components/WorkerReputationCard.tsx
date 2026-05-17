import { useEffect, useState } from "react";
import { Award, Star, Clock, CheckCircle2, Users, RefreshCw, ShieldCheck } from "lucide-react";
import {
  summarizeReputation,
  levelChipClass,
  scoreColorClass,
  reputationTips,
  BADGE_LABELS,
  type ReputationBadge,
  type WorkerReputationInput,
} from "@/lib/reputation";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  workerId: string;
  profile: WorkerReputationInput;
  /** If true, also render the "Come migliorare il tuo punteggio" suggestions block. */
  showTips?: boolean;
  className?: string;
};

/**
 * Full reputation breakdown shown on the worker detail page (restaurant view)
 * and inside the worker's own profile under "La mia reputazione".
 */
export function WorkerReputationCard({ workerId, profile, showTips = false, className = "" }: Props) {
  const s = summarizeReputation(profile);
  const [badges, setBadges] = useState<ReputationBadge[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("worker_badges")
        .select("badge")
        .eq("worker_id", workerId);
      if (cancelled) return;
      const list = ((data ?? []) as { badge: string }[])
        .map((b) => b.badge as ReputationBadge)
        .filter((b) => (BADGE_LABELS as Record<string, string>)[b]);
      setBadges(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  return (
    <div className={`rounded-2xl border bg-card p-5 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Reputation Score
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Punteggio basato su servizi reali, puntualità, recensioni e ricontatti.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${levelChipClass(s.level)}`}
        >
          {s.levelLabel}
        </span>
      </div>

      {s.showScore ? (
        <div className="flex items-end gap-3">
          <div className={`text-4xl font-bold tabular-nums ${scoreColorClass(s.score)}`}>{s.score}</div>
          <div className="text-sm text-muted-foreground mb-1">/100</div>
          {s.rating > 0 && (
            <div className="ml-auto inline-flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">{s.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">/5 · {s.reviewsCount} rec.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
          <div className="font-medium">Profilo {s.level === "new_verified" ? "verificato" : "nuovo"}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Il Reputation Score verrà mostrato dopo i primi 3 servizi completati.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Metric icon={CheckCircle2} label="Servizi" value={String(s.completedShifts)} />
        <Metric icon={Clock} label="Puntualità" value={`${s.punctualityPct}%`} />
        <Metric icon={RefreshCw} label="Ricontattato da" value={`${s.rehireRestaurants}`} />
        <Metric
          icon={Users}
          label="Lo richiamerebbe"
          value={s.rehirePct != null ? `${s.rehirePct}%` : "—"}
        />
      </div>

      {s.noShow > 0 && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {s.noShow} no-show registrati
        </div>
      )}

      {badges.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">Badge ottenuti</div>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium"
              >
                <ShieldCheck className="h-3 w-3" />
                {BADGE_LABELS[b]}
              </span>
            ))}
          </div>
        </div>
      )}

      {showTips && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-sm font-semibold mb-1">Come migliorare il tuo punteggio</div>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {reputationTips(s).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            La tua reputazione cresce quando completi i servizi, sei puntuale, ricevi buone recensioni
            e mantieni un comportamento professionale.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Award;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}