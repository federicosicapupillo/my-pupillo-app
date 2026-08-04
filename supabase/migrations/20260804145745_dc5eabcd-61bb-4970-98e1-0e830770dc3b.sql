-- ============================================================
-- 1. Intervallo canonico del turno di un annuncio
-- ============================================================
CREATE OR REPLACE FUNCTION public.announcement_shift_interval(_ann uuid)
RETURNS tstzrange
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s timestamptz;
  e timestamptz;
BEGIN
  SELECT a.shift_start_at INTO s FROM public.announcements a WHERE a.id = _ann;
  IF s IS NULL THEN RETURN NULL; END IF;
  e := public.announcement_effective_end(_ann);
  -- Turni che attraversano la mezzanotte: la fine calcolata sulla stessa data
  -- risulta <= inizio, va spostata al giorno successivo.
  IF e IS NULL THEN
    e := s + interval '1 hour';
  ELSIF e <= s THEN
    e := e + interval '1 day';
  END IF;
  IF e <= s THEN e := s + interval '1 minute'; END IF;
  RETURN tstzrange(s, e, '[)');
END;
$function$;

-- ============================================================
-- 2. Funzione centralizzata di conflitto
--    Stati bloccanti sugli shift: SOLO 'scheduled'.
--    Esclusi: 'completed', 'no_show', 'cancelled'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.worker_has_confirmed_shift_conflict(
  _worker_id uuid,
  _candidate_start timestamptz,
  _candidate_end timestamptz,
  _exclude_shift_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.shifts s
    JOIN public.announcements a ON a.id = s.announcement_id
    WHERE s.worker_id = _worker_id
      AND s.status = 'scheduled'::public.shift_status
      AND (_exclude_shift_id IS NULL OR s.id <> _exclude_shift_id)
      AND a.status <> 'cancelled'::public.announcement_status
      AND public.announcement_shift_interval(a.id)
          && tstzrange(
               _candidate_start,
               GREATEST(_candidate_end, _candidate_start + interval '1 minute'),
               '[)')
  );
$function$;

CREATE OR REPLACE FUNCTION public.worker_conflicts_with_announcement(
  _worker_id uuid,
  _announcement_id uuid,
  _exclude_shift_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r tstzrange;
BEGIN
  IF _worker_id IS NULL OR _announcement_id IS NULL THEN RETURN false; END IF;
  r := public.announcement_shift_interval(_announcement_id);
  IF r IS NULL THEN RETURN false; END IF;
  RETURN public.worker_has_confirmed_shift_conflict(
    _worker_id, lower(r), upper(r), _exclude_shift_id);
END;
$function$;

-- Guard con advisory lock per-lavoratore: due transazioni concorrenti sullo
-- stesso lavoratore vengono serializzate, quindi la seconda vede la prima.
CREATE OR REPLACE FUNCTION public.assert_no_worker_shift_conflict(
  _worker_id uuid,
  _announcement_id uuid,
  _exclude_shift_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _worker_id IS NULL OR _announcement_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_worker_id::text, 42));
  IF public.worker_conflicts_with_announcement(_worker_id, _announcement_id, _exclude_shift_id) THEN
    RAISE EXCEPTION 'WORKER_SHIFT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.announcement_shift_interval(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_has_confirmed_shift_conflict(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_conflicts_with_announcement(uuid, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- 3. Candidature: blocco su INSERT e su passaggio ad accepted/interested
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_application_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('pending','interested','counter_offer','accepted') THEN
      PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NULL);
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('interested','accepted') THEN
    PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NULL);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_enforce_application_shift_conflict ON public.applications;
CREATE TRIGGER trg_00_enforce_application_shift_conflict
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_shift_conflict();

-- ============================================================
-- 4. Risposte a proposta: accettazione bloccata se sovrapposta
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_proposal_response_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  app record;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  SELECT worker_id, announcement_id INTO app
  FROM public.applications WHERE id = NEW.application_id;
  IF FOUND THEN
    PERFORM public.assert_no_worker_shift_conflict(app.worker_id, app.announcement_id, NULL);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_enforce_proposal_response_shift_conflict ON public.proposal_responses;
CREATE TRIGGER trg_00_enforce_proposal_response_shift_conflict
  BEFORE INSERT ON public.proposal_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_response_shift_conflict();

-- ============================================================
-- 5. Shift: ultima linea di difesa (creazione e riprogrammazione)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'scheduled'::public.shift_status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.worker_id IS NOT DISTINCT FROM OLD.worker_id
     AND NEW.announcement_id IS NOT DISTINCT FROM OLD.announcement_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_enforce_shift_conflict ON public.shifts;
CREATE TRIGGER trg_00_enforce_shift_conflict
  BEFORE INSERT OR UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shift_conflict();

-- ============================================================
-- 6. Modifica data/ora annuncio: non deve creare conflitti retroattivi
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_announcement_reschedule_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.service_date IS NOT DISTINCT FROM OLD.service_date
     AND NEW.service_time IS NOT DISTINCT FROM OLD.service_time
     AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.duration_hours IS NOT DISTINCT FROM OLD.duration_hours
     AND NEW.shift_duration_hours IS NOT DISTINCT FROM OLD.shift_duration_hours THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT s.id, s.worker_id FROM public.shifts s
    WHERE s.announcement_id = NEW.id AND s.status = 'scheduled'::public.shift_status
  LOOP
    PERFORM public.assert_no_worker_shift_conflict(r.worker_id, NEW.id, r.id);
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_enforce_announcement_reschedule_conflict ON public.announcements;
CREATE TRIGGER trg_00_enforce_announcement_reschedule_conflict
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_announcement_reschedule_conflict();

