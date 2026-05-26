-- 1) Unique constraint: una sola recensione per autore + turno
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_author_shift
  ON public.reviews (author_id, shift_id)
  WHERE shift_id IS NOT NULL;

-- 2) Trigger handle_new_review: distinguish direction (worker->restaurant
--    vs restaurant->worker), set role-aware notification, and emit an
--    automatic system message in the chat thread when an application_id
--    is present.
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
  v_author_is_worker boolean;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_shift_rid uuid;
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

  -- Direction detection
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

    -- Increment completed_shifts on target only once per shift (legacy: restaurant->worker)
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

  -- Compose role-aware notification copy + link
  IF v_author_is_worker THEN
    v_notif_title := 'Hai ricevuto una recensione';
    v_notif_body  := 'Un lavoratore ha lasciato una recensione sul turno appena concluso.';
    v_notif_link  := CASE
      WHEN NEW.shift_id IS NOT NULL THEN '/ristoratore/turni/' || NEW.shift_id::text
      WHEN NEW.application_id IS NOT NULL THEN '/messages/' || NEW.application_id::text
      ELSE '/reviews/' || NEW.id::text
    END;
  ELSE
    v_notif_title := 'Hai ricevuto una recensione';
    v_notif_body  := 'Il ristoratore ha lasciato una recensione per il turno completato.';
    v_notif_link  := '/reviews/' || NEW.id::text;
  END IF;

  -- Anti-duplicate notification
  SELECT EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.target_id
       AND (n.metadata->>'type') = 'review_received'
       AND (
         (n.metadata->>'review_id')::uuid = NEW.id
         OR (NEW.shift_id IS NOT NULL AND (n.metadata->>'shift_id')::uuid = NEW.shift_id
             AND (n.metadata->>'author_id')::uuid = NEW.author_id)
       )
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.notifications (user_id, title, body, link, metadata)
    VALUES (
      NEW.target_id,
      v_notif_title,
      v_notif_body,
      v_notif_link,
      jsonb_build_object(
        'type', 'review_received',
        'review_id', NEW.id,
        'rating', NEW.rating,
        'shift_id', NEW.shift_id,
        'application_id', NEW.application_id,
        'author_id', NEW.author_id,
        'direction', CASE WHEN v_author_is_worker THEN 'worker_to_restaurant' ELSE 'restaurant_to_worker' END
      )
    );
  END IF;

  -- Automatic chat system message (only when there's a thread/application)
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

-- 3) Trigger su shifts: notifica al lavoratore quando il turno passa a
--    completed, ricordandogli di lasciare la recensione.
CREATE OR REPLACE FUNCTION public.notify_worker_review_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_reviewed boolean;
  v_app_id uuid;
  v_link text;
BEGIN
  -- Solo quando il turno DIVENTA completato
  IF NEW.status <> 'completed'::shift_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed'::shift_status THEN
    RETURN NEW;
  END IF;

  -- Se il lavoratore ha già recensito, salta
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
     WHERE r.shift_id = NEW.id
       AND r.author_id = NEW.worker_id
  ) INTO v_already_reviewed;
  IF v_already_reviewed THEN
    RETURN NEW;
  END IF;

  -- Anti-duplicate notification
  IF EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.worker_id
       AND (n.metadata->>'type') = 'review_pending_worker'
       AND (n.metadata->>'shift_id')::uuid = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Link: chat se c'è applicazione, altrimenti pagina turni
  IF NEW.announcement_id IS NOT NULL THEN
    SELECT id INTO v_app_id
      FROM public.applications
     WHERE announcement_id = NEW.announcement_id
       AND worker_id = NEW.worker_id
     ORDER BY updated_at DESC
     LIMIT 1;
  END IF;
  v_link := COALESCE('/shifts?tab=to-review&shift=' || NEW.id::text, '/shifts');

  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (
    NEW.worker_id,
    'Lascia una recensione',
    'Il turno è terminato. Racconta la tua esperienza con il ristoratore: la tua recensione aiuta la community Pupillo a lavorare meglio.',
    v_link,
    jsonb_build_object(
      'type', 'review_pending_worker',
      'shift_id', NEW.id,
      'restaurant_id', NEW.restaurant_id,
      'announcement_id', NEW.announcement_id,
      'application_id', v_app_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_worker_review_pending ON public.shifts;
CREATE TRIGGER trg_notify_worker_review_pending
  AFTER INSERT OR UPDATE OF status ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_review_pending();