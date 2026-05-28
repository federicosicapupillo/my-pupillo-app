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
     OR NEW.action_type = 'instructions_acknowledged' THEN
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

  -- Le proposte di lavoro generano SEMPRE la notifica dedicata,
  -- indipendentemente dalla storia con il ristoratore. Un solo messaggio
  -- "Nuova proposta di lavoro" per evitare duplicati con "Nuovo messaggio".
  IF v_is_proposal AND v_recipient_is_worker THEN
    v_title := 'Nuova proposta di lavoro';
    v_body  := 'Hai ricevuto una nuova proposta per un turno. Apri la chat per vedere i dettagli disponibili e rispondere.';
  ELSIF v_recipient_is_worker AND NOT v_is_confirmed AND NOT v_has_history THEN
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