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
  v_w2r_id uuid;
  v_r2w_id uuid;
  v_worker_user uuid;
  v_restaurant_user uuid;
  v_opposite text;
BEGIN
  -- Reciprocal flow requires a shift binding.
  IF NEW.shift_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for the same shift to close the
  -- READ COMMITTED visibility gap: without this, two parallel
  -- transactions inserting the reciprocal pair cannot see each
  -- other's uncommitted rows and both would leave the pair locked.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('blind_review:' || NEW.shift_id::text, 0)
  );

  v_opposite := CASE NEW.direction
    WHEN 'worker_to_restaurant' THEN 'restaurant_to_worker'
    WHEN 'restaurant_to_worker' THEN 'worker_to_restaurant'
    ELSE NULL
  END;
  IF v_opposite IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_reciprocal_id
  FROM public.reviews
  WHERE shift_id = NEW.shift_id
    AND direction = v_opposite
    AND author_id = NEW.target_id
    AND target_id = NEW.author_id
    AND id <> NEW.id
  LIMIT 1;

  IF v_reciprocal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id < v_reciprocal_id THEN
    v_first_id := NEW.id;
    v_second_id := v_reciprocal_id;
  ELSE
    v_first_id := v_reciprocal_id;
    v_second_id := NEW.id;
  END IF;

  PERFORM 1 FROM public.reviews WHERE id = v_first_id FOR UPDATE;
  PERFORM 1 FROM public.reviews WHERE id = v_second_id FOR UPDATE;

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

  UPDATE public.reviews
     SET is_visible_to_worker      = true,
         is_visible_to_restaurants = true,
         visible_at                = COALESCE(visible_at, now()),
         updated_at                = now()
   WHERE id IN (v_first_id, v_second_id);

  IF NEW.direction = 'worker_to_restaurant' THEN
    v_w2r_id := NEW.id;
    v_r2w_id := v_reciprocal_id;
    v_restaurant_user := NEW.target_id;
    v_worker_user     := NEW.author_id;
  ELSE
    v_r2w_id := NEW.id;
    v_w2r_id := v_reciprocal_id;
    v_worker_user     := NEW.target_id;
    v_restaurant_user := NEW.author_id;
  END IF;

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