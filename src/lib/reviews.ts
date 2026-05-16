// Helper puri (no I/O) condivisi tra UI ristoratore, UI lavoratore e tests.
// Estesi su 5 parametri specifici: puntualità, professionalità, competenza,
// affidabilità, collaborazione. Ogni parametro è valutato 1–5.

export type ReviewCriterion =
  | "punctuality"
  | "professionalism"
  | "competence"
  | "reliability"
  | "teamwork";

export const REVIEW_CRITERIA: ReviewCriterion[] = [
  "punctuality",
  "professionalism",
  "competence",
  "reliability",
  "teamwork",
];

export const CRITERION_LABEL: Record<ReviewCriterion, string> = {
  punctuality: "Puntualità",
  professionalism: "Professionalità",
  competence: "Competenza nel ruolo",
  reliability: "Affidabilità",
  teamwork: "Collaborazione con il team",
};

export type ReviewScores = Partial<Record<ReviewCriterion, number>>;

// Media complessiva: somma dei parametri valorizzati / quanti.
// Restituisce null se nessun parametro è stato valutato.
export function computeOverallRating(scores: ReviewScores): number | null {
  const vals: number[] = [];
  for (const k of REVIEW_CRITERIA) {
    const v = scores[k];
    if (typeof v === "number" && v >= 1 && v <= 5) vals.push(v);
  }
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10; // 1 decimale
}

// Effetto celebrativo lato lavoratore.
export type CelebrationTier = "excellent" | "good" | "neutral" | "constructive";

export function celebrationTier(overall: number | null): CelebrationTier {
  if (overall == null) return "neutral";
  if (overall >= 4.5) return "excellent";
  if (overall >= 4.0) return "good";
  if (overall >= 3.0) return "neutral";
  return "constructive";
}

export const TIER_TEXT: Record<CelebrationTier, { title: string; subtitle: string }> = {
  excellent: {
    title: "Ottimo lavoro!",
    subtitle: "Hai ricevuto una valutazione eccellente.",
  },
  good: {
    title: "Bella valutazione!",
    subtitle: "Continua così.",
  },
  neutral: {
    title: "Hai ricevuto una nuova valutazione",
    subtitle: "Leggi il dettaglio qui sotto.",
  },
  constructive: {
    title: "Hai ricevuto una valutazione",
    subtitle: "Leggi il feedback per migliorare.",
  },
};

// Badge reputazionali calcolati dalle medie del profilo.
export type WorkerBadgeKind =
  | "always_on_time"
  | "reliable"
  | "team_player"
  | "verified_pro";

export type WorkerStats = {
  rating_avg: number;
  reviews_count: number;
  avg_punctuality: number;
  avg_professionalism: number;
  avg_competence: number;
  avg_reliability: number;
  avg_teamwork: number;
};

export const BADGE_LABEL: Record<WorkerBadgeKind, string> = {
  always_on_time: "Sempre puntuale",
  reliable: "Affidabile",
  team_player: "Top Team Player",
  verified_pro: "Professionista verificato",
};

// I badge si sbloccano solo dopo un minimo di evidenza statistica
// (≥3 recensioni per i badge di parametro), così evitiamo che una
// singola valutazione 5/5 sblocchi tutto.
const MIN_REVIEWS_FOR_PARAM_BADGE = 3;

export function computeWorkerBadges(stats: WorkerStats): WorkerBadgeKind[] {
  const out: WorkerBadgeKind[] = [];
  if (stats.reviews_count >= MIN_REVIEWS_FOR_PARAM_BADGE) {
    if (stats.avg_punctuality > 4.7) out.push("always_on_time");
    if (stats.avg_reliability > 4.7) out.push("reliable");
    if (stats.avg_teamwork > 4.7) out.push("team_player");
  }
  if (stats.reviews_count >= 10 && stats.rating_avg > 4.5) {
    out.push("verified_pro");
  }
  return out;
}