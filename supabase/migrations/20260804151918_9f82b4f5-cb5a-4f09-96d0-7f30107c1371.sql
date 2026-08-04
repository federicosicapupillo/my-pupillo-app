-- Evento di sistema permanente in conversazione quando un turno diventa no_show.
CREATE OR REPLACE FUNCTION public.log_no_show_system_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app_id uuid;
  v_body text;
BEGIN
  IF NEW.status <> 'no_show' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT a.id INTO v_app_id
  FROM public.applications a
  WHERE a.announcement_id IS NOT DISTINCT FROM NEW.announcement_id
    AND a.worker_id = NEW.worker_id
    AND a.restaurant_id = NEW.restaurant_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_app_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotenza: un solo evento no-show per conversazione/turno.
  IF EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.application_id = v_app_id
      AND m.template_id = 'shift_no_show'
  ) THEN
    RETURN NEW;
  END IF;

  v_body := '⚙️ Sistema: No show segnalato dal ristoratore per il turno del '
    || to_char(NEW.shift_date, 'DD/MM/YYYY')
    || '. La segnalazione è registrata in modo permanente e verrà verificata dal controllo Pupillo.';

  INSERT INTO public.messages (application_id, sender_id, receiver_id, body, message_type, action_type, template_id)
  VALUES (v_app_id, NEW.restaurant_id, NEW.worker_id, v_body, 'system', 'shift_no_show', 'shift_no_show');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_no_show_system_message ON public.shifts;
CREATE TRIGGER trg_log_no_show_system_message
AFTER INSERT OR UPDATE OF status ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.log_no_show_system_message();

-- Backfill per i no-show già esistenti.
INSERT INTO public.messages (application_id, sender_id, receiver_id, body, message_type, action_type, template_id, created_at)
SELECT a.id, s.restaurant_id, s.worker_id,
  '⚙️ Sistema: No show segnalato dal ristoratore per il turno del ' || to_char(s.shift_date, 'DD/MM/YYYY')
  || '. La segnalazione è registrata in modo permanente e verrà verificata dal controllo Pupillo.',
  'system', 'shift_no_show', 'shift_no_show', COALESCE(s.completed_at, s.created_at)
FROM public.shifts s
JOIN LATERAL (
  SELECT ap.id, ap.created_at FROM public.applications ap
  WHERE ap.announcement_id IS NOT DISTINCT FROM s.announcement_id
    AND ap.worker_id = s.worker_id AND ap.restaurant_id = s.restaurant_id
  ORDER BY ap.created_at DESC LIMIT 1
) a ON true
WHERE s.status = 'no_show'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.application_id = a.id AND m.template_id = 'shift_no_show'
  );