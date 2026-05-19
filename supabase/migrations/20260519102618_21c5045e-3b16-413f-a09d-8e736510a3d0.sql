-- Compute the effective end timestamp (Europe/Rome) of an announcement.
CREATE OR REPLACE FUNCTION public.announcement_effective_end(p_announcement_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN a.end_time IS NOT NULL THEN
        ((COALESCE(a.end_date, a.service_date)::text || ' ' || a.end_time::text)::timestamp AT TIME ZONE 'Europe/Rome')
      WHEN COALESCE(a.shift_duration_hours, a.duration_hours) IS NOT NULL AND a.service_time IS NOT NULL THEN
        ((a.service_date::text || ' ' || a.service_time::text)::timestamp AT TIME ZONE 'Europe/Rome')
          + (COALESCE(a.shift_duration_hours, a.duration_hours) * interval '1 hour')
      ELSE
        ((a.service_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Europe/Rome')
    END
  FROM public.announcements a
  WHERE a.id = p_announcement_id;
$$;

-- Trigger: reject reviews inserted before the shift has actually ended.
CREATE OR REPLACE FUNCTION public.enforce_review_after_shift_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
  v_ann_id uuid;
  v_shift_date date;
BEGIN
  v_ann_id := NEW.announcement_id;
  IF v_ann_id IS NULL AND NEW.shift_id IS NOT NULL THEN
    SELECT s.announcement_id, s.shift_date
      INTO v_ann_id, v_shift_date
    FROM public.shifts s
    WHERE s.id = NEW.shift_id;
  END IF;

  IF v_ann_id IS NOT NULL THEN
    v_end := public.announcement_effective_end(v_ann_id);
  ELSIF v_shift_date IS NOT NULL THEN
    v_end := ((v_shift_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Europe/Rome');
  END IF;

  IF v_end IS NOT NULL AND now() < v_end THEN
    RAISE EXCEPTION 'Il turno non è ancora concluso. Potrai chiuderlo dopo l''orario di fine.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_review_after_shift_end ON public.reviews;
CREATE TRIGGER trg_enforce_review_after_shift_end
BEFORE INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_after_shift_end();

-- Trigger: prevent marking a shift completed before its real end time.
CREATE OR REPLACE FUNCTION public.enforce_shift_completion_after_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.announcement_id IS NOT NULL THEN
      v_end := public.announcement_effective_end(NEW.announcement_id);
    ELSIF NEW.shift_date IS NOT NULL THEN
      v_end := ((NEW.shift_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Europe/Rome');
    END IF;
    IF v_end IS NOT NULL AND now() < v_end THEN
      RAISE EXCEPTION 'Il turno non è ancora concluso. Potrai chiuderlo dopo l''orario di fine.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shift_completion_after_end ON public.shifts;
CREATE TRIGGER trg_enforce_shift_completion_after_end
BEFORE INSERT OR UPDATE OF status ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shift_completion_after_end();