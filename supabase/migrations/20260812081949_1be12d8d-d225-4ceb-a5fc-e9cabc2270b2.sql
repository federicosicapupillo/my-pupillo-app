-- Etichetta leggibile della mansione di un annuncio (stessa resa di application_role_label)
CREATE OR REPLACE FUNCTION public.announcement_role_label(_announcement_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
    initcap(regexp_replace(COALESCE(an.professional_profile, ''), '[_-]+', ' ', 'g')),
    ''
  )
  FROM public.announcements an
  WHERE an.id = _announcement_id;
$$;

-- Data del turno in italiano ("18 agosto"), senza dipendere dal locale del server.
CREATE OR REPLACE FUNCTION public.italian_day_month(_d date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _d IS NULL THEN NULL ELSE
    EXTRACT(day FROM _d)::int::text || ' ' ||
    (ARRAY['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio',
           'agosto','settembre','ottobre','novembre','dicembre'])[EXTRACT(month FROM _d)::int]
  END;
$$;

-- Evento distinto: annuncio realmente scaduto e con ZERO candidature associate.
CREATE OR REPLACE FUNCTION public.notify_announcement_expired_no_applications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _apps_count integer;
  _role text;
  _when text;
  _body text;
BEGIN
  -- Solo la transizione reale verso "scaduto". Annullamenti/eliminazioni
  -- manuali usano altri stati e non passano di qui.
  IF NEW.status IS DISTINCT FROM 'expired'::announcement_status
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Assenza TOTALE di candidature, verificata sull'id univoco dell'annuncio
  -- e su qualsiasi stato (anche rifiutate, ritirate, chiuse).
  SELECT count(*) INTO _apps_count
  FROM public.applications ap
  WHERE ap.announcement_id = NEW.id;

  IF _apps_count > 0 THEN
    RETURN NEW;
  END IF;

  _role := COALESCE(public.announcement_role_label(NEW.id), 'questo turno');
  _when := public.italian_day_month(NEW.service_date);
  _body := 'Il tuo annuncio per ' || _role
        || COALESCE(' del ' || _when, '')
        || ' è scaduto senza ricevere candidature.';

  INSERT INTO public.notifications (user_id, title, body, link, metadata, dedupe_key)
  VALUES (
    NEW.restaurant_id,
    'Annuncio scaduto senza candidature',
    _body,
    '/announcements/' || NEW.id::text,
    jsonb_build_object(
      'kind', 'announcement_expired_no_applications',
      'announcement_id', NEW.id,
      'professional_profile', NEW.professional_profile,
      'service_date', NEW.service_date
    ),
    'announcement_expired_no_applications:' || NEW.id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_announcement_expired_no_applications ON public.announcements;
CREATE TRIGGER trg_notify_announcement_expired_no_applications
AFTER UPDATE OF status ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.notify_announcement_expired_no_applications();

REVOKE ALL ON FUNCTION public.notify_announcement_expired_no_applications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_role_label(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.italian_day_month(date) TO authenticated;