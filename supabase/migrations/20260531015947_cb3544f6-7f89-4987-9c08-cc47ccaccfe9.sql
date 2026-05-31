-- Skip notifications for system messages (e.g. "Disponibilità inviata" note
-- when the worker shows interest). System messages are informational and must
-- never generate a "Nuovo messaggio da <Nome Cognome>" notification, which
-- would also leak the worker's full name to the restaurant before confirmation.
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
  v_recipient_is_worker boolean;
  v_has_history boolean;
  v_is_confirmed boolean;
  v_title text;
  v_body text;
  v_is_proposal boolean;
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

  v_recipient_is_worker := (v_recipient = v_app.worker_id);
  v_is_confirmed := v_app.status::text IN ('accepted','confirmed','assigned');
  v_has_history := public.has_worker_restaurant_relationship(v_app.worker_id, v_app.restaurant_id);
  v_is_proposal := (NEW.template_id = 'shift_proposal');

  IF v_is_proposal AND v_recipient_is_worker THEN
    v_title := 'Nuova proposta di lavoro';
    v_body  := 'Hai ricevuto una nuova proposta per un turno. Apri la chat per vedere i dettagli disponibili e rispondere.';
  ELSIF v_recipient_is_worker AND NOT v_is_confirmed AND NOT v_has_history THEN
    v_title := 'Nuovo messaggio';
    v_body  := 'Hai ricevuto un nuovo messaggio. Apri la chat per leggere i dettagli.';
  ELSIF NOT v_recipient_is_worker AND NOT v_is_confirmed THEN
    -- Privacy: nelle conversazioni non ancora confermate, il ristoratore
    -- non deve vedere il nome+cognome del lavoratore nelle notifiche.
    v_title := 'Nuovo messaggio';
    v_body  := 'Hai ricevuto un nuovo messaggio. Apri la chat per leggere i dettagli.';
  ELSE
    SELECT COALESCE(business_name, full_name, 'Utente') INTO v_sender_name
      FROM public.profiles WHERE id = NEW.sender_id;
    v_title := 'Nuovo messaggio da ' || COALESCE(v_sender_name, 'Utente');
    v_body  := LEFT(COALESCE(NEW.body, ''), 140);
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (v_recipient, v_title, v_body, '/messages/' || NEW.application_id::text);
  RETURN NEW;
END;
$$;

-- Improve the "Lavoratore interessato" notification body text so the
-- restaurant understands the shift is NOT yet confirmed and is invited
-- to confirm to unlock full details.
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
  title text;
  body text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status IN ('interested','not_interested','counter_offer') THEN
    recipient := NEW.restaurant_id;
  ELSE
    recipient := NEW.worker_id;
  END IF;

  CASE NEW.status
    WHEN 'interested' THEN
      title := 'Lavoratore interessato';
      body  := 'Un lavoratore ha mostrato interesse per la tua proposta. Conferma il turno dalla chat o da "I miei annunci" per sbloccare i dettagli completi.';
    WHEN 'not_interested' THEN title := 'Offerta rifiutata'; body := 'Il lavoratore non è interessato.';
    WHEN 'counter_offer' THEN title := 'Controfferta ricevuta'; body := 'Hai ricevuto una nuova proposta economica.';
    WHEN 'accepted' THEN title := 'Candidatura accettata'; body := 'Sei stato assegnato al servizio!';
    WHEN 'rejected' THEN title := 'Candidatura non accettata'; body := 'La candidatura è stata chiusa.';
    ELSE title := 'Aggiornamento candidatura'; body := NEW.status::text;
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (recipient, title, body, '/messages/' || NEW.id);
  RETURN NEW;
END; $$;