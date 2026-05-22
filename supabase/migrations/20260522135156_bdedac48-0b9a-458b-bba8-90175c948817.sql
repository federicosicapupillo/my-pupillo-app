CREATE OR REPLACE FUNCTION public.notify_application_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
BEGIN
  IF NEW.worker_id <> NEW.restaurant_id AND
     EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.worker_id AND role = 'worker') THEN
    recipient := NEW.restaurant_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      recipient,
      'Nuova candidatura',
      'Un lavoratore si è candidato per il tuo annuncio.',
      '/messages/' || NEW.id
    );
  END IF;
  RETURN NEW;
END; $$;

UPDATE public.notifications n
SET body = 'Un lavoratore si è candidato per il tuo annuncio.'
WHERE n.title IN ('Nuova candidatura','Nuova candidatura ricevuta')
  AND n.body IS NOT NULL
  AND n.body <> 'Un lavoratore si è candidato per il tuo annuncio.'
  AND n.link LIKE '/messages/%'
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id::text = substring(n.link from '/messages/(.*)$')
      AND a.status <> 'accepted'
  );