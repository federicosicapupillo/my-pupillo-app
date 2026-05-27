
-- Trigger: cascade cancellation from announcements to shifts + applications
CREATE OR REPLACE FUNCTION public.cascade_announcement_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'cancelled' AND COALESCE(OLD.status::text, '') <> 'cancelled' THEN
    -- Cancel any non-final shifts linked to this announcement
    UPDATE public.shifts
       SET status = 'cancelled'
     WHERE announcement_id = NEW.id
       AND status::text NOT IN ('completed','cancelled');

    -- Cancel any non-final applications linked to this announcement
    UPDATE public.applications
       SET status = 'cancelled',
           updated_at = now()
     WHERE announcement_id = NEW.id
       AND status::text NOT IN ('cancelled','expired','rejected','accepted');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_announcement_cancellation ON public.announcements;
CREATE TRIGGER trg_cascade_announcement_cancellation
AFTER UPDATE OF status ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.cascade_announcement_cancellation();

-- Backfill existing dirty data
UPDATE public.shifts s
   SET status = 'cancelled'
  FROM public.announcements a
 WHERE s.announcement_id = a.id
   AND a.status::text = 'cancelled'
   AND s.status::text NOT IN ('completed','cancelled');

UPDATE public.applications ap
   SET status = 'cancelled',
       updated_at = now()
  FROM public.announcements a
 WHERE ap.announcement_id = a.id
   AND a.status::text = 'cancelled'
   AND ap.status::text NOT IN ('cancelled','expired','rejected','accepted');
