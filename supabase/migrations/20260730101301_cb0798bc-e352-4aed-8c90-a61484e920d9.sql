-- 1) IMPACT SUMMARY -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_account_deletion_impact()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ann int := 0;
  _apps int := 0;
  _proposals int := 0;
  _shifts int := 0;
  _imminent int := 0;
  _completed int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized');
  END IF;

  SELECT count(*) INTO _ann
  FROM public.announcements a
  WHERE a.restaurant_id = _uid
    AND a.status::text NOT IN ('cancelled', 'completed');

  SELECT count(*) INTO _apps
  FROM public.applications ap
  WHERE ap.restaurant_id = _uid
    AND ap.status::text IN ('pending', 'interested', 'counter_offer');

  SELECT count(DISTINCT m.application_id) INTO _proposals
  FROM public.messages m
  JOIN public.applications ap ON ap.id = m.application_id
  WHERE ap.restaurant_id = _uid
    AND m.action_type = 'propose_shift'
    AND ap.status::text IN ('pending', 'interested', 'counter_offer');

  SELECT count(*) INTO _shifts
  FROM public.shifts s
  WHERE s.restaurant_id = _uid
    AND s.status::text = 'scheduled'
    AND s.shift_date >= current_date;

  SELECT count(*) INTO _imminent
  FROM public.shifts s
  WHERE s.restaurant_id = _uid
    AND s.status::text = 'scheduled'
    AND s.shift_date <= (current_date + 1);

  SELECT count(*) INTO _completed
  FROM public.shifts s
  WHERE s.restaurant_id = _uid
    AND s.status::text = 'completed';

  RETURN jsonb_build_object(
    'ok', true,
    'announcements', _ann,
    'applications', _apps,
    'proposals', _proposals,
    'assigned_shifts', _shifts,
    'imminent_shifts', _imminent,
    'completed_shifts', _completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_account_deletion_impact() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_deletion_impact() TO authenticated, service_role;

-- 2) TRANSACTIONAL CLEANUP ------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_restaurant_account_deletion(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cancelled_ann int := 0;
  _cancelled_apps int := 0;
  _cancelled_shifts int := 0;
  _notifs int := 0;
  _n int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'missing_user');
  END IF;

  -- 2a) Notify workers with a FUTURE ASSIGNED SHIFT (highest priority).
  WITH target AS (
    SELECT s.id AS shift_id, s.worker_id, s.announcement_id, s.shift_date,
           a.service_time,
           (SELECT ap.id FROM public.applications ap
             WHERE ap.announcement_id = s.announcement_id
               AND ap.worker_id = s.worker_id
             ORDER BY ap.created_at DESC LIMIT 1) AS application_id
    FROM public.shifts s
    LEFT JOIN public.announcements a ON a.id = s.announcement_id
    WHERE s.restaurant_id = _uid
      AND s.worker_id IS NOT NULL
      AND s.status::text NOT IN ('completed', 'cancelled', 'no_show')
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    SELECT t.worker_id,
           'Turno annullato',
           'Il turno del ' || to_char(t.shift_date, 'DD/MM/YYYY')
             || coalesce(' alle ' || to_char(t.service_time, 'HH24:MI'), '')
             || ' è stato annullato perché il ristoratore ha eliminato il proprio account.',
           coalesce('/messages/' || t.application_id::text, '/shifts?shift=' || t.shift_id::text),
           jsonb_build_object(
             'kind', 'restaurant_account_deleted_shift',
             'shift_id', t.shift_id,
             'announcement_id', t.announcement_id,
             'reason', 'restaurant_account_deleted',
             'cta', 'Vedi dettagli'
           ),
           'restaurant_deleted:' || _uid::text || ':shift:' || t.shift_id::text || ':' || t.worker_id::text
    FROM target t
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM ins;
  _notifs := _notifs + _n;

  -- 2b) Notify workers with a PENDING PROPOSAL (no future shift).
  WITH target AS (
    SELECT DISTINCT ap.id AS application_id, ap.worker_id, ap.announcement_id
    FROM public.applications ap
    WHERE ap.restaurant_id = _uid
      AND ap.status::text NOT IN ('cancelled', 'expired', 'rejected', 'not_interested')
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.application_id = ap.id AND m.action_type = 'propose_shift'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shifts s
        WHERE s.restaurant_id = _uid
          AND s.worker_id = ap.worker_id
          AND s.announcement_id = ap.announcement_id
          AND s.status::text NOT IN ('completed', 'cancelled', 'no_show')
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    SELECT t.worker_id,
           'Proposta annullata',
           'La proposta di lavoro non è più disponibile perché il profilo del ristoratore è stato eliminato.',
           '/messages/' || t.application_id::text,
           jsonb_build_object(
             'kind', 'restaurant_account_deleted_proposal',
             'application_id', t.application_id,
             'announcement_id', t.announcement_id,
             'reason', 'restaurant_account_deleted'
           ),
           'restaurant_deleted:' || _uid::text || ':proposal:' || t.application_id::text || ':' || t.worker_id::text
    FROM target t
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM ins;
  _notifs := _notifs + _n;

  -- 2c) Notify workers with an OPEN APPLICATION (no shift, no proposal).
  WITH target AS (
    SELECT ap.id AS application_id, ap.worker_id, ap.announcement_id
    FROM public.applications ap
    WHERE ap.restaurant_id = _uid
      AND ap.status::text NOT IN ('cancelled', 'expired', 'rejected', 'not_interested')
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.application_id = ap.id AND m.action_type = 'propose_shift'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shifts s
        WHERE s.restaurant_id = _uid
          AND s.worker_id = ap.worker_id
          AND s.announcement_id = ap.announcement_id
          AND s.status::text NOT IN ('completed', 'cancelled', 'no_show')
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
    SELECT t.worker_id,
           'Annuncio annullato',
           'Il ristoratore ha eliminato il proprio account. L''annuncio e la tua candidatura sono stati annullati.',
           '/messages/' || t.application_id::text,
           jsonb_build_object(
             'kind', 'restaurant_account_deleted_application',
             'application_id', t.application_id,
             'announcement_id', t.announcement_id,
             'reason', 'restaurant_account_deleted'
           ),
           'restaurant_deleted:' || _uid::text || ':application:' || t.application_id::text || ':' || t.worker_id::text
    FROM target t
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM ins;
  _notifs := _notifs + _n;

  -- 2d) Cancel future / non-final shifts, keeping the historical worker link.
  UPDATE public.shifts s
     SET status = 'cancelled'
   WHERE s.restaurant_id = _uid
     AND s.status::text NOT IN ('completed', 'cancelled', 'no_show');
  GET DIAGNOSTICS _cancelled_shifts = ROW_COUNT;

  -- 2e) Cancel every non-final application.
  UPDATE public.applications ap
     SET status = 'cancelled',
         updated_at = now()
   WHERE ap.restaurant_id = _uid
     AND ap.status::text NOT IN ('cancelled', 'expired', 'rejected');
  GET DIAGNOSTICS _cancelled_apps = ROW_COUNT;

  -- 2f) Cancel + anonymize active/future announcements.
  UPDATE public.announcements a
     SET status = 'cancelled',
         cancellation_reason = 'restaurant_account_deleted',
         cancelled_at = coalesce(a.cancelled_at, now()),
         cancelled_by = _uid,
         assigned_worker_id = NULL,
         location_address = NULL,
         job_address = NULL,
         job_contact_person_name = NULL,
         job_contact_person_phone = NULL,
         job_contact_person_email = NULL,
         job_access_restrictions = NULL,
         job_additional_directions = NULL
   WHERE a.restaurant_id = _uid
     AND a.status::text NOT IN ('cancelled', 'completed');
  GET DIAGNOSTICS _cancelled_ann = ROW_COUNT;

  -- 2g) Anonymize contact data on already-closed announcements (history kept).
  UPDATE public.announcements a
     SET job_contact_person_name = NULL,
         job_contact_person_phone = NULL,
         job_contact_person_email = NULL
   WHERE a.restaurant_id = _uid
     AND (a.job_contact_person_name IS NOT NULL
          OR a.job_contact_person_phone IS NOT NULL
          OR a.job_contact_person_email IS NOT NULL);

  -- 2h) Rewrite stale notification links pointing at cancelled announcements.
  UPDATE public.notifications n
     SET link = coalesce(
       (SELECT '/messages/' || ap.id::text
          FROM public.applications ap
         WHERE ap.worker_id = n.user_id
           AND ap.announcement_id = a.id
         ORDER BY ap.created_at DESC LIMIT 1),
       '/jobs')
    FROM public.announcements a
   WHERE a.restaurant_id = _uid
     AND a.status::text = 'cancelled'
     AND n.link = '/announcements/' || a.id::text;

  INSERT INTO public.admin_audit_log (actor, action, target_user, reason, metadata)
  VALUES (
    _uid,
    'restaurant_account_deleted_cleanup',
    _uid,
    'restaurant_account_deleted',
    jsonb_build_object(
      'cancelled_announcements', _cancelled_ann,
      'cancelled_applications', _cancelled_apps,
      'cancelled_shifts', _cancelled_shifts,
      'notifications_created', _notifs
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cancelled_announcements', _cancelled_ann,
    'cancelled_applications', _cancelled_apps,
    'cancelled_shifts', _cancelled_shifts,
    'notifications_created', _notifs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_restaurant_account_deletion(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_restaurant_account_deletion(uuid) TO service_role;

-- 3) GUARDS ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_application_on_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id IN (NEW.worker_id, NEW.restaurant_id)
      AND coalesce(moderation_hidden, false) = true
  ) THEN
    RAISE EXCEPTION 'moderation_blocked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id IN (NEW.worker_id, NEW.restaurant_id)
      AND coalesce(is_deleted, false) = true
  ) THEN
    RAISE EXCEPTION 'account_deleted_blocked';
  END IF;

  RETURN NEW;
END;
$$;

-- Block accepting / assigning against a deleted restaurant.
CREATE OR REPLACE FUNCTION public.block_application_accept_on_deleted_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status::text = 'accepted' AND coalesce(OLD.status::text, '') <> 'accepted' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.restaurant_id AND coalesce(is_deleted, false) = true
    ) THEN
      RAISE EXCEPTION 'account_deleted_blocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_block_accept_deleted_restaurant ON public.applications;
CREATE TRIGGER trg_00_block_accept_deleted_restaurant
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.block_application_accept_on_deleted_restaurant();

-- 4) RLS: never expose announcements of a deleted restaurant --------------
DROP POLICY IF EXISTS "Authenticated can browse active announcements" ON public.announcements;
CREATE POLICY "Authenticated can browse active announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  status = 'active'::announcement_status
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = announcements.restaurant_id
      AND coalesce(p.is_deleted, false) = true
  )
);
