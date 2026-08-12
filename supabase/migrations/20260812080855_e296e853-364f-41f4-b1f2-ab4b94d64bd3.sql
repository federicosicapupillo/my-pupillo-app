-- 1) Causa tecnica di chiusura, distinta dalla label mostrata all'utente.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS closed_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_closed_reason_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_closed_reason_check
      CHECK (closed_reason IS NULL OR closed_reason IN (
        'overlap','announcement_filled','manual_rejection','offer_expired','worker_cancelled'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.applications.closed_reason IS
  'Causa tecnica della chiusura della candidatura. overlap = chiusa perche il lavoratore ha confermato un turno sovrapposto.';

-- 2) Etichetta leggibile della mansione dell''annuncio della candidatura.
CREATE OR REPLACE FUNCTION public.application_role_label(_application_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
    initcap(regexp_replace(COALESCE(an.professional_profile, ''), '[_-]+', ' ', 'g')),
    ''
  )
  FROM public.applications ap
  LEFT JOIN public.announcements an ON an.id = ap.announcement_id
  WHERE ap.id = _application_id;
$$;

-- 3) Chiusura per sovrapposizione: causa tecnica + notifica unica con mansione.
CREATE OR REPLACE FUNCTION public.close_conflicting_pending_applications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_role text;
  v_suffix text;
BEGIN
  IF NEW.status <> 'accepted'::public.application_status
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT ap.id, ap.announcement_id
    FROM public.applications ap
    WHERE ap.worker_id = NEW.worker_id
      AND ap.id <> NEW.id
      AND ap.status IN ('pending','interested','counter_offer')
      AND ap.announcement_id IS NOT NULL
      AND public.announcement_shift_interval(ap.announcement_id)
          && public.announcement_shift_interval(NEW.announcement_id)
  LOOP
    UPDATE public.applications
       SET status = 'expired'::public.application_status,
           closed_reason = 'overlap'
     WHERE id = r.id;

    v_role := public.application_role_label(r.id);
    v_suffix := CASE WHEN v_role IS NULL THEN '' ELSE ' — ' || v_role END;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.worker_id, 'application_closed', 'application', r.id,
            jsonb_build_object('reason', 'confirmed_shift_conflict',
                               'confirmed_application_id', NEW.id));

    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.worker_id,
      'Candidatura chiusa per sovrapposizione' || v_suffix,
      'La candidatura' || CASE WHEN v_role IS NULL THEN '' ELSE ' per ' || v_role END
        || ' è stata chiusa perché hai confermato un altro turno nello stesso orario.',
      '/messages/' || r.id::text,
      jsonb_build_object('kind','application_closed_shift_conflict',
                         'notification_type','application_closed_shift_conflict',
                         'application_id', r.id,
                         'conversation_id', r.id,
                         'announcement_id', r.announcement_id,
                         'worker_user_id', NEW.worker_id,
                         'role_label', v_role,
                         'closed_reason','overlap',
                         'reason','confirmed_shift_conflict'),
      'application_closed_shift_conflict:' || r.id::text || ':' || NEW.worker_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 4) Chiusura per posto occupato sullo stesso annuncio: causa tecnica dedicata.
CREATE OR REPLACE FUNCTION public.reject_other_applications_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.applications
       SET status = 'rejected',
           closed_reason = 'announcement_filled'
     WHERE announcement_id = NEW.announcement_id
       AND id <> NEW.id
       AND status NOT IN ('rejected','accepted','expired','not_interested');
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Default della causa tecnica quando non impostata esplicitamente.
CREATE OR REPLACE FUNCTION public.applications_set_closed_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.closed_reason IS NOT DISTINCT FROM OLD.closed_reason THEN
      IF NEW.status = 'rejected'::public.application_status THEN
        NEW.closed_reason := COALESCE(NEW.closed_reason, 'manual_rejection');
      ELSIF NEW.status = 'expired'::public.application_status THEN
        NEW.closed_reason := COALESCE(NEW.closed_reason, 'offer_expired');
      ELSIF NEW.status = 'cancelled'::public.application_status THEN
        NEW.closed_reason := COALESCE(NEW.closed_reason, 'worker_cancelled');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_01_applications_set_closed_reason ON public.applications;
CREATE TRIGGER trg_01_applications_set_closed_reason
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_set_closed_reason();

