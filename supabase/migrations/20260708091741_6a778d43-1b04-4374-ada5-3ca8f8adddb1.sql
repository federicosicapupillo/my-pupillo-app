-- 1. Colonna
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NULL;

-- 2. Funzione trigger
CREATE OR REPLACE FUNCTION public.announcements_set_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'assigned'::public.announcement_status
       AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'assigned'::public.announcement_status
       AND OLD.status IS DISTINCT FROM 'assigned'::public.announcement_status
       AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_announcements_set_assigned_at ON public.announcements;
CREATE TRIGGER trg_announcements_set_assigned_at
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.announcements_set_assigned_at();