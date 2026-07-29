CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app record;
  v_recipient uuid;
  v_sender_name text;
  v_title text;
  v_body text;
  v_identity_unlocked boolean;
BEGIN
  IF NEW.template_id = 'shift_confirmation'
     OR NEW.action_type = 'confirm_application'
     OR NEW.action_type = 'instructions_acknowledged'
     OR NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT id, restaurant_id, worker_id, status INTO v_app
  FROM public.applications WHERE id = NEW.application_id;
  IF v_app.id IS NULL THEN RETURN NEW; END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_app.restaurant_id THEN v_app.worker_id ELSE v_app.restaurant_id END;
  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT COALESCE(business_name, full_name, 'Utente') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  v_title := 'Nuovo messaggio da ' || COALESCE(v_sender_name, 'Utente');
  v_body := LEFT(COALESCE(NEW.body, ''), 140);

  -- PRIVACY PUPILLO: il lavoratore non deve vedere il nome del locale prima
  -- dello sblocco identita' (candidatura confermata/assegnata oppure almeno
  -- un turno completato insieme).
  IF v_recipient = v_app.worker_id AND NEW.sender_id = v_app.restaurant_id THEN
    v_identity_unlocked := COALESCE(v_app.status::text, '') IN ('accepted', 'confirmed', 'assigned')
      OR EXISTS (
        SELECT 1 FROM public.shifts s
        WHERE s.worker_id = v_app.worker_id
          AND s.restaurant_id = v_app.restaurant_id
          AND s.status = 'completed'
      );
    IF NOT v_identity_unlocked THEN
      v_title := 'Nuovo messaggio da un ristoratore';
      v_body := 'Hai ricevuto un nuovo messaggio. Apri la conversazione per vedere i dettagli.';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (v_recipient, v_title, v_body, '/messages/' || NEW.application_id::text);
  RETURN NEW;
END;
$function$;

-- Backfill: ripulisci le notifiche gia' salvate che espongono il locale a un
-- lavoratore la cui identita' non e' ancora sbloccata.
UPDATE public.notifications n
SET title = 'Nuovo messaggio da un ristoratore',
    body = 'Hai ricevuto un nuovo messaggio. Apri la conversazione per vedere i dettagli.'
FROM public.applications a
WHERE n.title LIKE 'Nuovo messaggio da %'
  AND n.title <> 'Nuovo messaggio da un ristoratore'
  AND n.link = '/messages/' || a.id::text
  AND n.user_id = a.worker_id
  AND COALESCE(a.status::text, '') NOT IN ('accepted', 'confirmed', 'assigned')
  AND NOT EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.worker_id = a.worker_id
      AND s.restaurant_id = a.restaurant_id
      AND s.status = 'completed'
  );