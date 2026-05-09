
-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS review_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_reviews_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review_reminder_at timestamptz;

-- 2. required_reviews table
CREATE TABLE IF NOT EXISTS public.required_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_user_id uuid NOT NULL,
  worker_user_id uuid NOT NULL,
  shift_id uuid,
  application_id uuid,
  announcement_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending|overdue|completed|dismissed_by_admin
  due_date timestamptz NOT NULL,
  completed_at timestamptz,
  review_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_required_reviews_shift
  ON public.required_reviews (shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_required_reviews_restaurant ON public.required_reviews (restaurant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_required_reviews_due ON public.required_reviews (due_date) WHERE status IN ('pending','overdue');

ALTER TABLE public.required_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant sees own required reviews" ON public.required_reviews;
CREATE POLICY "Restaurant sees own required reviews"
  ON public.required_reviews FOR SELECT TO authenticated
  USING (restaurant_user_id = auth.uid() OR worker_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage required reviews" ON public.required_reviews;
CREATE POLICY "Admins manage required reviews"
  ON public.required_reviews FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_required_reviews_updated_at ON public.required_reviews;
CREATE TRIGGER trg_required_reviews_updated_at
BEFORE UPDATE ON public.required_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Helper to recompute restaurant block state
CREATE OR REPLACE FUNCTION public.recompute_review_block(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_overdue integer;
BEGIN
  SELECT COUNT(*) INTO v_overdue
    FROM public.required_reviews
   WHERE restaurant_user_id = _restaurant_id
     AND status = 'overdue';

  UPDATE public.profiles
     SET overdue_reviews_count = v_overdue,
         review_blocked = (v_overdue > 0),
         review_blocked_at = CASE
           WHEN v_overdue > 0 AND review_blocked = false THEN now()
           WHEN v_overdue = 0 THEN NULL
           ELSE review_blocked_at END,
         updated_at = now()
   WHERE id = _restaurant_id;
END;
$$;

-- 4. When shift becomes completed → create required review
CREATE OR REPLACE FUNCTION public.create_required_review_on_shift_complete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_app_id uuid;
BEGIN
  IF NEW.status <> 'completed'::shift_status THEN RETURN NEW; END IF;
  IF (TG_OP = 'UPDATE' AND OLD.status = 'completed'::shift_status) THEN RETURN NEW; END IF;

  -- find application linked to this shift
  SELECT id INTO v_app_id FROM public.applications
   WHERE announcement_id = NEW.announcement_id AND worker_id = NEW.worker_id
   ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.required_reviews
    (restaurant_user_id, worker_user_id, shift_id, application_id, announcement_id, status, due_date)
  VALUES
    (NEW.restaurant_id, NEW.worker_id, NEW.id, v_app_id, NEW.announcement_id, 'pending', COALESCE(NEW.completed_at, now()) + interval '3 days')
  ON CONFLICT (shift_id) DO NOTHING;

  -- notification
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    NEW.restaurant_id,
    'Lascia una recensione',
    'Il turno è stato completato. Hai 3 giorni per valutare il lavoratore.',
    CASE WHEN v_app_id IS NOT NULL THEN '/messages/' || v_app_id::text ELSE '/shifts' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_required_review_on_shift_complete ON public.shifts;
CREATE TRIGGER trg_create_required_review_on_shift_complete
AFTER INSERT OR UPDATE OF status ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.create_required_review_on_shift_complete();

-- 5. When a review is inserted → mark required review completed + recompute block
CREATE OR REPLACE FUNCTION public.complete_required_review_on_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_restaurant uuid;
BEGIN
  UPDATE public.required_reviews
     SET status = 'completed',
         completed_at = NEW.created_at,
         review_id = NEW.id,
         updated_at = now()
   WHERE status IN ('pending','overdue')
     AND restaurant_user_id = NEW.author_id
     AND worker_user_id = NEW.target_id
     AND (
       (NEW.shift_id IS NOT NULL AND shift_id = NEW.shift_id)
       OR (NEW.application_id IS NOT NULL AND application_id = NEW.application_id)
     )
   RETURNING restaurant_user_id INTO v_restaurant;

  IF v_restaurant IS NOT NULL THEN
    PERFORM public.recompute_review_block(v_restaurant);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_required_review_on_review ON public.reviews;
CREATE TRIGGER trg_complete_required_review_on_review
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.complete_required_review_on_review();

-- 6. Mark overdue + block restaurants (run via cron)
CREATE OR REPLACE FUNCTION public.mark_overdue_required_reviews()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  -- transition pending → overdue
  FOR r IN
    UPDATE public.required_reviews
       SET status = 'overdue', updated_at = now()
     WHERE status = 'pending' AND due_date < now()
     RETURNING restaurant_user_id, application_id
  LOOP
    v_count := v_count + 1;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      r.restaurant_user_id,
      'Recensione scaduta',
      'Non hai completato la recensione entro 3 giorni. Il contatto con nuovi lavoratori è temporaneamente bloccato.',
      CASE WHEN r.application_id IS NOT NULL THEN '/messages/' || r.application_id::text ELSE '/shifts' END
    );
  END LOOP;

  -- recompute every affected restaurant
  PERFORM public.recompute_review_block(p.id)
    FROM public.profiles p
   WHERE p.id IN (SELECT DISTINCT restaurant_user_id FROM public.required_reviews WHERE status IN ('overdue','pending'));

  RETURN v_count;
END;
$$;
