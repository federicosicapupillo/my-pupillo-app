-- 1) Funzione puramente temporale: il turno non e' ancora iniziato.
CREATE OR REPLACE FUNCTION public.announcement_not_started(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = _announcement_id
      AND a.shift_start_at > now()
  );
$function$;

COMMENT ON FUNCTION public.announcement_not_started(uuid) IS
  'Solo tempo: true se shift_start_at (Europe/Rome) e'' ancora nel futuro. Nessuna logica di business.';

-- 2) Candidabilita': solo annunci pubblicati (mai draft), non iniziati, non scaduti.
CREATE OR REPLACE FUNCTION public.announcement_is_applicable(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = _announcement_id
      AND a.status = 'active'
      AND a.shift_start_at > now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
  );
$function$;

COMMENT ON FUNCTION public.announcement_is_applicable(uuid) IS
  'Business + tempo: true se un lavoratore puo'' candidarsi (solo status active). Le bozze non sono mai candidabili.';

-- 3) Accettabilita' di offerta/proposta: consente anche annunci gia' parzialmente assegnati.
CREATE OR REPLACE FUNCTION public.announcement_offer_acceptable(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = _announcement_id
      AND a.status IN ('active', 'assigned')
      AND a.shift_start_at > now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
  );
$function$;

COMMENT ON FUNCTION public.announcement_offer_acceptable(uuid) IS
  'Business + tempo: true se un''offerta o una proposta su questo annuncio puo'' ancora essere accettata (active o assigned con posti residui). Le bozze non sono mai accettabili.';

-- 4) Compatibilita': la funzione storica delega e NON include piu' le bozze.
CREATE OR REPLACE FUNCTION public.announcement_is_open(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.announcement_offer_acceptable(_announcement_id);
$function$;

COMMENT ON FUNCTION public.announcement_is_open(uuid) IS
  'DEPRECATA: alias di announcement_offer_acceptable. Usare announcement_not_started / announcement_is_applicable / announcement_offer_acceptable.';

REVOKE ALL ON FUNCTION public.announcement_not_started(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.announcement_is_applicable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.announcement_offer_acceptable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.announcement_not_started(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.announcement_is_applicable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.announcement_offer_acceptable(uuid) TO authenticated, service_role;

-- 5) Call site: candidatura (INSERT applications) -> candidabilita'.
CREATE OR REPLACE FUNCTION public.enforce_application_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.announcement_id IS NOT NULL AND NOT public.announcement_is_applicable(NEW.announcement_id) THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- 6) Call site: cambio stato candidatura -> accettabilita'.
CREATE OR REPLACE FUNCTION public.enforce_offer_not_expired_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('interested', 'accepted', 'counter_offer')
     AND NEW.announcement_id IS NOT NULL
     AND NOT public.announcement_offer_acceptable(NEW.announcement_id) THEN
    RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- 7) Call site: risposta a proposta -> accettabilita'.
CREATE OR REPLACE FUNCTION public.enforce_proposal_response_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ann_id uuid;
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;
  SELECT a.announcement_id INTO ann_id FROM public.applications a WHERE a.id = NEW.application_id;
  IF ann_id IS NOT NULL AND NOT public.announcement_offer_acceptable(ann_id) THEN
    RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- 8) Call site: assegnazione atomica -> accettabilita'.
CREATE OR REPLACE FUNCTION public.accept_application_atomic(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  app record;
  ann record;
  needed integer := 1;
  filled integer := 0;
  charged boolean;
  err text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  SELECT * INTO app FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF app.restaurant_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF app.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_assigned', 'idempotent', true);
  END IF;

  IF app.status NOT IN ('pending', 'interested', 'counter_offer') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_available');
  END IF;

  IF app.announcement_id IS NOT NULL THEN
    SELECT * INTO ann FROM public.announcements WHERE id = app.announcement_id FOR UPDATE;
    IF FOUND AND ann.status IN ('cancelled', 'completed', 'draft') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_available');
    END IF;

    -- Scadenza: turno gia' iniziato o annuncio non piu' accettabile.
    IF NOT public.announcement_offer_acceptable(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'offer_expired');
    END IF;

    SELECT GREATEST(1, COALESCE(jr.workers_needed, 1)) INTO needed
    FROM public.job_requests jr
    WHERE jr.announcement_id = app.announcement_id
    ORDER BY jr.created_at DESC
    LIMIT 1;
    needed := COALESCE(needed, 1);

    SELECT count(*) INTO filled
    FROM public.applications a2
    WHERE a2.announcement_id = app.announcement_id AND a2.status = 'accepted';

    IF filled >= needed THEN
      RETURN jsonb_build_object('ok', false, 'code', 'announcement_full');
    END IF;
  END IF;

  BEGIN
    charged := public.consume_credits(7, 'assign_worker', app.id::text);
    IF NOT charged THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_credits');
    END IF;

    UPDATE public.applications SET status = 'accepted' WHERE id = app.id;

    IF app.announcement_id IS NOT NULL THEN
      IF (filled + 1) >= needed THEN
        UPDATE public.announcements
          SET status = 'assigned', assigned_worker_id = app.worker_id
          WHERE id = app.announcement_id;
      ELSE
        UPDATE public.announcements
          SET assigned_worker_id = app.worker_id
          WHERE id = app.announcement_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false,
      'code', CASE
        WHEN err ILIKE '%OFFER_EXPIRED%' OR err ILIKE '%ANNOUNCEMENT_EXPIRED%' THEN 'offer_expired'
        WHEN err ILIKE '%announcement_full%' THEN 'announcement_full'
        ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$function$;

-- 9) Ora server esposta al frontend per calcolare l'offset con l'orologio del client.
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $function$ SELECT now(); $function$;

REVOKE ALL ON FUNCTION public.server_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated, service_role;