-- 6) Notifiche legacy: nessun messaggio generico, nessun doppione su expired.
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
  -- accepted / rejected / expired sono gestiti esclusivamente da
  -- notify_application_status_change (con dedupe_key e mansione).
  IF NEW.status IN ('accepted','rejected','expired','cancelled') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('interested','not_interested','counter_offer') THEN
    recipient := NEW.restaurant_id;
  ELSE
    -- Nessuna notifica generica "Aggiornamento candidatura".
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'interested' THEN
      title := 'Lavoratore interessato';
      body  := 'Un lavoratore ha mostrato interesse per la tua proposta. Conferma il turno dalla chat o da "I miei annunci" per sbloccare i dettagli completi.';
    WHEN 'not_interested' THEN title := 'Offerta rifiutata'; body := 'Il lavoratore non è interessato.';
    WHEN 'counter_offer' THEN title := 'Controfferta ricevuta'; body := 'Hai ricevuto una nuova proposta economica.';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    recipient, title, body, '/messages/' || NEW.id,
    jsonb_build_object('kind','application_status_' || NEW.status::text,
                       'application_id', NEW.id,
                       'conversation_id', NEW.id,
                       'announcement_id', NEW.announcement_id),
    'application_status_' || NEW.status::text || ':' || NEW.id::text || ':' || recipient::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 7) Notifica canonica di cambio stato: mansione nel titolo, dedupe sempre,
--    nessuna "Offerta scaduta" quando la causa reale è la sovrapposizione.
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
  v_shift_id uuid;
  v_role text;
  v_suffix text;
  v_for_role text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- La chiusura per sovrapposizione ha una notifica dedicata emessa da
  -- close_conflicting_pending_applications: qui non si duplica nulla.
  IF NEW.status = 'expired'::public.application_status
     AND NEW.closed_reason = 'overlap' THEN
    RETURN NEW;
  END IF;

  v_link := '/messages/' || NEW.id::text;
  v_recipient := NEW.worker_id;
  v_role := public.application_role_label(NEW.id);
  v_suffix := CASE WHEN v_role IS NULL THEN '' ELSE ' — ' || v_role END;
  v_for_role := CASE WHEN v_role IS NULL THEN '' ELSE ' per ' || v_role END;

  CASE NEW.status
    WHEN 'accepted' THEN
      v_title := 'Candidatura accettata' || v_suffix;
      v_body := 'Sei stato assegnato al servizio' || v_for_role
        || '. Apri la chat per leggere le istruzioni e i dettagli del turno.';
      v_type := 'shift_assignment_confirmed';
    WHEN 'rejected' THEN
      v_title := 'Candidatura non accettata' || v_suffix;
      v_body := CASE
        WHEN NEW.closed_reason = 'announcement_filled'
          THEN 'Il turno' || v_for_role || ' è stato assegnato a un altro lavoratore.'
        ELSE 'Il ristoratore ha rifiutato la tua richiesta' || v_for_role || '.'
      END;
      v_type := 'application_status_rejected';
    WHEN 'interested' THEN
      v_recipient := NEW.restaurant_id;
      v_title := 'Candidato interessato' || v_suffix;
      v_body := 'Un candidato ha mostrato interesse per la tua proposta. Apri la chat per confermare il lavoratore o inviare una controfferta.';
      v_type := 'candidate_interested';
    WHEN 'counter_offer' THEN
      v_title := 'Controproposta ricevuta' || v_suffix;
      v_body := 'Hai ricevuto una nuova offerta dal ristoratore.';
      v_type := 'application_status_counter_offer';
    WHEN 'expired' THEN
      v_title := 'Offerta scaduta' || v_suffix;
      v_body := 'La tua candidatura' || v_for_role || ' è scaduta.';
      v_type := 'application_status_expired';
    ELSE
      RETURN NEW;
  END CASE;

  v_dedupe := v_type || ':' || NEW.id::text || ':' || COALESCE(v_recipient::text, '');

  IF NEW.status = 'accepted' THEN
    SELECT s.id INTO v_shift_id FROM public.shifts s
    WHERE s.announcement_id = NEW.announcement_id
      AND s.worker_id = NEW.worker_id
      AND s.restaurant_id = NEW.restaurant_id
    ORDER BY s.created_at DESC LIMIT 1;
  END IF;

  IF v_recipient IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      v_recipient, v_title, v_body, v_link,
      jsonb_build_object(
        'application_id', NEW.id,
        'conversation_id', NEW.id,
        'shift_id', v_shift_id,
        'announcement_id', NEW.announcement_id,
        'restaurant_user_id', NEW.restaurant_id,
        'worker_user_id', NEW.worker_id,
        'role_label', v_role,
        'closed_reason', NEW.closed_reason,
        'notification_type', v_type,
        'kind', v_type
      ),
      v_dedupe
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;