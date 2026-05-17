/**
 * Pure helpers around the worker Reputation Score.
 *
 * The numeric score and badges are computed in the database by
 * `public.recompute_worker_reputation()` and cached on the `profiles` row.
 * This module turns those cached values into UI-friendly labels and tips.
 */

export type ReputationLevel = "new" | "new_verified" | "basic" | "pro" | "elite";

export const REPUTATION_BADGE_KEYS = [
  "puntuale",
  "affidabile",
  "ricontattato",
  "comunicazione_rapida",
  "profilo_verificato",
  "zero_no_show",
  "molto_richiesto",
  "top_servizio",
  "recensioni_eccellenti",
] as const;
export type ReputationBadge = (typeof REPUTATION_BADGE_KEYS)[number];

export const BADGE_LABELS: Record<ReputationBadge, string> = {
  puntuale: "Puntuale",
  affidabile: "Affidabile",
  ricontattato: "Ricontattato",
  comunicazione_rapida: "Comunicazione rapida",
  profilo_verificato: "Profilo verificato",
  zero_no_show: "Zero no-show",
  molto_richiesto: "Molto richiesto",
  top_servizio: "Top servizio",
  recensioni_eccellenti: "Recensioni eccellenti",
};

export const LEVEL_LABELS: Record<ReputationLevel, string> = {
  new: "Nuovo",
  new_verified: "Nuovo verificato",
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
};

/** Tailwind classes for the small level chip. */
export function levelChipClass(level: ReputationLevel): string {
  switch (level) {
    case "elite":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "pro":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "basic":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
    case "new_verified":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export type WorkerReputationInput = {
  reputation_score?: number | null;
  reputation_level?: string | null;
  completed_shifts?: number | null;
  no_show_count?: number | null;
  punctuality_pct?: number | null;
  completion_pct?: number | null;
  rehire_restaurants_count?: number | null;
  rehire_yes_count?: number | null;
  rehire_total_answers?: number | null;
  distinct_restaurants_count?: number | null;
  rating_avg?: number | null;
  reviews_count?: number | null;
  avatar_url?: string | null;
  phone_verified?: boolean | null;
  profile_completed?: boolean | null;
  id_document_path?: string | null;
};

export type ReputationSummary = {
  level: ReputationLevel;
  levelLabel: string;
  score: number;
  showScore: boolean;
  isNew: boolean;
  rehirePct: number | null;
  punctualityPct: number;
  completionPct: number;
  completedShifts: number;
  noShow: number;
  rehireRestaurants: number;
  distinctRestaurants: number;
  rating: number;
  reviewsCount: number;
};

/** Normalise the cached profile fields into a UI-ready summary. */
export function summarizeReputation(p: WorkerReputationInput): ReputationSummary {
  const completed = Number(p.completed_shifts ?? 0);
  const lvlRaw = (p.reputation_level ?? "new") as string;
  const level: ReputationLevel = (
    ["new", "new_verified", "basic", "pro", "elite"] as const
  ).includes(lvlRaw as ReputationLevel)
    ? (lvlRaw as ReputationLevel)
    : "new";
  const isNew = completed < 3;
  const rehireTotal = Number(p.rehire_total_answers ?? 0);
  const rehireYes = Number(p.rehire_yes_count ?? 0);
  const isNewLevel = level === "new" || level === "new_verified";
  return {
    level,
    levelLabel: LEVEL_LABELS[level],
    score: Math.max(0, Math.min(100, Number(p.reputation_score ?? 0))),
    showScore: !isNew && !isNewLevel,
    isNew: isNew || isNewLevel,
    rehirePct: rehireTotal > 0 ? Math.round((rehireYes * 100) / rehireTotal) : null,
    punctualityPct: Math.max(0, Math.min(100, Number(p.punctuality_pct ?? 0))),
    completionPct: Math.max(0, Math.min(100, Number(p.completion_pct ?? 0))),
    completedShifts: completed,
    noShow: Number(p.no_show_count ?? 0),
    rehireRestaurants: Number(p.rehire_restaurants_count ?? 0),
    distinctRestaurants: Number(p.distinct_restaurants_count ?? 0),
    rating: Number(p.rating_avg ?? 0),
    reviewsCount: Number(p.reviews_count ?? 0),
  };
}

/** Actionable tips to grow the score, prioritised by current weakness. */
export function reputationTips(s: ReputationSummary): string[] {
  const tips: string[] = [];
  if (s.completedShifts < 3) {
    tips.push("Completa i primi servizi per sbloccare il tuo Reputation Score.");
  }
  if (s.punctualityPct < 90) {
    tips.push("Arriva puntuale per migliorare la sezione puntualità.");
  }
  if (s.completionPct < 90 && s.completedShifts > 0) {
    tips.push("Completa i servizi che accetti: evita cancellazioni e abbandoni.");
  }
  if (s.noShow > 0) {
    tips.push("Evita di accettare servizi a cui non puoi presentarti.");
  }
  if (s.rating > 0 && s.rating < 4.5) {
    tips.push("Cura il comportamento e la qualità del servizio per migliorare le recensioni.");
  }
  if (s.rehirePct != null && s.rehirePct < 80) {
    tips.push("Lavora bene e in modo costante: i ristoratori che ti richiamano contano molto.");
  }
  tips.push("Rispondi rapidamente ai messaggi e mantieni il profilo sempre aggiornato.");
  return tips.slice(0, 5);
}

/** Tailwind text class for the numeric score (red/amber/green). */
export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score > 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}