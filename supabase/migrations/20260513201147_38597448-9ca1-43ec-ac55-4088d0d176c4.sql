-- Fix race-condition between handle_new_review and complete_required_review_on_review:
-- when the review is left on a shift not yet 'completed', the create-required-review
-- trigger creates a fresh pending row even though a review already exists. Make that
-- function detect an existing review and mark the new required_review as completed.

CREATE OR REPLACE FUNCTION public.create_required_review_on_shift_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app_id uuid;
  v_review_id uuid;
  v_review_at timestamptz;
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
  ORDER BY CASE WHEN status = 'accepted' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1;

  -- Detect a review already left for this shift (covers the race when the review
  -- is the event that completes the shift in the first place).
  SELECT id, created_at INTO v_review_id, v_review_at
    FROM public.reviews
   WHERE author_id = NEW.restaurant_id
     AND target_id = NEW.worker_id
     AND (shift_id = NEW.id OR (v_app_id IS NOT NULL AND application_id = v_app_id))
   ORDER BY created_at ASC
   LIMIT 1;

  INSERT INTO public.required_reviews
    (restaurant_user_id, worker_user_id, shift_id, application_id, announcement_id,
     status, due_date, completed_at, review_id)
  VALUES
    (NEW.restaurant_id, NEW.worker_id, NEW.id, v_app_id, NEW.announcement_id,
     CASE WHEN v_review_id IS NOT NULL THEN 'completed' ELSE 'pending' END,
     COALESCE(NEW.completed_at, now()) + interval '3 days',
     v_review_at,
     v_review_id)
  ON CONFLICT (shift_id, restaurant_user_id, worker_user_id)
  DO UPDATE SET
    application_id = COALESCE(public.required_reviews.application_id, EXCLUDED.application_id),
    announcement_id = COALESCE(public.required_reviews.announcement_id, EXCLUDED.announcement_id),
    status = CASE
      WHEN public.required_reviews.status = 'completed' THEN public.required_reviews.status
      WHEN v_review_id IS NOT NULL THEN 'completed'
      ELSE public.required_reviews.status
    END,
    completed_at = COALESCE(public.required_reviews.completed_at, v_review_at),
    review_id = COALESCE(public.required_reviews.review_id, v_review_id),
    due_date = CASE
      WHEN public.required_reviews.status = 'completed' THEN public.required_reviews.due_date
      ELSE COALESCE(public.required_reviews.due_date, EXCLUDED.due_date)
    END,
    updated_at = now();

  IF v_review_id IS NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.restaurant_id,
      'Lascia una recensione',
      'Il turno è stato completato. Hai 3 giorni per valutare il lavoratore.',
      '/ristoratore/turni/' || NEW.id::text || '?section=recensione'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: any pending/overdue required_reviews that already have a matching review
-- are flipped to completed.
WITH matched AS (
  SELECT rr.id AS rr_id, r.id AS r_id, r.created_at AS r_at
    FROM public.required_reviews rr
    JOIN public.reviews r
      ON r.author_id = rr.restaurant_user_id
     AND r.target_id = rr.worker_user_id
     AND (
       (rr.shift_id IS NOT NULL AND r.shift_id = rr.shift_id)
       OR (rr.application_id IS NOT NULL AND r.application_id = rr.application_id)
     )
   WHERE rr.status IN ('pending','overdue')
)
UPDATE public.required_reviews rr
   SET status = 'completed',
       completed_at = COALESCE(rr.completed_at, m.r_at),
       review_id = COALESCE(rr.review_id, m.r_id),
       updated_at = now()
  FROM matched m
 WHERE rr.id = m.rr_id;

-- Recompute review_blocked / overdue counters for every restaurant.
DO $$
DECLARE r_id uuid;
BEGIN
  FOR r_id IN SELECT DISTINCT restaurant_user_id FROM public.required_reviews LOOP
    PERFORM public.recompute_review_block(r_id);
  END LOOP;
END $$;