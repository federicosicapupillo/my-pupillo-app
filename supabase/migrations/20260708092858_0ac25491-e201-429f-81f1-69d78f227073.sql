
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS accepted_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.applications_set_accepted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN
      NEW.accepted_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'accepted'
       AND OLD.status IS DISTINCT FROM 'accepted'
       AND NEW.accepted_at IS NULL THEN
      NEW.accepted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_set_accepted_at ON public.applications;
CREATE TRIGGER trg_applications_set_accepted_at
BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.applications_set_accepted_at();
