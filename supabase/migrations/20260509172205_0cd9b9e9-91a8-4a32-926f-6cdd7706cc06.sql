ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id uuid,
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'template',
  ADD COLUMN IF NOT EXISTS action_type text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_messages_application_created_at
  ON public.messages (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_last_message_at
  ON public.applications (last_message_at DESC);

CREATE OR REPLACE FUNCTION public.touch_application_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_applications_updated_at ON public.applications;
CREATE TRIGGER trg_touch_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.touch_application_updated_at();

CREATE OR REPLACE FUNCTION public.sync_application_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.applications
     SET last_message_preview = LEFT(COALESCE(NEW.body, ''), 180),
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.application_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_application_last_message ON public.messages;
CREATE TRIGGER trg_sync_application_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_application_last_message();

UPDATE public.messages m
SET message_type = CASE
  WHEN m.body ILIKE '⚙️ Sistema:%' THEN 'system'
  WHEN m.body ILIKE 'Sistema:%' THEN 'system'
  ELSE COALESCE(m.message_type, 'template')
END
WHERE m.message_type IS NULL OR m.message_type = 'template';

UPDATE public.applications a
SET last_message_preview = latest.body,
    last_message_at = latest.created_at,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (application_id)
         application_id,
         body,
         created_at
  FROM public.messages
  ORDER BY application_id, created_at DESC
) latest
WHERE latest.application_id = a.id;