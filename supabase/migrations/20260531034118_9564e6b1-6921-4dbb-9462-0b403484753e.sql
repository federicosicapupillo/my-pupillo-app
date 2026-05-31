-- When the worker shows interest on a restaurant-sent proposal, notify the
-- RESTAURANT (not the worker) with privacy-safe copy. Keep the existing
-- "Interesse mostrato" copy for any future case where the restaurant flips
-- to 'interested' (defensive; in practice only worker drives this status).
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
  v_recipient uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_link := '/messages/' || NEW.id::text;
    v_recipient := NEW.worker_id; -- default: worker is notified
    CASE NEW.status
      WHEN 'accepted' THEN
        v_title := 'Candidatura confermata';
        v_body := 'La tua candidatura è stata accettata. Apri la chat per leggere le istruzioni del servizio e confermare la presa visione.';
      WHEN 'rejected' THEN
        v_title := 'Prenotazione rifiutata';
        v_body := 'Il ristoratore ha rifiutato la tua richiesta.';
      WHEN 'interested' THEN
        -- Worker has shown interest on a proposal sent by the restaurant.
        -- Notify the RESTAURANT with privacy-safe copy (no worker name).
        v_recipient := NEW.restaurant_id;
        v_title := 'Candidato interessato';
        v_body := 'Un candidato ha mostrato interesse per la tua proposta. Apri la chat per confermare il lavoratore o inviare una controfferta.';
      WHEN 'counter_offer' THEN
        v_title := 'Controproposta ricevuta';
        v_body := 'Hai ricevuto una nuova offerta dal ristoratore.';
      WHEN 'expired' THEN
        v_title := 'Offerta scaduta';
        v_body := 'La tua candidatura è scaduta.';
      ELSE
        RETURN NEW;
    END CASE;

    IF v_recipient IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link, metadata)
      VALUES (
        v_recipient,
        v_title,
        v_body,
        v_link,
        jsonb_build_object(
          'application_id', NEW.id,
          'announcement_id', NEW.announcement_id,
          'restaurant_user_id', NEW.restaurant_id,
          'worker_user_id', NEW.worker_id,
          'notification_type',
            CASE WHEN NEW.status = 'interested' THEN 'candidate_interested'
                 ELSE 'application_status_' || NEW.status::text END
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Suppress the generic "Nuovo messaggio da <Nome Cognome>" notification for
-- system messages and for the worker-interest acknowledgement note, so that
-- when the worker shows interest the restaurant only receives the single
-- privacy-safe "Candidato interessato" notification (no name leak).
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
  -- Skip auto-confirmation card, acknowledgement system messages, and any
  -- message_type='system' note (system notes only add chat context — the
  -- corresponding status-change notification already informs the recipient).
  IF NEW.template_id = 'shift_confirmation'
     OR NEW.action_type = 'confirm_application'
     OR NEW.action_type = 'instructions_acknowledged'
     OR NEW.message_type = 'system' THEN
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