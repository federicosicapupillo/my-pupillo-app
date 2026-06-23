-- ============================================================
-- Phase 2: Blind reciprocal review triggers (functions only)
-- ============================================================

-- ----------------------------------------------------------------
-- TRIGGER 1: BEFORE INSERT — auto-direction + force locked visibility
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reviews_blind_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_is_restaurant boolean;
  v_author_is_worker boolean;
BEGIN
  -- Determine author role from user_roles.
  SELECT
    bool_or(role = 'restaurant'),
    bool_or(role = 'worker')
  INTO v_author_is_restaurant, v_author_is_worker
  FROM public.user_roles
  WHERE user_id = NEW.author_id;

  IF COALESCE(v_author_is_restaurant, false) THEN
    NEW.direction := 'restaurant_to_worker';
  ELSIF COALESCE(v_author_is_worker, false) THEN
    NEW.direction := 'worker_to_restaurant';
  ELSE
    -- Fallback: keep whatever was passed if author has neither role,
    -- but require it to be a valid value (CHECK already enforces).
    NEW.direction := COALESCE(NEW.direction, 'worker_to_restaurant');
  END IF;

  -- Force locked visibility on insert — client cannot override.
  NEW.is_visible_to_worker := false;
  NEW.is_visible_to_restaurants := false;
  NEW.visible_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_blind_before_insert ON public.reviews;
CREATE TRIGGER trg_reviews_blind_before_insert
BEFORE INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.reviews_blind_before_insert();


-- ----------------------------------------------------------------
-- TRIGGER 2: AFTER INSERT — atomic reciprocal unlock + notifications
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reviews_blind_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reciprocal_id uuid;
  v_first_id uuid;
  v_second_id uuid;
  v_w2r_id uuid;  -- worker_to_restaurant review id
  v_r2w_id uuid;  -- restaurant_to_worker review id
  v_worker_user uuid;     -- target of r2w review
  v_restaurant_user uuid; -- target of w2r review
  v_opposite text;
BEGIN
  -- Reciprocal flow requires a shift binding.
  IF NEW.shift_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_opposite := CASE NEW.direction
    WHEN 'worker_to_restaurant' THEN 'restaurant_to_worker'
    WHEN 'restaurant_to_worker' THEN 'worker_to_restaurant'
    ELSE NULL
  END;
  IF v_opposite IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the symmetric row (same shift, opposite direction, author/target swapped).
  SELECT id INTO v_reciprocal_id
  FROM public.reviews
  WHERE shift_id = NEW.shift_id
    AND direction = v_opposite
    AND author_id = NEW.target_id
    AND target_id = NEW.author_id
    AND id <> NEW.id
  LIMIT 1;

  IF v_reciprocal_id IS NULL THEN
    -- No counterpart yet — keep this row locked.
    RETURN NEW;
  END IF;

  -- Lock both rows in a deterministic order to prevent deadlocks
  -- when two inserts race.
  IF NEW.id < v_reciprocal_id THEN
    v_first_id := NEW.id;
    v_second_id := v_reciprocal_id;
  ELSE
    v_first_id := v_reciprocal_id;
    v_second_id := NEW.id;
  END IF;

  PERFORM 1 FROM public.reviews WHERE id = v_first_id FOR UPDATE;
  PERFORM 1 FROM public.reviews WHERE id = v_second_id FOR UPDATE;

  -- Re-check the reciprocal still matches after locking (defensive).
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE id = v_reciprocal_id
      AND shift_id = NEW.shift_id
      AND direction = v_opposite
      AND author_id = NEW.target_id
      AND target_id = NEW.author_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Atomic unlock of both rows.
  UPDATE public.reviews
     SET is_visible_to_worker      = true,
         is_visible_to_restaurants = true,
         visible_at                = COALESCE(visible_at, now()),
         updated_at                = now()
   WHERE id IN (v_first_id, v_second_id);

  -- Identify which review is which direction, and who receives which.
  IF NEW.direction = 'worker_to_restaurant' THEN
    v_w2r_id := NEW.id;
    v_r2w_id := v_reciprocal_id;
    v_restaurant_user := NEW.target_id;  -- target of w2r
    v_worker_user     := NEW.author_id;  -- author of w2r = target of r2w
  ELSE
    v_r2w_id := NEW.id;
    v_w2r_id := v_reciprocal_id;
    v_worker_user     := NEW.target_id;  -- target of r2w
    v_restaurant_user := NEW.author_id;  -- author of r2w = target of w2r
  END IF;

  -- Notification for the WORKER: link to the r2w review they received.
  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    v_worker_user,
    'La recensione è ora disponibile',
    'Entrambe le recensioni per questo turno sono ora visibili.',
    '/reviews/' || v_r2w_id::text,
    jsonb_build_object(
      'kind', 'review_unlocked',
      'shift_id', NEW.shift_id,
      'review_id', v_r2w_id
    ),
    'review_unlocked:' || NEW.shift_id::text || ':' || v_worker_user::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  -- Notification for the RESTAURANT: link to the w2r review they received.
  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    v_restaurant_user,
    'La recensione è ora disponibile',
    'Entrambe le recensioni per questo turno sono ora visibili.',
    '/reviews/' || v_w2r_id::text,
    jsonb_build_object(
      'kind', 'review_unlocked',
      'shift_id', NEW.shift_id,
      'review_id', v_w2r_id
    ),
    'review_unlocked:' || NEW.shift_id::text || ':' || v_restaurant_user::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_blind_after_insert ON public.reviews;
CREATE TRIGGER trg_reviews_blind_after_insert
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.reviews_blind_after_insert();