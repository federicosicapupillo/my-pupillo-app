
-- Function: prevent accepting more applications than positions available
CREATE OR REPLACE FUNCTION public.enforce_announcement_positions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needed integer;
  v_accepted integer;
BEGIN
  -- only enforce when this update/insert sets status to accepted
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;
  -- if previous status was already accepted, allow (no new slot taken)
  IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jr.workers_needed, 1)
    INTO v_needed
  FROM public.job_requests jr
  WHERE jr.announcement_id = NEW.announcement_id
  ORDER BY jr.created_at DESC
  LIMIT 1;

  IF v_needed IS NULL THEN
    v_needed := 1;
  END IF;

  SELECT COUNT(*) INTO v_accepted
  FROM public.applications a
  WHERE a.announcement_id = NEW.announcement_id
    AND a.status = 'accepted'
    AND a.id <> NEW.id;

  IF v_accepted >= v_needed THEN
    RAISE EXCEPTION 'announcement_full: il turno ha già raggiunto il numero massimo di lavoratori (%).', v_needed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_announcement_positions ON public.applications;
CREATE TRIGGER trg_enforce_announcement_positions
BEFORE INSERT OR UPDATE OF status ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_announcement_positions();
