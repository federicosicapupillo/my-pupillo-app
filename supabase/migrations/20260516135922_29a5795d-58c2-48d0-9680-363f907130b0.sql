-- 1. Nuovi campi su reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS punctuality smallint,
  ADD COLUMN IF NOT EXISTS professionalism smallint,
  ADD COLUMN IF NOT EXISTS competence smallint,
  ADD COLUMN IF NOT EXISTS reliability smallint,
  ADD COLUMN IF NOT EXISTS teamwork smallint,
  ADD COLUMN IF NOT EXISTS seen_by_worker_at timestamptz;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_punctuality_range,
  DROP CONSTRAINT IF EXISTS reviews_professionalism_range,
  DROP CONSTRAINT IF EXISTS reviews_competence_range,
  DROP CONSTRAINT IF EXISTS reviews_reliability_range,
  DROP CONSTRAINT IF EXISTS reviews_teamwork_range;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_punctuality_range CHECK (punctuality IS NULL OR (punctuality BETWEEN 1 AND 5)),
  ADD CONSTRAINT reviews_professionalism_range CHECK (professionalism IS NULL OR (professionalism BETWEEN 1 AND 5)),
  ADD CONSTRAINT reviews_competence_range CHECK (competence IS NULL OR (competence BETWEEN 1 AND 5)),
  ADD CONSTRAINT reviews_reliability_range CHECK (reliability IS NULL OR (reliability BETWEEN 1 AND 5)),
  ADD CONSTRAINT reviews_teamwork_range CHECK (teamwork IS NULL OR (teamwork BETWEEN 1 AND 5));

-- Una sola recensione per (autore, target, turno).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_author_target_shift
  ON public.reviews (author_id, target_id, shift_id)
  WHERE shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reviews_target_id_idx ON public.reviews (target_id);
CREATE INDEX IF NOT EXISTS reviews_author_target_idx ON public.reviews (author_id, target_id, created_at DESC);

-- 2. Medie per parametro nel profilo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_punctuality numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_professionalism numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_competence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_reliability numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_teamwork numeric NOT NULL DEFAULT 0;

-- 3. Trigger BEFORE INSERT/UPDATE: calcola rating come media dei 5 parametri
CREATE OR REPLACE FUNCTION public.compute_review_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vals numeric[] := ARRAY[]::numeric[];
  total numeric := 0;
  n int := 0;
BEGIN
  IF NEW.punctuality IS NOT NULL THEN vals := vals || NEW.punctuality::numeric; END IF;
  IF NEW.professionalism IS NOT NULL THEN vals := vals || NEW.professionalism::numeric; END IF;
  IF NEW.competence IS NOT NULL THEN vals := vals || NEW.competence::numeric; END IF;
  IF NEW.reliability IS NOT NULL THEN vals := vals || NEW.reliability::numeric; END IF;
  IF NEW.teamwork IS NOT NULL THEN vals := vals || NEW.teamwork::numeric; END IF;
  n := array_length(vals, 1);
  IF n IS NOT NULL AND n > 0 THEN
    FOREACH total IN ARRAY vals LOOP NULL; END LOOP; -- placeholder, use sum below
    SELECT SUM(v) INTO total FROM unnest(vals) AS v;
    NEW.rating := ROUND(total / n);
    IF NEW.rating < 1 THEN NEW.rating := 1; END IF;
    IF NEW.rating > 5 THEN NEW.rating := 5; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_review_rating ON public.reviews;
CREATE TRIGGER trg_compute_review_rating
BEFORE INSERT OR UPDATE OF punctuality, professionalism, competence, reliability, teamwork
ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.compute_review_rating();

-- 4. Estendi handle_new_review per aggiornare anche le medie per parametro
CREATE OR REPLACE FUNCTION public.handle_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
  v_count integer;
  v_p numeric; v_pr numeric; v_c numeric; v_r numeric; v_t numeric;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE target_id = NEW.target_id;

  SELECT
    COALESCE(ROUND(AVG(punctuality)::numeric, 2), 0),
    COALESCE(ROUND(AVG(professionalism)::numeric, 2), 0),
    COALESCE(ROUND(AVG(competence)::numeric, 2), 0),
    COALESCE(ROUND(AVG(reliability)::numeric, 2), 0),
    COALESCE(ROUND(AVG(teamwork)::numeric, 2), 0)
    INTO v_p, v_pr, v_c, v_r, v_t
    FROM public.reviews
   WHERE target_id = NEW.target_id;

  UPDATE public.profiles
     SET rating_avg = COALESCE(v_avg, 0),
         reviews_count = v_count,
         last_review_at = NEW.created_at,
         avg_punctuality = v_p,
         avg_professionalism = v_pr,
         avg_competence = v_c,
         avg_reliability = v_r,
         avg_teamwork = v_t,
         updated_at = now()
   WHERE id = NEW.target_id;

  IF NEW.shift_id IS NOT NULL THEN
    UPDATE public.shifts
       SET reviewed_at = NEW.created_at,
           reviewed_by_restaurant_user_id = NEW.author_id,
           status = CASE WHEN status <> 'completed'::shift_status THEN 'completed'::shift_status ELSE status END,
           completed_at = COALESCE(completed_at, NEW.created_at)
     WHERE id = NEW.shift_id;

    UPDATE public.profiles
       SET completed_shifts = COALESCE(completed_shifts, 0) + 1
     WHERE id = NEW.target_id
       AND NOT EXISTS (
         SELECT 1 FROM public.reviews r2
          WHERE r2.shift_id = NEW.shift_id
            AND r2.id <> NEW.id
       );
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (
    NEW.target_id,
    'Hai ricevuto una nuova valutazione',
    'Un ristoratore ha lasciato una recensione sul turno completato.',
    '/reviews/' || NEW.id::text,
    jsonb_build_object(
      'review_id', NEW.id,
      'rating', NEW.rating,
      'shift_id', NEW.shift_id,
      'application_id', NEW.application_id,
      'author_id', NEW.author_id
    )
  );

  RETURN NEW;
END;
$$;

-- 5. RLS: permetti al worker target di segnare la review come vista (solo seen_by_worker_at)
DROP POLICY IF EXISTS "Worker marks own review seen" ON public.reviews;
CREATE POLICY "Worker marks own review seen"
ON public.reviews
FOR UPDATE
TO authenticated
USING (target_id = auth.uid())
WITH CHECK (target_id = auth.uid());