CREATE OR REPLACE FUNCTION public.notify_application_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient uuid;
  is_counter boolean := false;
  n_title text;
  n_body text;
BEGIN
  IF NEW.worker_id <> NEW.restaurant_id AND
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.worker_id AND role = 'worker') THEN
    recipient := NEW.restaurant_id;
    is_counter := NEW.proposed_tariff IS NOT NULL;

    IF is_counter THEN
      n_title := 'Nuova contro offerta ricevuta';
      n_body := 'Un lavoratore propone € ' || NEW.proposed_tariff::text || '/h per uno dei tuoi turni.';
    ELSE
      n_title := 'Nuova candidatura ricevuta';
      n_body := 'Un lavoratore si è candidato per uno dei tuoi turni.';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, link, dedupe_key, metadata)
    VALUES (
      recipient,
      n_title,
      n_body,
      '/messages/' || NEW.id,
      'application_received:' || NEW.id::text || ':' || recipient::text,
      jsonb_build_object(
        'kind', 'application_received',
        'application_id', NEW.id,
        'announcement_id', NEW.announcement_id,
        'worker_id', NEW.worker_id
      )
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;