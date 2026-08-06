-- 1. Colonna origine autorevole
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'worker_application';

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_origin_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_origin_check
  CHECK (origin IN ('worker_application','restaurant_invitation','restaurant_direct_request','system_created'));

-- 2. Backfill storico: se il PRIMO messaggio della chat e' del ristoratore,
--    la richiesta e' partita dal locale (invito/proposta diretta).
WITH first_msg AS (
  SELECT DISTINCT ON (m.application_id)
         m.application_id, m.sender_id, m.action_type
  FROM public.messages m
  ORDER BY m.application_id, m.created_at ASC, m.id ASC
)
UPDATE public.applications a
SET origin = 'restaurant_invitation'
FROM first_msg f
WHERE f.application_id = a.id
  AND f.sender_id = a.restaurant_id;

-- 3. Origine impostata solo dal database (mai dal client)
CREATE OR REPLACE FUNCTION public.applications_set_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ctx text;
  v_actor uuid := auth.uid();
BEGIN
  v_ctx := nullif(current_setting('pupillo.application_origin', true), '');
  IF TG_OP = 'UPDATE' THEN
    IF v_ctx IN ('worker_application','restaurant_invitation','restaurant_direct_request','system_created') THEN
      NEW.origin := v_ctx;
    ELSE
      NEW.origin := OLD.origin;  -- immutabile lato client
    END IF;
    RETURN NEW;
  END IF;

  IF v_ctx IN ('worker_application','restaurant_invitation','restaurant_direct_request','system_created') THEN
    NEW.origin := v_ctx;
  ELSIF v_actor IS NOT NULL AND v_actor = NEW.worker_id THEN
    NEW.origin := 'worker_application';
  ELSIF v_actor IS NOT NULL AND v_actor = NEW.restaurant_id THEN
    NEW.origin := 'restaurant_invitation';
  ELSE
    NEW.origin := 'system_created';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_applications_set_origin ON public.applications;
CREATE TRIGGER trg_00_applications_set_origin
BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.applications_set_origin();

-- 4. Notifica "Nuova candidatura ricevuta" solo per candidature spontanee
CREATE OR REPLACE FUNCTION public.notify_application_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recipient uuid;
  is_counter boolean := false;
  n_title text;
  n_body text;
  v_actor uuid := auth.uid();
BEGIN
  -- Origine autorevole: solo la candidatura iniziata dal lavoratore genera
  -- la notifica al ristoratore.
  IF NEW.origin IS DISTINCT FROM 'worker_application' THEN
    RETURN NEW;
  END IF;

  recipient := NEW.restaurant_id;

  -- Controllo difensivo: mai notificare l'autore della propria azione.
  IF v_actor IS NOT NULL AND v_actor = recipient THEN
    RETURN NEW;
  END IF;

  IF NEW.worker_id = recipient THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.worker_id AND role = 'worker') THEN
    RETURN NEW;
  END IF;

  is_counter := NEW.proposed_tariff IS NOT NULL;
  IF is_counter THEN
    n_title := 'Nuova contro offerta ricevuta';
    n_body := 'Un lavoratore propone € ' || NEW.proposed_tariff::text || '/h per uno dei tuoi turni.';
  ELSE
    n_title := 'Nuova candidatura ricevuta';
    n_body := 'Un lavoratore si è candidato per uno dei tuoi turni.';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link, dedupe_key, metadata)
  VALUES (
    recipient,
    n_title,
    n_body,
    '/messages/' || NEW.id,
    'application_received:' || NEW.id::text || ':' || recipient::text,
    jsonb_build_object(
      'kind', 'application_received',
      'application_id', NEW.id,
      'announcement_id', NEW.announcement_id,
      'worker_id', NEW.worker_id,
      'origin', NEW.origin
    )
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. RPC sicura per invito / richiesta diretta del ristoratore
CREATE OR REPLACE FUNCTION public.restaurant_contact_worker(
  _announcement_id uuid,
  _worker_id uuid,
  _origin text DEFAULT 'restaurant_invitation'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_app_id uuid;
  v_status application_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF _origin NOT IN ('restaurant_invitation','restaurant_direct_request') THEN
    RAISE EXCEPTION 'INVALID_ORIGIN';
  END IF;

  SELECT restaurant_id INTO v_owner FROM public.announcements WHERE id = _announcement_id;
  IF v_owner IS NULL OR v_owner <> v_caller THEN
    RAISE EXCEPTION 'FORBIDDEN_ANNOUNCEMENT';
  END IF;
  IF _worker_id = v_caller THEN
    RAISE EXCEPTION 'INVALID_WORKER';
  END IF;

  PERFORM set_config('pupillo.application_origin', _origin, true);

  SELECT id, status INTO v_app_id, v_status
  FROM public.applications
  WHERE announcement_id = _announcement_id AND worker_id = _worker_id
  FOR UPDATE;

  IF v_app_id IS NULL THEN
    INSERT INTO public.applications (announcement_id, worker_id, restaurant_id, status)
    VALUES (_announcement_id, _worker_id, v_caller, 'pending')
    RETURNING id INTO v_app_id;
  ELSIF v_status IN ('pending','interested','counter_offer','accepted') THEN
    PERFORM set_config('pupillo.application_origin', '', true);
    RAISE EXCEPTION 'ACTIVE_APPLICATION_EXISTS';
  ELSE
    UPDATE public.applications
    SET status = 'pending',
        restaurant_id = v_caller,
        proposed_tariff = NULL,
        worker_response_at = NULL
    WHERE id = v_app_id;
  END IF;

  PERFORM set_config('pupillo.application_origin', '', true);
  RETURN v_app_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restaurant_contact_worker(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.restaurant_contact_worker(uuid, uuid, text) TO authenticated;