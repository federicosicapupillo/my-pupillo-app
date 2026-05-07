
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_notification_read_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.read = true AND (OLD.read IS DISTINCT FROM true) AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  ELSIF NEW.read = false THEN
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_notification_read_at ON public.notifications;
CREATE TRIGGER trg_set_notification_read_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_read_at();

UPDATE public.notifications SET read_at = COALESCE(read_at, created_at) WHERE read = true AND read_at IS NULL;
