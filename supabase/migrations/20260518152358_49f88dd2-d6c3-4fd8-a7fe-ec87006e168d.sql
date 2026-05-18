-- Single source of truth for "review received" notifications.
-- Updates the existing handle_new_review trigger function to:
--  * use the correct copy ("Hai ricevuto una recensione")
--  * link to /reviews/:id (popup route exists on the client)
--  * skip insert if a review_received notification for the same review/shift
--    already exists (anti-duplicate safety net)

CREATE OR REPLACE FUNCTION public.handle_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
  v_count integer;
  v_p numeric; v_pr numeric; v_c numeric; v_r numeric; v_t numeric;
  v_exists boolean;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE target_id = NEW.target_id;

  SELECT
    COALESCE(ROUND(AVG(punctuality)::numeric, 2), 0),
    COALESCE(ROUND(AVG(professionalism)::numeric, 2), 0),
    COALESCE(ROUND(AVG(competence)::numeric, 2), 0),
    COALESCE(ROUND(AVG(reliability)::numeric, 2), 0),
    COALESCE(ROUND(AVG(teamwork)::numeric, 2), 0)
    INTO v_p, v_pr, v_c, v_r, v_t
    FROM public.reviews
   WHERE target_id = NEW.target_id;

  UPDATE public.profiles
     SET rating_avg = COALESCE(v_avg, 0),
         reviews_count = v_count,
         last_review_at = NEW.created_at,
         avg_punctuality = v_p,
         avg_professionalism = v_pr,
         avg_competence = v_c,
         avg_reliability = v_r,
         avg_teamwork = v_t,
         updated_at = now()
   WHERE id = NEW.target_id;

  IF NEW.shift_id IS NOT NULL THEN
    UPDATE public.shifts
       SET reviewed_at = NEW.created_at,
           reviewed_by_restaurant_user_id = NEW.author_id,
           status = CASE WHEN status <> 'completed'::shift_status THEN 'completed'::shift_status ELSE status END,
           completed_at = COALESCE(completed_at, NEW.created_at)
     WHERE id = NEW.shift_id;

    UPDATE public.profiles
       SET completed_shifts = COALESCE(completed_shifts, 0) + 1
     WHERE id = NEW.target_id
       AND NOT EXISTS (
         SELECT 1 FROM public.reviews r2
          WHERE r2.shift_id = NEW.shift_id
            AND r2.id <> NEW.id
       );
  END IF;

  -- Anti-duplicate: skip if a review_received notification for this
  -- review or shift already exists for the same target user.
  SELECT EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.target_id
       AND (n.metadata->>'type') = 'review_received'
       AND (
         (n.metadata->>'review_id')::uuid = NEW.id
         OR (NEW.shift_id IS NOT NULL AND (n.metadata->>'shift_id')::uuid = NEW.shift_id)
       )
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.notifications (user_id, title, body, link, metadata)
    VALUES (
      NEW.target_id,
      'Hai ricevuto una recensione',
      'Il ristoratore ha lasciato una recensione per il turno completato.',
      '/reviews/' || NEW.id::text,
      jsonb_build_object(
        'type', 'review_received',
        'review_id', NEW.id,
        'rating', NEW.rating,
        'shift_id', NEW.shift_id,
        'application_id', NEW.application_id,
        'author_id', NEW.author_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;