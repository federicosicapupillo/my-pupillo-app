
-- Consolidate worker notifications on application acceptance / shift confirmation.
-- Previously three near-identical notifications were generated:
--   1) notify_application_status  -> "Candidatura accettata"
--   2) notify_application_status_change -> "Candidatura confermata"
--   3) notify_shift_status (INSERT) -> "Turno confermato"
-- All three represent the same operational event for the worker. We now emit a
-- single consolidated notification with idempotent dedupe_key, and suppress the
-- worker-side duplicates in the other two triggers.

-- 1) Single consolidated worker notification on application -> accepted.
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body text;
  v_link text;
  v_recipient uuid;
  v_dedupe text;
  v_type text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_link := '/messages/' || NEW.id::text;
    v_recipient := NEW.worker_id; -- default: worker is notified
    v_dedupe := NULL;
    CASE NEW.status
      WHEN 'accepted' THEN
        v_title := 'Candidatura accettata e turno confermato';
        v_body := 'Sei stato assegnato al servizio. Apri la chat per leggere le istruzioni e i dettagli del turno.';
        v_type := 'shift_assignment_confirmed';
        v_dedupe := 'shift_assignment_confirmed:' || NEW.id::text || ':' || COALESCE(NEW.worker_id::text, '');
      WHEN 'rejected' THEN
        v_title := 'Prenotazione rifiutata';
        v_body := 'Il ristoratore ha rifiutato la tua richiesta.';
        v_type := 'application_status_rejected';
      WHEN 'interested' THEN
        v_recipient := NEW.restaurant_id;
        v_title := 'Candidato interessato';
        v_body := 'Un candidato ha mostrato interesse per la tua proposta. Apri la chat per confermare il lavoratore o inviare una controfferta.';
        v_type := 'candidate_interested';
      WHEN 'counter_offer' THEN
        v_title := 'Controproposta ricevuta';
        v_body := 'Hai ricevuto una nuova offerta dal ristoratore.';
        v_type := 'application_status_counter_offer';
      WHEN 'expired' THEN
        v_title := 'Offerta scaduta';
        v_body := 'La tua candidatura è scaduta.';
        v_type := 'application_status_expired';
      ELSE
        RETURN NEW;
    END CASE;

    IF v_recipient IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
      VALUES (
        v_recipient,
        v_title,
        v_body,
        v_link,
        jsonb_build_object(
          'application_id', NEW.id,
          'announcement_id', NEW.announcement_id,
          'restaurant_user_id', NEW.restaurant_id,
          'worker_user_id', NEW.worker_id,
          'notification_type', v_type,
          'kind', v_type
        ),
        v_dedupe
      )
      ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Legacy trigger: stop emitting the worker "Candidatura accettata" duplicate.
--    Keep other transitions (interested, counter_offer, rejected, etc.) working
--    so we do not silently lose existing flows.
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient uuid;
  title text;
  body text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  -- Consolidated worker notification on "accepted" is now emitted by
  -- notify_application_status_change with a dedupe_key. Skip here to avoid
  -- the duplicate "Candidatura accettata" message in the worker's panel.
  IF NEW.status = 'accepted' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('interested','not_interested','counter_offer') THEN
    recipient := NEW.restaurant_id;
  ELSE
    recipient := NEW.worker_id;
  END IF;

  CASE NEW.status
    WHEN 'interested' THEN
      title := 'Lavoratore interessato';
      body  := 'Un lavoratore ha mostrato interesse per la tua proposta. Conferma il turno dalla chat o da "I miei annunci" per sbloccare i dettagli completi.';
    WHEN 'not_interested' THEN title := 'Offerta rifiutata'; body := 'Il lavoratore non è interessato.';
    WHEN 'counter_offer' THEN title := 'Controfferta ricevuta'; body := 'Hai ricevuto una nuova proposta economica.';
    WHEN 'rejected' THEN title := 'Candidatura non accettata'; body := 'La candidatura è stata chiusa.';
    ELSE title := 'Aggiornamento candidatura'; body := NEW.status::text;
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (recipient, title, body, '/messages/' || NEW.id);
  RETURN NEW;
END;
$function$;

-- 3) Shift creation: do NOT notify the worker again ("Turno confermato") because
--    the consolidated "Candidatura accettata e turno confermato" notification
--    already informs them. Restaurant-side "Turno creato" is preserved.
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
    -- Worker notification intentionally omitted: the consolidated
    -- "Candidatura accettata e turno confermato" is emitted by
    -- notify_application_status_change with idempotent dedupe_key.
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

  IF NEW.status = 'completed' THEN
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
      jsonb_build_object('kind', 'shift_completed_review', 'shift_id', NEW.id, 'application_id', app_id, 'announcement_id', NEW.announcement_id, 'action', 'review'),
      'shift_completed_review:' || NEW.id::text || ':' || NEW.worker_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.restaurant_id,
      'Turno completato — lascia una recensione',
      'Il turno è stato completato. Hai 3 giorni per lasciare una recensione.',
      review_link,
      jsonb_build_object('kind', 'shift_completed_review', 'shift_id', NEW.id, 'application_id', app_id, 'announcement_id', NEW.announcement_id, 'action', 'review'),
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
    worker_meta := jsonb_build_object('kind','shift_no_show','notification_type','shift_no_show','worker_id',NEW.worker_id,'shift_id',NEW.id,'announcement_id',NEW.announcement_id,'target_page','worker_shifts','target_tab','no_show','safe_redirect_path','/shifts?tab=no_show&shift=' || NEW.id);
    restaurant_meta := jsonb_build_object('kind','shift_no_show','shift_id',NEW.id);
  ELSE
    worker_link := '/shifts?shift=' || NEW.id;
    restaurant_link := '/shifts?shift=' || NEW.id;
    worker_meta := jsonb_build_object('kind', kind, 'shift_id', NEW.id);
    restaurant_meta := jsonb_build_object('kind', kind, 'shift_id', NEW.id);
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (NEW.worker_id, title, body, worker_link, worker_meta, kind || ':' || NEW.id::text || ':' || NEW.worker_id::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (NEW.restaurant_id, title, body, restaurant_link, restaurant_meta, kind || ':' || NEW.id::text || ':' || NEW.restaurant_id::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;
