-- 1. Secure, participant-only status source of truth for the reciprocal review flow.
CREATE OR REPLACE FUNCTION public.get_shift_review_status(_shift_id uuid)
RETURNS TABLE(
  shift_id uuid,
  viewer_role text,
  shift_status text,
  mine_exists boolean,
  mine_review_id uuid,
  other_exists boolean,
  other_review_id uuid,
  unlocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_worker uuid;
  v_restaurant uuid;
  v_status text;
  v_role text;
  v_mine uuid;
  v_other uuid;
BEGIN
  IF v_uid IS NULL OR _shift_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.worker_id, s.restaurant_id, s.status::text
    INTO v_worker, v_restaurant, v_status
    FROM public.shifts s
   WHERE s.id = _shift_id;

  IF v_worker IS NULL THEN
    RETURN;
  END IF;

  IF v_uid = v_worker THEN
    v_role := 'worker';
  ELSIF v_uid = v_restaurant THEN
    v_role := 'restaurant';
  ELSE
    -- Not a participant: no information at all.
    RETURN;
  END IF;

  SELECT r.id INTO v_mine
    FROM public.reviews r
   WHERE r.shift_id = _shift_id AND r.author_id = v_uid
   LIMIT 1;

  SELECT r.id INTO v_other
    FROM public.reviews r
   WHERE r.shift_id = _shift_id
     AND r.target_id = v_uid
     AND r.author_id = CASE WHEN v_role = 'worker' THEN v_restaurant ELSE v_worker END
   LIMIT 1;

  RETURN QUERY SELECT
    _shift_id,
    v_role,
    v_status,
    v_mine IS NOT NULL,
    v_mine,
    v_other IS NOT NULL,
    -- Never expose the locked review id: only after mutual unlock.
    CASE WHEN v_mine IS NOT NULL AND v_other IS NOT NULL THEN v_other ELSE NULL END,
    (v_mine IS NOT NULL AND v_other IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shift_review_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shift_review_status(uuid) TO authenticated;

-- 2. End-of-shift notification: send the worker to the shift detail page
--    (review section) when an application exists, instead of the shifts list.
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
  IF NEW.status <> 'completed'::shift_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed'::shift_status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
     WHERE r.shift_id = NEW.id
       AND r.author_id = NEW.worker_id
  ) INTO v_already_reviewed;
  IF v_already_reviewed THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.worker_id
       AND (n.metadata->>'type') = 'review_pending_worker'
       AND (n.metadata->>'shift_id')::uuid = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.announcement_id IS NOT NULL THEN
    SELECT id INTO v_app_id
      FROM public.applications
     WHERE announcement_id = NEW.announcement_id
       AND worker_id = NEW.worker_id
     ORDER BY updated_at DESC
     LIMIT 1;
  END IF;

  v_link := CASE
    WHEN v_app_id IS NOT NULL
      THEN '/messages/' || v_app_id::text || '?action=review'
    ELSE '/shifts?tab=to-review&shift=' || NEW.id::text
  END;

  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (
    NEW.worker_id,
    'Turno completato — lascia una recensione',
    'Raccontaci com''è andato il turno e valuta la tua esperienza.',
    v_link,
    jsonb_build_object(
      'type', 'review_pending_worker',
      'shift_id', NEW.id,
      'application_id', v_app_id
    )
  );

  RETURN NEW;
END;
$$;