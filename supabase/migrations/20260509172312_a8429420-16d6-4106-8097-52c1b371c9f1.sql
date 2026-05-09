ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app record;
  v_recipient uuid;
BEGIN
  SELECT id, restaurant_id, worker_id INTO v_app
  FROM public.applications WHERE id = NEW.application_id;
  IF v_app.id IS NULL THEN RETURN NEW; END IF;

  v_recipient := COALESCE(
    NEW.receiver_id,
    CASE WHEN NEW.sender_id = v_app.restaurant_id THEN v_app.worker_id ELSE v_app.restaurant_id END
  );

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (
    v_recipient,
    'Nuovo messaggio',
    'Hai ricevuto un nuovo messaggio su Pupillo.',
    '/messages/' || NEW.application_id::text,
    jsonb_build_object(
      'conversation_id', NEW.application_id,
      'application_id', NEW.application_id,
      'sender_user_id', NEW.sender_id,
      'receiver_user_id', v_recipient,
      'message_id', NEW.id,
      'message_type', NEW.message_type,
      'template_id', NEW.template_id,
      'action_type', NEW.action_type
    )
  );
  RETURN NEW;
END;
$$;