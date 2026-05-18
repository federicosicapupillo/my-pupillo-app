/**
 * Shared catalogue of behavioural labels that restaurateurs can attach to a
 * worker review. These feed into:
 *  - the review picker UI (chat dialog, shifts page, shift detail)
 *  - the review display (worker reviews list, restaurant view, dashboard)
 *  - the worker reputation score (positives give a small bonus, negatives a
 *    small penalty; stars remain the primary driver).
 */

export const POSITIVE_REVIEW_LABELS = [
  "Puntuale",
  "Affidabile",
  "Professionale",
  "Preciso",
  "Veloce",
  "Gentile con i clienti",
  "Autonomo",
  "Ordinato",
  "Collaborativo",
  "Buona comunicazione",
  "Ottima presenza",
  "Sa lavorare sotto pressione",
  "Rispetta le istruzioni",
  "Consigliato",
] as const;

export const NEGATIVE_REVIEW_LABELS = [
  "In ritardo",
  "Poco preciso",
  "Comunicazione da migliorare",
  "Necessita supervisione",
  "Non sempre autonomo",
  "Dress code non rispettato",
  "Ritmo di lavoro da migliorare",
  "Atteggiamento da migliorare",
  "Istruzioni non seguite",
  "Assenza non giustificata",
] as const;

export type PositiveReviewLabel = (typeof POSITIVE_REVIEW_LABELS)[number];
export type NegativeReviewLabel = (typeof NEGATIVE_REVIEW_LABELS)[number];

export const MAX_REVIEW_LABELS = 5;

const POSITIVE_SET = new Set<string>(POSITIVE_REVIEW_LABELS);
const NEGATIVE_SET = new Set<string>(NEGATIVE_REVIEW_LABELS);

export function isPositiveLabel(label: string): boolean {
  return POSITIVE_SET.has(label);
}

export function isNegativeLabel(label: string): boolean {
  return NEGATIVE_SET.has(label);
}

/** Split a mixed list into known positive/negative labels (unknown values dropped). */
export function splitLabels(labels: string[] | null | undefined): {
  positive: string[];
  negative: string[];
} {
  const positive: string[] = [];
  const negative: string[] = [];
  for (const l of labels ?? []) {
    if (POSITIVE_SET.has(l)) positive.push(l);
    else if (NEGATIVE_SET.has(l)) negative.push(l);
  }
  return { positive, negative };
}