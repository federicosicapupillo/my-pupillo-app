-- Deduplicate required review rows for the same shift/restaurant/worker before adding the constraint.
WITH ranked_required_reviews AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY shift_id, restaurant_user_id, worker_user_id
      ORDER BY
        CASE WHEN review_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE status WHEN 'completed' THEN 0 WHEN 'overdue' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
        updated_at DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.required_reviews
  WHERE shift_id IS NOT NULL
)
DELETE FROM public.required_reviews rr
USING ranked_required_reviews ranked
WHERE rr.id = ranked.id
  AND ranked.rn > 1;

-- Deduplicate actual reviews for the same shift/restaurant/worker before adding the constraint.
WITH ranked_reviews AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY shift_id, author_id, target_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.reviews
  WHERE shift_id IS NOT NULL
)
DELETE FROM public.reviews r
USING ranked_reviews ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

-- Replace partial unique indexes with real unique constraints that can be used by ON CONFLICT.
DROP INDEX IF EXISTS public.required_reviews_shift_id_unique;
DROP INDEX IF EXISTS public.uniq_required_reviews_shift;
DROP INDEX IF EXISTS public.uniq_reviews_shift_author;

ALTER TABLE public.required_reviews
  DROP CONSTRAINT IF EXISTS required_reviews_shift_restaurant_worker_unique;

ALTER TABLE public.required_reviews
  ADD CONSTRAINT required_reviews_shift_restaurant_worker_unique
  UNIQUE (shift_id, restaurant_user_id, worker_user_id);

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_shift_author_target_unique;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_shift_author_target_unique
  UNIQUE (shift_id, author_id, target_id);

-- Recreate the automatic required-review function with an ON CONFLICT target
-- that exactly matches the unique constraint above.
CREATE OR REPLACE FUNCTION public.create_required_review_on_shift_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app_id uuid;
BEGIN
  IF NEW.status <> 'completed'::shift_status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'completed'::shift_status THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NULL OR NEW.restaurant_id IS NULL OR NEW.worker_id IS NULL THEN
    RAISE EXCEPTION 'Dati turno mancanti per creare la recensione obbligatoria.';
  END IF;

  SELECT id INTO v_app_id
  FROM public.applications
  WHERE announcement_id = NEW.announcement_id
    AND worker_id = NEW.worker_id
    AND restaurant_id = NEW.restaurant_id
  ORDER BY
    CASE WHEN status = 'accepted' THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  INSERT INTO public.required_reviews
    (restaurant_user_id, worker_user_id, shift_id, application_id, announcement_id, status, due_date)
  VALUES
    (NEW.restaurant_id, NEW.worker_id, NEW.id, v_app_id, NEW.announcement_id, 'pending', COALESCE(NEW.completed_at, now()) + interval '3 days')
  ON CONFLICT (shift_id, restaurant_user_id, worker_user_id)
  DO UPDATE SET
    application_id = COALESCE(public.required_reviews.application_id, EXCLUDED.application_id),
    announcement_id = COALESCE(public.required_reviews.announcement_id, EXCLUDED.announcement_id),
    due_date = CASE
      WHEN public.required_reviews.status = 'completed' THEN public.required_reviews.due_date
      ELSE COALESCE(public.required_reviews.due_date, EXCLUDED.due_date)
    END,
    updated_at = now();

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    NEW.restaurant_id,
    'Lascia una recensione',
    'Il turno è stato completato. Hai 3 giorni per valutare il lavoratore.',
    '/ristoratore/turni/' || NEW.id::text || '?section=recensione'
  );

  RETURN NEW;
END;
$function$;