-- ============================================================
-- 7. Chiusura candidature pendenti diventate incompatibili
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_conflicting_pending_applications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
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
    UPDATE public.applications SET status = 'expired'::public.application_status
      WHERE id = r.id;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.worker_id, 'application_closed', 'application', r.id,
            jsonb_build_object('reason', 'confirmed_shift_conflict',
                               'confirmed_application_id', NEW.id));

    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    VALUES (
      NEW.worker_id,
      'Candidatura chiusa per sovrapposizione',
      'La tua candidatura è stata chiusa perché hai confermato un altro turno nello stesso orario.',
      '/messages/' || r.id::text,
      jsonb_build_object('kind','application_closed_shift_conflict',
                         'application_id', r.id,
                         'reason','confirmed_shift_conflict'),
      'application_closed_shift_conflict:' || r.id::text || ':' || NEW.worker_id::text
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_zz_close_conflicting_pending_applications ON public.applications;
CREATE TRIGGER trg_zz_close_conflicting_pending_applications
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.close_conflicting_pending_applications();

-- ============================================================
-- 8. RPC di conferma ristoratore: conflitto PRIMA dell'addebito
-- ============================================================
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

  -- Lock per-lavoratore: serializza conferme concorrenti sullo stesso worker.
  PERFORM pg_advisory_xact_lock(hashtextextended(app.worker_id::text, 42));

  IF app.announcement_id IS NOT NULL THEN
    SELECT * INTO ann FROM public.announcements WHERE id = app.announcement_id FOR UPDATE;
    IF FOUND AND ann.status IN ('cancelled', 'completed', 'draft') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_available');
    END IF;

    IF NOT public.announcement_is_in_operational_area(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'outside_operational_area');
    END IF;

    IF NOT public.announcement_offer_acceptable(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'offer_expired');
    END IF;

    -- Conflitto turni: PRIMA di qualunque addebito o cambio di stato.
    IF public.worker_conflicts_with_announcement(app.worker_id, app.announcement_id, NULL) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'worker_shift_conflict');
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
        WHEN err ILIKE '%WORKER_SHIFT_CONFLICT%' THEN 'worker_shift_conflict'
        WHEN err ILIKE '%OUTSIDE_OPERATIONAL_AREA%' THEN 'outside_operational_area'
        WHEN err ILIKE '%OFFER_EXPIRED%' OR err ILIKE '%ANNOUNCEMENT_EXPIRED%' THEN 'offer_expired'
        WHEN err ILIKE '%announcement_full%' THEN 'announcement_full'
        ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$function$;

-- ============================================================
-- 9. RLS helper: blocca anche l'INSERT via REST diretta
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_worker_insert_application(_announcement_id uuid, _worker_id uuid, _restaurant_id uuid, _status application_status)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _workers_needed integer := 1;
  _accepted_count integer := 0;
  _profile_completed boolean := false;
begin
  if auth.uid() is null or _worker_id <> auth.uid() then
    return false;
  end if;

  if not public.has_role(auth.uid(), 'worker'::public.app_role) then
    return false;
  end if;

  if _status <> 'pending'::public.application_status then
    return false;
  end if;

  select coalesce(profile_completed, false) into _profile_completed
    from public.profiles where id = _worker_id;
  if not _profile_completed then
    return false;
  end if;

  if _announcement_id is not null
     and not public.announcement_is_in_operational_area(_announcement_id) then
    return false;
  end if;

  if _announcement_id is not null
     and not public.announcement_is_applicable(_announcement_id) then
    return false;
  end if;

  -- Nessun turno confermato sovrapposto.
  if _announcement_id is not null
     and public.worker_conflicts_with_announcement(_worker_id, _announcement_id, null) then
    return false;
  end if;

  select greatest(1, coalesce(max(j.workers_needed), 1))
    into _workers_needed
  from public.job_requests j
  where j.announcement_id = _announcement_id;

  if not exists (
    select 1
    from public.announcements a
    where a.id = _announcement_id
      and a.restaurant_id = _restaurant_id
      and a.status in ('active'::public.announcement_status, 'assigned'::public.announcement_status)
  ) then
    return false;
  end if;

  select count(*)
    into _accepted_count
  from public.applications existing
  where existing.announcement_id = _announcement_id
    and existing.status = 'accepted'::public.application_status;

  if exists (
    select 1 from public.applications d
    where d.announcement_id = _announcement_id
      and d.worker_id = _worker_id
      and d.status not in ('cancelled'::public.application_status,
                           'rejected'::public.application_status,
                           'expired'::public.application_status)
  ) then
    return false;
  end if;

  return _accepted_count < _workers_needed;
end;
$function$;

-- ============================================================
-- 10. Notifica di conferma: destinazione stabile con conversation_id
-- ============================================================
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
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_link := '/messages/' || NEW.id::text;
    v_recipient := NEW.worker_id;
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
        v_recipient,
        v_title,
        v_body,
        v_link,
        jsonb_build_object(
          'application_id', NEW.id,
          'conversation_id', NEW.id,
          'shift_id', v_shift_id,
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

-- La notifica di conferma deve essere emessa DOPO la creazione dello shift
-- (trg_create_shift_on_accept), così "Apri chat" trova sempre turno e chat
-- gia' esistenti e leggibili. I trigger si eseguono in ordine alfabetico:
-- rinomino la notifica con prefisso che la colloca dopo la creazione turno.
DROP TRIGGER IF EXISTS trg_notify_application_status_change ON public.applications;
CREATE TRIGGER trg_zy_notify_application_status_change
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_change();