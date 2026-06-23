/**
 * Restaurant Reputation Score
 *
 * Computes a 0-100 score for a restaurant from the reviews left by workers
 * (direction worker_to_restaurant). Used inside the restaurant dashboard.
 *
 * Weights:
 *   - Average rating (1-5 → 0-100)                : 50%
 *   - Number of reviews received (graduale fino a 20): 15%
 *   - Shift reliability (completed vs cancelled)  : 20%
 *   - Organisational quality (positive vs negative tags): 15%
 */

export const RESTAURANT_POSITIVE_TAGS = [
  "Comunicazione chiara",
  "Ambiente positivo",
  "Pagamento corretto",
  "Organizzazione buona",
  "Istruzioni chiare",
  "Rispetto degli accordi",
] as const;

export const RESTAURANT_NEGATIVE_TAGS = [
  "Da migliorare organizzazione",
  "Informazioni poco chiare",
] as const;

const POS_SET = new Set<string>(RESTAURANT_POSITIVE_TAGS);
const NEG_SET = new Set<string>(RESTAURANT_NEGATIVE_TAGS);

export type RestaurantReviewLike = {
  rating: number | null;
  positive_tags?: string[] | null;
  negative_tags?: string[] | null;
  tags?: string[] | null;
  /**
   * Blind-review visibility. A review only counts toward the public
   * Reputation Score after both parties have left their review (Phase 2
   * trigger sets `visible_at` and flips `is_visible_to_restaurants` to
   * `true`). Locked rows are excluded from the aggregate so a single
   * unreciprocated review can never sway the score.
   */
  visible_at?: string | null;
  is_visible_to_restaurants?: boolean | null;
};

/** Whether a worker→restaurant review can contribute to the public score. */
export function isRestaurantReviewVisibleForPublic(r: RestaurantReviewLike): boolean {
  if (r.visible_at === null) return false;
  if (r.is_visible_to_restaurants === false) return false;
  return true;
}

export type ShiftReliabilityInput = {
  total: number;
  completed: number;
  cancelled: number;
};

export type RestaurantReputationResult = {
  score: number;
  ratingAvg: number;
  reviewsCount: number;
  completionPct: number;
  topPositiveTag: string | null;
  topPositiveTags: string[];
  topNegativeTags: string[];
  isInConstruction: boolean;
  badgeLabel: string;
  badgeClass: string;
  description: string;
};

function badge(score: number): { label: string; cls: string; desc: string } {
  if (score >= 90)
    return {
      label: "Eccellente",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      desc: "Reputazione eccellente — sei tra i locali più apprezzati dai lavoratori.",
    };
  if (score >= 80)
    return {
      label: "Locale affidabile",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      desc: "Locale affidabile — i lavoratori parlano bene della tua organizzazione.",
    };
  if (score >= 65)
    return {
      label: "Buona reputazione",
      cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      desc: "Buona reputazione — continua così per crescere ulteriormente.",
    };
  if (score >= 50)
    return {
      label: "Da migliorare",
      cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
      desc: "Reputazione da migliorare — cura l'organizzazione e la comunicazione.",
    };
  return {
    label: "Attenzione",
    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    desc: "La reputazione è bassa — è importante intervenire sui punti segnalati.",
  };
}

export function calculateRestaurantReputationScore(
  reviews: RestaurantReviewLike[],
  reliability: ShiftReliabilityInput = { total: 0, completed: 0, cancelled: 0 },
): RestaurantReputationResult {
  // Blind reciprocal review: only count rows the DB has already unlocked.
  const publicReviews = reviews.filter(isRestaurantReviewVisibleForPublic);
  const validRatings = publicReviews
    .map((r) => Number(r.rating ?? 0))
    .filter((n) => n > 0);
  const reviewsCount = validRatings.length;
  const ratingAvg =
    reviewsCount > 0
      ? validRatings.reduce((a, b) => a + b, 0) / reviewsCount
      : 0;

  // 1. Average rating → 0-100, weight 50
  const ratingScore = (Math.max(0, Math.min(5, ratingAvg)) / 5) * 100;

  // 2. Volume — graduale fino a 20 recensioni, weight 15
  const volumeScore = Math.min(1, reviewsCount / 20) * 100;

  // 3. Reliability — completed / total, weight 20
  const completionPct =
    reliability.total > 0
      ? Math.round((reliability.completed / reliability.total) * 100)
      : 0;
  const reliabilityScore = reliability.total > 0 ? completionPct : 75; // neutral baseline

  // 4. Tag balance, weight 15
  const posCount: Record<string, number> = {};
  const negCount: Record<string, number> = {};
  let posTotal = 0;
  let negTotal = 0;
  for (const r of publicReviews) {
    const all = [
      ...(r.positive_tags ?? []),
      ...(r.negative_tags ?? []),
      ...(r.tags ?? []),
    ];
    for (const t of all) {
      if (POS_SET.has(t)) {
        posCount[t] = (posCount[t] ?? 0) + 1;
        posTotal++;
      } else if (NEG_SET.has(t)) {
        negCount[t] = (negCount[t] ?? 0) + 1;
        negTotal++;
      }
    }
  }
  // Start from 70 baseline, +2 per positive (cap +25), -4 per negative (cap -20).
  let orgScore = 70 + Math.min(25, posTotal * 2) - Math.min(20, negTotal * 4);
  orgScore = Math.max(0, Math.min(100, orgScore));

  const raw =
    ratingScore * 0.5 +
    volumeScore * 0.15 +
    reliabilityScore * 0.2 +
    orgScore * 0.15;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const topPositiveTags = Object.entries(posCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const topNegativeTags = Object.entries(negCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const b = badge(score);
  return {
    score,
    ratingAvg,
    reviewsCount,
    completionPct,
    topPositiveTag: topPositiveTags[0] ?? null,
    topPositiveTags,
    topNegativeTags,
    isInConstruction: reviewsCount < 3,
    badgeLabel: b.label,
    badgeClass: b.cls,
    description: b.desc,
  };
}

export function isRestaurantPositiveTag(t: string) {
  return POS_SET.has(t);
}
export function isRestaurantNegativeTag(t: string) {
  return NEG_SET.has(t);
}