CREATE OR REPLACE FUNCTION public.notify_shift_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  title text; body text;
  worker_link text; restaurant_link text;
  worker_meta jsonb; restaurant_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.worker_id, 'Turno confermato', 'Hai un nuovo turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.', '/shifts?tab=assigned&shift=' || NEW.id);
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.restaurant_id, 'Turno creato', 'Turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.', '/shifts');
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'completed' THEN title := 'Turno completato'; body := 'Il turno è stato segnato come completato. Puoi lasciare una recensione.';
    WHEN 'no_show' THEN title := 'Segnalato no-show'; body := 'Il turno è stato segnato come no-show. Apri "I miei turni" per i dettagli.';
    WHEN 'cancelled' THEN title := 'Turno annullato'; body := 'Il turno è stato annullato.';
    ELSE title := 'Turno aggiornato'; body := NEW.status::text;
  END CASE;
  -- For no-show: deep-link the worker into the Segnalazioni tab with the specific shift highlighted.
  IF NEW.status = 'no_show' THEN
    worker_link := '/shifts?tab=no_show&shift=' || NEW.id;
    restaurant_link := '/shifts?tab=no_show&shift=' || NEW.id;
    worker_meta := jsonb_build_object(
      'kind', 'shift_no_show',
      'notification_type', 'shift_no_show',
      'worker_id', NEW.worker_id,
      'shift_id', NEW.id,
      'announcement_id', NEW.announcement_id,
      'target_page', 'worker_shifts',
      'target_tab', 'no_show',
      'safe_redirect_path', '/shifts?tab=no_show&shift=' || NEW.id
    );
    restaurant_meta := jsonb_build_object('kind', 'shift_no_show', 'shift_id', NEW.id);
  ELSIF NEW.status = 'completed' THEN
    worker_link := '/shifts?tab=to-review&shift=' || NEW.id;
    restaurant_link := '/shifts?tab=to-review&shift=' || NEW.id;
    worker_meta := jsonb_build_object('kind', 'shift_completed', 'shift_id', NEW.id);
    restaurant_meta := worker_meta;
  ELSE
    worker_link := '/shifts?shift=' || NEW.id;
    restaurant_link := '/shifts?shift=' || NEW.id;
    worker_meta := jsonb_build_object('kind', 'shift_' || NEW.status::text, 'shift_id', NEW.id);
    restaurant_meta := worker_meta;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (NEW.worker_id, title, body, worker_link, worker_meta);
  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (NEW.restaurant_id, title, body, restaurant_link, restaurant_meta);
  RETURN NEW;
END; $function$;