
-- 1) Auto-reject altre candidature quando una viene accettata
CREATE OR REPLACE FUNCTION public.reject_other_applications_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.applications
       SET status = 'rejected'
     WHERE announcement_id = NEW.announcement_id
       AND id <> NEW.id
       AND status NOT IN ('rejected','accepted','expired','not_interested');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_other_applications_on_accept() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reject_other_apps ON public.applications;
CREATE TRIGGER trg_reject_other_apps
AFTER UPDATE OF status ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.reject_other_applications_on_accept();

-- 2) Aggiorna lo stato dell'annuncio quando il turno collegato cambia
CREATE OR REPLACE FUNCTION public.sync_announcement_on_shift_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.announcement_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'completed' THEN
    UPDATE public.announcements SET status = 'completed' WHERE id = NEW.announcement_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.announcements SET status = 'cancelled' WHERE id = NEW.announcement_id AND status = 'assigned';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_announcement_on_shift_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_announcement_on_shift_status ON public.shifts;
CREATE TRIGGER trg_sync_announcement_on_shift_status
AFTER UPDATE OF status ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.sync_announcement_on_shift_status();
