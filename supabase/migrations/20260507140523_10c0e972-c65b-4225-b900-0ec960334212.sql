-- Notify worker on application status change
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
        v_title := 'Prenotazione confermata';
        v_body := 'Il ristoratore ha accettato la tua richiesta.';
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

DROP TRIGGER IF EXISTS trg_notify_application_status_change ON public.applications;
CREATE TRIGGER trg_notify_application_status_change
AFTER UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_status_change();

-- Notify recipient on new message
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

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- Realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;