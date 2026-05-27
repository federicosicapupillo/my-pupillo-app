
-- ===========================================================================
-- Worker delay / cancellation reputation penalty + search ranking penalty
-- ===========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delay_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_shifts_after_penalty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_penalty_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS search_penalty_reason text,
  ADD COLUMN IF NOT EXISTS search_penalty_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_penalty_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_search_penalty_active
  ON public.profiles(search_penalty_active)
  WHERE search_penalty_active = true;

-- Helper: returns true when a delay incident counts toward the 3-strike rule.
-- A delay counts only if not explicitly dismissed by admin / restaurant.
CREATE OR REPLACE FUNCTION public.is_confirmed_delay(_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(_status, 'pending') IN ('pending', 'verified');
$$;

CREATE OR REPLACE FUNCTION public.recompute_worker_penalty(_worker uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delays integer := 0;
  v_cancellations integer := 0;
  v_active boolean;
  v_until timestamptz;
  v_started timestamptz;
  v_clean integer;
  v_new_active boolean;
  v_new_until timestamptz;
  v_new_started timestamptz;
  v_new_reason text;
  v_new_clean integer;
BEGIN
  -- Count confirmed delays (not dismissed) that affect reputation
  SELECT COUNT(*) INTO v_delays
    FROM public.worker_incidents
   WHERE worker_id = _worker
     AND kind = 'delay'
     AND affects_reputation = true
     AND status <> 'dismissed';

  -- Count cancellations (worker-initiated) — includes no_show / abandoned
  SELECT COUNT(*) INTO v_cancellations
    FROM public.worker_incidents
   WHERE worker_id = _worker
     AND kind IN ('cancellation', 'worker_cancelled', 'no_show', 'abandoned')
     AND affects_reputation = true
     AND status <> 'dismissed';

  SELECT search_penalty_active, search_penalty_until,
         search_penalty_started_at, clean_shifts_after_penalty
    INTO v_active, v_until, v_started, v_clean
    FROM public.profiles
   WHERE id = _worker;

  v_new_active  := COALESCE(v_active, false);
  v_new_until   := v_until;
  v_new_started := v_started;
  v_new_reason  := NULL;
  v_new_clean   := COALESCE(v_clean, 0);

  -- Trigger penalty every 3 confirmed delays (3, 6, 9, …)
  IF v_delays >= 3 AND (v_delays % 3) = 0 THEN
    -- New tier reached: (re)activate penalty for 30 days, reset clean counter
    v_new_active  := true;
    v_new_started := now();
    v_new_until   := now() + interval '30 days';
    v_new_reason  := format('%s ritardi confermati', v_delays);
    v_new_clean   := 0;
  ELSIF v_delays >= 3 THEN
    -- Already over threshold but not at a new tier: keep current penalty
    IF NOT COALESCE(v_active, false) THEN
      v_new_active  := true;
      v_new_started := COALESCE(v_started, now());
      v_new_until   := COALESCE(v_until, now() + interval '30 days');
      v_new_reason  := format('%s ritardi confermati', v_delays);
    END IF;
  END IF;

  -- Auto-expire: penalty older than search_penalty_until
  IF v_new_active AND v_new_until IS NOT NULL AND v_new_until < now() THEN
    v_new_active  := false;
    v_new_until   := NULL;
    v_new_started := NULL;
    v_new_reason  := NULL;
    v_new_clean   := 0;
  END IF;

  UPDATE public.profiles
     SET delay_count               = v_delays,
         cancellation_count        = v_cancellations,
         search_penalty_active     = v_new_active,
         search_penalty_reason     = CASE WHEN v_new_active THEN COALESCE(v_new_reason, search_penalty_reason) ELSE NULL END,
         search_penalty_started_at = CASE WHEN v_new_active THEN v_new_started ELSE NULL END,
         search_penalty_until      = CASE WHEN v_new_active THEN v_new_until ELSE NULL END,
         clean_shifts_after_penalty= v_new_clean,
         updated_at                = now()
   WHERE id = _worker;

  -- Keep the global reputation cache in sync (uses verified incidents internally).
  PERFORM public.recompute_worker_reputation(_worker);
END;
$$;

-- Trigger: any change on worker_incidents recomputes the penalty.
CREATE OR REPLACE FUNCTION public.trg_recompute_penalty_incident()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_worker_penalty(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS recompute_penalty_on_incident ON public.worker_incidents;
CREATE TRIGGER recompute_penalty_on_incident
AFTER INSERT OR UPDATE OR DELETE ON public.worker_incidents
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_penalty_incident();

-- Trigger: when a shift is marked completed, count it as a "clean" shift if
-- there is no delay / cancellation incident attached. Three clean shifts in a
-- row clear an active penalty early.
CREATE OR REPLACE FUNCTION public.trg_clean_shift_after_penalty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active boolean;
  v_started timestamptz;
  v_has_incident boolean;
  v_new_clean integer;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW; -- already counted
  END IF;

  SELECT search_penalty_active, search_penalty_started_at, clean_shifts_after_penalty
    INTO v_active, v_started, v_new_clean
    FROM public.profiles
   WHERE id = NEW.worker_id;

  IF NOT COALESCE(v_active, false) THEN
    RETURN NEW;
  END IF;

  -- Skip if this very shift produced an incident
  SELECT EXISTS (
    SELECT 1 FROM public.worker_incidents wi
     WHERE wi.shift_id = NEW.id
       AND wi.worker_id = NEW.worker_id
       AND wi.affects_reputation = true
       AND wi.status <> 'dismissed'
  ) INTO v_has_incident;

  IF v_has_incident THEN
    RETURN NEW;
  END IF;

  v_new_clean := COALESCE(v_new_clean, 0) + 1;

  IF v_new_clean >= 3 THEN
    UPDATE public.profiles
       SET search_penalty_active     = false,
           search_penalty_reason     = NULL,
           search_penalty_started_at = NULL,
           search_penalty_until      = NULL,
           clean_shifts_after_penalty= 0,
           updated_at                = now()
     WHERE id = NEW.worker_id;
  ELSE
    UPDATE public.profiles
       SET clean_shifts_after_penalty = v_new_clean,
           updated_at = now()
     WHERE id = NEW.worker_id;
  END IF;

  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS clean_shift_after_penalty ON public.shifts;
CREATE TRIGGER clean_shift_after_penalty
AFTER UPDATE OF status ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.trg_clean_shift_after_penalty();
