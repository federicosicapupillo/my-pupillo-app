CREATE OR REPLACE FUNCTION public.notify_shift_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  title text; body text;
  worker_link text; restaurant_link text;
  worker_meta jsonb; restaurant_meta jsonb;
  kind text;
  app_id uuid;
  review_link text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.worker_id,
      'Turno confermato',
      'Hai un nuovo turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.',
      '/shifts?tab=assigned&shift=' || NEW.id,
      jsonb_build_object('kind', 'shift_created', 'shift_id', NEW.id),
      'shift_created:' || NEW.id::text || ':' || NEW.worker_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.restaurant_id,
      'Turno creato',
      'Turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.',
      '/shifts',
      jsonb_build_object('kind', 'shift_created', 'shift_id', NEW.id),
      'shift_created:' || NEW.id::text || ':' || NEW.restaurant_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Caso speciale: turno completato → singola notifica combinata
  -- "Turno completato — lascia una recensione" verso entrambi gli utenti.
  IF NEW.status = 'completed' THEN
    -- Risolvi application_id collegato al turno (per il deep-link in chat).
    SELECT a.id INTO app_id
    FROM public.applications a
    WHERE a.announcement_id = NEW.announcement_id
      AND a.worker_id = NEW.worker_id
      AND a.restaurant_id = NEW.restaurant_id
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF app_id IS NOT NULL THEN
      review_link := '/messages/' || app_id::text || '?action=review';
    ELSE
      review_link := '/shifts?tab=to-review&shift=' || NEW.id;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.worker_id,
      'Turno completato — lascia una recensione',
      'Il turno è stato completato. Hai 3 giorni per lasciare una recensione.',
      review_link,
      jsonb_build_object(
        'kind', 'shift_completed_review',
        'shift_id', NEW.id,
        'application_id', app_id,
        'announcement_id', NEW.announcement_id,
        'action', 'review'
      ),
      'shift_completed_review:' || NEW.id::text || ':' || NEW.worker_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.restaurant_id,
      'Turno completato — lascia una recensione',
      'Il turno è stato completato. Hai 3 giorni per lasciare una recensione.',
      review_link,
      jsonb_build_object(
        'kind', 'shift_completed_review',
        'shift_id', NEW.id,
        'application_id', app_id,
        'announcement_id', NEW.announcement_id,
        'action', 'review'
      ),
      'shift_completed_review:' || NEW.id::text || ':' || NEW.restaurant_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'no_show'   THEN title := 'Segnalato no-show';  body := 'Il turno è stato segnato come no-show. Apri "I miei turni" per i dettagli.'; kind := 'shift_no_show';
    WHEN 'cancelled' THEN title := 'Turno annullato';    body := 'Il turno è stato annullato.'; kind := 'shift_cancelled';
    ELSE title := 'Turno aggiornato'; body := NEW.status::text; kind := 'shift_' || NEW.status::text;
  END CASE;
  IF NEW.status = 'no_show' THEN
    worker_link := '/shifts?tab=no_show&shift=' || NEW.id;
    restaurant_link := '/shifts?tab=no_show&shift=' || NEW.id;
    worker_meta := jsonb_build_object(
      'kind', 'shift_no_show',
      'notification_type', 'shift_no_show',
      'worker_id', NEW.worker_id,
      'shift_id', NEW.id,
      'announcement_id', NEW.announcement_id,
      'target_page', 'worker_shifts',
      'target_tab', 'no_show',
      'safe_redirect_path', '/shifts?tab=no_show&shift=' || NEW.id
    );
    restaurant_meta := jsonb_build_object('kind', 'shift_no_show', 'shift_id', NEW.id);
  ELSE
    worker_link := '/shifts?shift=' || NEW.id;
    restaurant_link := '/shifts?shift=' || NEW.id;
    worker_meta := jsonb_build_object('kind', kind, 'shift_id', NEW.id);
    restaurant_meta := worker_meta;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    NEW.worker_id, title, body, worker_link, worker_meta,
    kind || ':' || NEW.id::text || ':' || NEW.worker_id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    NEW.restaurant_id, title, body, restaurant_link, restaurant_meta,
    kind || ':' || NEW.id::text || ':' || NEW.restaurant_id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END; $function$;