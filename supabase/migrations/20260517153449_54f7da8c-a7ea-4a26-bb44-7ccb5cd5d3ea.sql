
-- ===========================================================================
-- Reputation Score system for workers
-- ===========================================================================

-- 1) New columns on profiles (worker reputation cache)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reputation_level text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS reputation_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS punctuality_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_cancel_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_minutes integer,
  ADD COLUMN IF NOT EXISTS rehire_restaurants_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rehire_yes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rehire_total_answers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distinct_restaurants_count integer NOT NULL DEFAULT 0;

-- 2) Extend reviews with additional criteria + rehire question
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS communication smallint
    CHECK (communication IS NULL OR (communication BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS staff_collaboration smallint
    CHECK (staff_collaboration IS NULL OR (staff_collaboration BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS appearance smallint
    CHECK (appearance IS NULL OR (appearance BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS would_rehire text
    CHECK (would_rehire IS NULL OR would_rehire IN ('yes','maybe','no')),
  ADD COLUMN IF NOT EXISTS positive_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS negative_tags text[] NOT NULL DEFAULT '{}';

-- 3) Serious incidents table (kept separate from reviews)
CREATE TABLE IF NOT EXISTS public.worker_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  shift_id uuid,
  application_id uuid,
  kind text NOT NULL CHECK (kind IN ('no_show','abandoned','misconduct','offensive','client_issue','other')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX IF NOT EXISTS idx_worker_incidents_worker ON public.worker_incidents(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_incidents_status ON public.worker_incidents(status);

ALTER TABLE public.worker_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurants create incidents" ON public.worker_incidents;
CREATE POLICY "Restaurants create incidents"
  ON public.worker_incidents FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id = auth.uid() AND has_role(auth.uid(), 'restaurant'::app_role));

DROP POLICY IF EXISTS "Parties view incidents" ON public.worker_incidents;
CREATE POLICY "Parties view incidents"
  ON public.worker_incidents FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid() OR restaurant_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage incidents" ON public.worker_incidents;
CREATE POLICY "Admins manage incidents"
  ON public.worker_incidents FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Worker badges table (recomputed by the scorer)
CREATE TABLE IF NOT EXISTS public.worker_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  badge text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, badge)
);

CREATE INDEX IF NOT EXISTS idx_worker_badges_worker ON public.worker_badges(worker_id);

ALTER TABLE public.worker_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges public read" ON public.worker_badges;
CREATE POLICY "Badges public read"
  ON public.worker_badges FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages badges" ON public.worker_badges;
CREATE POLICY "Service role manages badges"
  ON public.worker_badges FOR ALL
  USING (auth.role() = 'service_role');

-- 5) Core recompute function
CREATE OR REPLACE FUNCTION public.recompute_worker_reputation(_worker uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_worker boolean;
  v_completed int := 0;
  v_scheduled_or_done int := 0;
  v_no_show int := 0;
  v_cancelled int := 0;
  v_total_shifts int := 0;
  v_distinct_rest int := 0;
  v_rehire_rest int := 0;
  v_reviews_count int := 0;
  v_avg_rating numeric := 0;
  v_avg_punct numeric := 0;
  v_avg_prof numeric := 0;
  v_avg_comm numeric := 0;
  v_avg_compt numeric := 0;
  v_avg_rel numeric := 0;
  v_avg_team numeric := 0;
  v_yes int := 0;
  v_maybe int := 0;
  v_no int := 0;
  v_rehire_total int := 0;
  v_verified_incidents int := 0;
  v_completion_pct int := 0;
  v_punctuality_pct int := 0;
  v_score_reliability numeric := 0;
  v_score_quality numeric := 0;
  v_score_professionalism numeric := 0;
  v_score_experience numeric := 0;
  v_score_verified numeric := 0;
  v_final int := 0;
  v_level text := 'new';
  v_profile_complete boolean;
  v_phone_verified boolean;
  v_avatar_ok boolean;
  v_doc_ok boolean;
  v_completeness int := 0;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _worker AND role = 'worker')
    INTO v_is_worker;
  IF NOT v_is_worker THEN RETURN; END IF;

  -- Shift counters
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*),
    COUNT(DISTINCT restaurant_id)
  INTO v_completed, v_no_show, v_cancelled, v_total_shifts, v_distinct_rest
  FROM public.shifts
  WHERE worker_id = _worker;

  -- Rehire: distinct restaurants who had >= 2 completed shifts with this worker
  SELECT COUNT(*) INTO v_rehire_rest FROM (
    SELECT restaurant_id
      FROM public.shifts
     WHERE worker_id = _worker AND status = 'completed'
     GROUP BY restaurant_id
    HAVING COUNT(*) >= 2
  ) t;

  -- Reviews aggregates
  SELECT
    COUNT(*),
    COALESCE(AVG(rating), 0),
    COALESCE(AVG(punctuality), 0),
    COALESCE(AVG(professionalism), 0),
    COALESCE(AVG(communication), 0),
    COALESCE(AVG(competence), 0),
    COALESCE(AVG(reliability), 0),
    COALESCE(AVG(teamwork), 0),
    COUNT(*) FILTER (WHERE would_rehire = 'yes'),
    COUNT(*) FILTER (WHERE would_rehire = 'maybe'),
    COUNT(*) FILTER (WHERE would_rehire = 'no'),
    COUNT(*) FILTER (WHERE would_rehire IS NOT NULL)
  INTO v_reviews_count, v_avg_rating, v_avg_punct, v_avg_prof, v_avg_comm,
       v_avg_compt, v_avg_rel, v_avg_team, v_yes, v_maybe, v_no, v_rehire_total
  FROM public.reviews
  WHERE target_id = _worker;

  -- Verified serious incidents
  SELECT COUNT(*) INTO v_verified_incidents
    FROM public.worker_incidents
   WHERE worker_id = _worker AND status = 'verified';

  -- Completion / punctuality estimates
  v_scheduled_or_done := v_completed + v_no_show + v_cancelled;
  IF v_scheduled_or_done > 0 THEN
    v_completion_pct := ROUND(100.0 * v_completed / v_scheduled_or_done);
  END IF;
  IF v_reviews_count > 0 THEN
    v_punctuality_pct := ROUND(100.0 * v_avg_punct / 5.0);
  ELSIF v_completed > 0 THEN
    v_punctuality_pct := 100; -- optimistic default until reviewed
  END IF;

  -- Profile completeness checks
  SELECT
    COALESCE(profile_completed, false),
    COALESCE(phone_verified, false),
    (avatar_url IS NOT NULL AND length(btrim(avatar_url)) > 0),
    (id_document_path IS NOT NULL AND length(btrim(id_document_path)) > 0)
  INTO v_profile_complete, v_phone_verified, v_avatar_ok, v_doc_ok
  FROM public.profiles WHERE id = _worker;

  v_completeness :=
    (CASE WHEN v_profile_complete THEN 2 ELSE 0 END) +
    (CASE WHEN v_phone_verified  THEN 3 ELSE 0 END) +
    (CASE WHEN v_avatar_ok       THEN 2 ELSE 0 END) +
    (CASE WHEN v_doc_ok          THEN 3 ELSE 0 END);
  IF v_completeness > 10 THEN v_completeness := 10; END IF;

  -- ====== SCORING ======
  -- 1. Affidabilità operativa (40)
  -- completion ratio 15 + punctuality 10 + no-show penalty 8 + cancel penalty 4 + response 3
  v_score_reliability :=
      15.0 * LEAST(1.0, v_completion_pct / 100.0)
    + 10.0 * LEAST(1.0, v_punctuality_pct / 100.0)
    +  8.0 * GREATEST(0.0, 1.0 - (v_no_show::numeric * 0.5))
    +  4.0 * GREATEST(0.0, 1.0 - (v_cancelled::numeric * 0.25))
    +  3.0;   -- baseline response-time slot (we don't track it precisely yet)
  -- Verified incidents: each removes up to 6 points from reliability
  v_score_reliability := GREATEST(0, v_score_reliability - LEAST(20, v_verified_incidents * 6));

  -- 2. Qualità (25) — average of rating-based metrics, scaled 0..25
  IF v_reviews_count > 0 THEN
    v_score_quality := 25.0 * (
      (v_avg_rating + v_avg_compt + v_avg_punct) / (3.0 * 5.0)
    );
  END IF;

  -- 3. Professionalità (15) — comm + team + rehire share
  IF v_reviews_count > 0 THEN
    v_score_professionalism :=
        7.0 * ((COALESCE(v_avg_comm, 0) + COALESCE(v_avg_team, 0)) / 10.0)
      + 8.0 * (CASE WHEN v_rehire_total > 0
                    THEN (v_yes * 1.0 + v_maybe * 0.5) / v_rehire_total
                    ELSE 0 END);
  END IF;
  v_score_professionalism := GREATEST(0, v_score_professionalism - LEAST(10, v_verified_incidents * 4));

  -- 4. Esperienza (10) — completed shifts + distinct restaurants + rehire restaurants
  v_score_experience :=
      LEAST(5.0, v_completed::numeric / 6.0)        -- up to 5pt at 30 shifts
    + LEAST(3.0, v_distinct_rest::numeric / 4.0)    -- up to 3pt at 12 restaurants
    + LEAST(2.0, v_rehire_rest::numeric / 2.0);     -- up to 2pt at 4 rehires

  -- 5. Profilo verificato (10)
  v_score_verified := v_completeness;

  v_final := LEAST(100, GREATEST(0, ROUND(
    v_score_reliability + v_score_quality + v_score_professionalism +
    v_score_experience + v_score_verified
  )));

  -- Level
  IF v_completed < 3 THEN
    IF v_profile_complete AND v_phone_verified AND v_avatar_ok THEN
      v_level := 'new_verified';
    ELSE
      v_level := 'new';
    END IF;
  ELSIF v_final >= 90 AND v_completed >= 15 AND v_no_show = 0 THEN
    v_level := 'elite';
  ELSIF v_final >= 75 AND v_completed >= 5 THEN
    v_level := 'pro';
  ELSE
    v_level := 'basic';
  END IF;

  UPDATE public.profiles
     SET reputation_score      = v_final,
         reputation_level      = v_level,
         reputation_updated_at = now(),
         punctuality_pct       = v_punctuality_pct,
         completion_pct        = v_completion_pct,
         no_show_count         = v_no_show,
         late_cancel_count     = v_cancelled,
         rehire_restaurants_count = v_rehire_rest,
         rehire_yes_count      = v_yes,
         rehire_total_answers  = v_rehire_total,
         distinct_restaurants_count = v_distinct_rest,
         updated_at            = now()
   WHERE id = _worker;

  -- Rebuild badges
  DELETE FROM public.worker_badges WHERE worker_id = _worker;

  IF v_punctuality_pct >= 90 AND v_reviews_count >= 3 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'puntuale');
  END IF;
  IF v_completion_pct >= 95 AND v_completed >= 5 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'affidabile');
  END IF;
  IF v_rehire_rest >= 2 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'ricontattato');
  END IF;
  IF v_phone_verified AND v_doc_ok AND v_avatar_ok THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'profilo_verificato');
  END IF;
  IF v_no_show = 0 AND v_completed >= 5 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'zero_no_show');
  END IF;
  IF v_distinct_rest >= 8 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'molto_richiesto');
  END IF;
  IF v_avg_rating >= 4.5 AND v_reviews_count >= 5 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'recensioni_eccellenti');
  END IF;
  IF v_rehire_total > 0 AND (v_yes::numeric / v_rehire_total) >= 0.9 AND v_rehire_total >= 5 THEN
    INSERT INTO public.worker_badges(worker_id, badge) VALUES (_worker, 'top_servizio');
  END IF;
END;
$$;

-- 6) Triggers that keep reputation in sync
CREATE OR REPLACE FUNCTION public.trg_recompute_reputation_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_worker_reputation(NEW.target_id);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS recompute_reputation_on_review ON public.reviews;
CREATE TRIGGER recompute_reputation_on_review
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_reputation_review();

CREATE OR REPLACE FUNCTION public.trg_recompute_reputation_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_worker_reputation(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS recompute_reputation_on_shift ON public.shifts;
CREATE TRIGGER recompute_reputation_on_shift
AFTER INSERT OR UPDATE OF status ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_reputation_shift();

CREATE OR REPLACE FUNCTION public.trg_recompute_reputation_incident()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_worker_reputation(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS recompute_reputation_on_incident ON public.worker_incidents;
CREATE TRIGGER recompute_reputation_on_incident
AFTER INSERT OR UPDATE OF status ON public.worker_incidents
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_reputation_incident();

-- 7) One-time backfill for all existing workers
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'worker' LOOP
    PERFORM public.recompute_worker_reputation(r.user_id);
  END LOOP;
END$$;
