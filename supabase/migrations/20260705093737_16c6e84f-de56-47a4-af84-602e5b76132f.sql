
-- 1) account_deletion_feedback: require user_id = auth.uid()
DROP POLICY IF EXISTS "Users insert own deletion feedback" ON public.account_deletion_feedback;
CREATE POLICY "Users insert own deletion feedback"
ON public.account_deletion_feedback
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2) worker_incidents: prevent workers from mutating sensitive fields on their own delay incidents
CREATE OR REPLACE FUNCTION public.enforce_worker_delay_incident_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and restaurants have their own policies; only guard the worker self-update path.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only apply when the worker themselves is updating their own row
  IF NEW.worker_id = auth.uid() AND OLD.worker_id = auth.uid() THEN
    IF NEW.worker_id           IS DISTINCT FROM OLD.worker_id
       OR NEW.restaurant_id    IS DISTINCT FROM OLD.restaurant_id
       OR NEW.shift_id         IS DISTINCT FROM OLD.shift_id
       OR NEW.application_id   IS DISTINCT FROM OLD.application_id
       OR NEW.job_request_id   IS DISTINCT FROM OLD.job_request_id
       OR NEW.kind             IS DISTINCT FROM OLD.kind
       OR NEW.incident_type    IS DISTINCT FROM OLD.incident_type
       OR NEW.status           IS DISTINCT FROM OLD.status
       OR NEW.reviewed_at      IS DISTINCT FROM OLD.reviewed_at
       OR NEW.reviewed_by      IS DISTINCT FROM OLD.reviewed_by
       OR NEW.confirmed_by_restaurant_at IS DISTINCT FROM OLD.confirmed_by_restaurant_at
       OR NEW.affects_reputation   IS DISTINCT FROM OLD.affects_reputation
       OR NEW.affects_compensation IS DISTINCT FROM OLD.affects_compensation
       OR NEW.estimated_delay_minutes IS DISTINCT FROM OLD.estimated_delay_minutes
       OR NEW.actual_delay_minutes    IS DISTINCT FROM OLD.actual_delay_minutes
       OR NEW.is_demo          IS DISTINCT FROM OLD.is_demo
       OR NEW.seed_batch_id    IS DISTINCT FROM OLD.seed_batch_id
       OR NEW.created_at       IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Workers cannot modify protected fields on delay incidents';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_worker_delay_incident_immutable ON public.worker_incidents;
CREATE TRIGGER enforce_worker_delay_incident_immutable
BEFORE UPDATE ON public.worker_incidents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_worker_delay_incident_immutable();
