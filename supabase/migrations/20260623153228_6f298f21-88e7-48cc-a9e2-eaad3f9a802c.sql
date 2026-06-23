-- Phase 1: Blind reciprocal review — schema only.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  -- 1) direction column (nullable + temp default for backfill)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'direction'
  ) THEN
    ALTER TABLE public.reviews
      ADD COLUMN direction text DEFAULT 'worker_to_restaurant';
  END IF;

  -- 2) visible_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'visible_at'
  ) THEN
    ALTER TABLE public.reviews
      ADD COLUMN visible_at timestamptz NULL;
  END IF;
END$$;

-- 3) Flip defaults for visibility flags (existing rows untouched).
ALTER TABLE public.reviews ALTER COLUMN is_visible_to_worker SET DEFAULT false;
ALTER TABLE public.reviews ALTER COLUMN is_visible_to_restaurants SET DEFAULT false;

-- 4) Backfill direction from user_roles (idempotent — only rows still NULL or with temp default).
UPDATE public.reviews r
SET direction = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = r.author_id AND ur.role = 'restaurant'
  ) THEN 'restaurant_to_worker'
  ELSE 'worker_to_restaurant'
END
WHERE r.direction IS NULL
   OR r.direction NOT IN ('worker_to_restaurant', 'restaurant_to_worker');

-- 5) Add CHECK constraint (idempotent) and finalize NOT NULL without default.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_direction_check' AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_direction_check
      CHECK (direction IN ('worker_to_restaurant', 'restaurant_to_worker'));
  END IF;
END$$;

ALTER TABLE public.reviews ALTER COLUMN direction SET NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN direction DROP DEFAULT;