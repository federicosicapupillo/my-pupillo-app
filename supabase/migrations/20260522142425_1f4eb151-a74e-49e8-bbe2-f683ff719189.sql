-- Update worker notification copy on application status change
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_link text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_link := '/messages/' || NEW.id::text;
    CASE NEW.status
      WHEN 'accepted' THEN
        v_title := 'Candidatura confermata';
        v_body := 'La tua candidatura è stata accettata. Apri la chat per leggere le istruzioni del servizio e confermare la presa visione.';
      WHEN 'rejected' THEN
        v_title := 'Prenotazione rifiutata';
        v_body := 'Il ristoratore ha rifiutato la tua richiesta.';
      WHEN 'interested' THEN
        v_title := 'Interesse mostrato';
        v_body := 'Il ristoratore è interessato alla tua candidatura.';
      WHEN 'counter_offer' THEN
        v_title := 'Controproposta ricevuta';
        v_body := 'Hai ricevuto una nuova offerta dal ristoratore.';
      WHEN 'expired' THEN
        v_title := 'Offerta scaduta';
        v_body := 'La tua candidatura è scaduta.';
      ELSE
        RETURN NEW;
    END CASE;

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.worker_id, v_title, v_body, v_link);
  END IF;
  RETURN NEW;
END;
$$;

-- Suppress duplicate "Nuovo messaggio" for the automatic confirmation card
-- (template_id = 'shift_confirmation') and for the worker's acknowledgement
-- system message. The "Candidatura confermata" notification handles it.
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app record;
  v_recipient uuid;
  v_sender_name text;
BEGIN
  -- Skip auto-confirmation card and acknowledgement system messages.
  IF NEW.template_id = 'shift_confirmation'
     OR NEW.action_type = 'confirm_application'
     OR NEW.action_type = 'instructions_acknowledged' THEN
    RETURN NEW;
  END IF;

  SELECT id, restaurant_id, worker_id INTO v_app
  FROM public.applications WHERE id = NEW.application_id;
  IF v_app.id IS NULL THEN RETURN NEW; END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_app.restaurant_id THEN v_app.worker_id ELSE v_app.restaurant_id END;
  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT COALESCE(business_name, full_name, 'Utente') INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    v_recipient,
    'Nuovo messaggio da ' || COALESCE(v_sender_name, 'Utente'),
    LEFT(COALESCE(NEW.body, ''), 140),
    '/messages/' || NEW.application_id::text
  );
  RETURN NEW;
END;
$$;