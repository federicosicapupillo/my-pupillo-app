
-- 1) Add notes field to announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS notes text;

-- 2) Trigger: auto-create shift when application is accepted
CREATE OR REPLACE FUNCTION public.create_shift_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ann record;
  amt numeric;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT * INTO ann FROM public.announcements WHERE id = NEW.announcement_id;
    IF ann IS NULL THEN RETURN NEW; END IF;
    amt := COALESCE(NEW.proposed_tariff, ann.tariff_amount);
    IF ann.tariff_type = 'hourly' THEN amt := amt * ann.duration_hours; END IF;
    -- Avoid duplicates
    IF NOT EXISTS (SELECT 1 FROM public.shifts WHERE announcement_id = NEW.announcement_id AND worker_id = NEW.worker_id) THEN
      INSERT INTO public.shifts (announcement_id, restaurant_id, worker_id, shift_date, hours, amount, status)
      VALUES (NEW.announcement_id, NEW.restaurant_id, NEW.worker_id, ann.service_date, ann.duration_hours, amt, 'scheduled');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_create_shift_on_accept ON public.applications;
CREATE TRIGGER trg_create_shift_on_accept
AFTER UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.create_shift_on_accept();

-- 3) Notify restaurant when a new application arrives
CREATE OR REPLACE FUNCTION public.notify_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  worker_name text;
  recipient uuid;
  by_role text;
BEGIN
  -- Determine who initiated: if sender is restaurant, notify worker; otherwise notify restaurant
  IF NEW.worker_id <> NEW.restaurant_id AND
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.worker_id AND role = 'worker') THEN
    -- Default: worker applied → notify restaurant
    recipient := NEW.restaurant_id;
    SELECT COALESCE(full_name, 'Un lavoratore') INTO worker_name FROM public.profiles WHERE id = NEW.worker_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (recipient, 'Nuova candidatura', worker_name || ' si è candidato per il tuo annuncio.', '/messages/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_application_insert ON public.applications;
CREATE TRIGGER trg_notify_application_insert
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_insert();

-- 4) Notify on application status change
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
  title text;
  body text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  -- Notify the OPPOSITE party of the change
  -- Worker actions → notify restaurant; restaurant actions → notify worker.
  -- We approximate: 'interested', 'not_interested', 'counter_offer' usually from worker → notify restaurant
  -- 'accepted', 'rejected' usually from restaurant → notify worker
  IF NEW.status IN ('interested','not_interested','counter_offer') THEN
    recipient := NEW.restaurant_id;
  ELSE
    recipient := NEW.worker_id;
  END IF;

  CASE NEW.status
    WHEN 'interested' THEN title := 'Lavoratore interessato'; body := 'Il lavoratore ha confermato interesse.';
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

DROP TRIGGER IF EXISTS trg_notify_application_status ON public.applications;
CREATE TRIGGER trg_notify_application_status
AFTER UPDATE OF status ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_status();

-- 5) Notify on shift status change
CREATE OR REPLACE FUNCTION public.notify_shift_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  title text; body text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.worker_id, 'Turno confermato', 'Hai un nuovo turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.', '/shifts');
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.restaurant_id, 'Turno creato', 'Turno programmato il ' || to_char(NEW.shift_date, 'DD/MM/YYYY') || '.', '/shifts');
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'completed' THEN title := 'Turno completato'; body := 'Il turno è stato segnato come completato. Puoi lasciare una recensione.';
    WHEN 'no_show' THEN title := 'Segnalato no-show'; body := 'Il turno è stato segnato come no-show.';
    WHEN 'cancelled' THEN title := 'Turno annullato'; body := 'Il turno è stato annullato.';
    ELSE title := 'Turno aggiornato'; body := NEW.status::text;
  END CASE;
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (NEW.worker_id, title, body, '/shifts');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (NEW.restaurant_id, title, body, '/shifts');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_shift_insert ON public.shifts;
CREATE TRIGGER trg_notify_shift_insert
AFTER INSERT ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.notify_shift_status();

DROP TRIGGER IF EXISTS trg_notify_shift_status ON public.shifts;
CREATE TRIGGER trg_notify_shift_status
AFTER UPDATE OF status ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.notify_shift_status();
