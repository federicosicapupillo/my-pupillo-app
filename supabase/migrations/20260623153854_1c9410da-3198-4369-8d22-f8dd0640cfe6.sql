-- Phase 4: redact review_received notification metadata (no rating/comment),
-- route to the chat with action=review when the recipient hasn't reciprocated yet,
-- and add a stable dedupe_key. No other behavior of handle_new_review changes.

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
  v_author_is_worker boolean;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_shift_rid uuid;
  v_direction text;
  v_dedupe text;
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

  SELECT public.has_role(NEW.author_id, 'worker'::app_role) INTO v_author_is_worker;

  IF NEW.shift_id IS NOT NULL THEN
    SELECT restaurant_id INTO v_shift_rid FROM public.shifts WHERE id = NEW.shift_id;

    UPDATE public.shifts
       SET reviewed_at = COALESCE(reviewed_at, NEW.created_at),
           reviewed_by_restaurant_user_id = CASE
             WHEN NOT v_author_is_worker THEN NEW.author_id
             ELSE reviewed_by_restaurant_user_id
           END,
           status = CASE WHEN status <> 'completed'::shift_status THEN 'completed'::shift_status ELSE status END,
           completed_at = COALESCE(completed_at, NEW.created_at)
     WHERE id = NEW.shift_id;

    IF NOT v_author_is_worker THEN
      UPDATE public.profiles
         SET completed_shifts = COALESCE(completed_shifts, 0) + 1
       WHERE id = NEW.target_id
         AND NOT EXISTS (
           SELECT 1 FROM public.reviews r2
            WHERE r2.shift_id = NEW.shift_id
              AND r2.id <> NEW.id
              AND r2.author_id = NEW.author_id
         );
    END IF;
  END IF;

  -- Resolve direction from the column (Fase 1) or fall back to role.
  v_direction := COALESCE(
    NEW.direction,
    CASE WHEN v_author_is_worker THEN 'worker_to_restaurant' ELSE 'restaurant_to_worker' END
  );

  -- Title/body kept generic (no rating leak).
  v_notif_title := 'Hai ricevuto una recensione';
  v_notif_body  := 'Per leggere la recensione, lascia prima la tua: appena entrambe sono inviate diventano visibili.';

  -- Link: drive the recipient to the chat to leave their review (no content leak).
  -- The client-side notification-link.ts upgrades to /reviews/<id> when the
  -- reciprocal review already exists for the recipient.
  v_notif_link := CASE
    WHEN NEW.application_id IS NOT NULL
      THEN '/messages/' || NEW.application_id::text || '?action=review'
    ELSE '/reviews/' || NEW.id::text
  END;

  -- Stable dedupe key per (recipient, review).
  v_dedupe := 'review_received:' || NEW.id::text || ':' || NEW.target_id::text;

  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    NEW.target_id,
    v_notif_title,
    v_notif_body,
    v_notif_link,
    jsonb_build_object(
      'kind',           'review_received',
      'review_id',      NEW.id,
      'shift_id',       NEW.shift_id,
      'application_id', NEW.application_id,
      'direction',      v_direction
    ),
    v_dedupe
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  -- Automatic chat system message (unchanged).
  IF NEW.application_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
       WHERE m.application_id = NEW.application_id
         AND m.template_id = 'review_submitted'
         AND m.sender_id = NEW.author_id
    ) THEN
      INSERT INTO public.messages (application_id, sender_id, receiver_id, body, message_type, template_id)
      VALUES (
        NEW.application_id,
        NEW.author_id,
        NEW.target_id,
        CASE WHEN v_author_is_worker
             THEN 'Il lavoratore ha lasciato una recensione per questo turno.'
             ELSE 'Il ristoratore ha lasciato una recensione per questo turno.' END,
        'system',
        'review_submitted'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;