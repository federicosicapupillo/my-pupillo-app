CREATE OR REPLACE FUNCTION public.enforce_worker_id_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_worker boolean;
  require_doc boolean := public.is_feature_enabled('require_id_document');
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  IF require_doc THEN
    IF COALESCE(NEW.profile_completed, false) = true
       AND (NEW.id_document_path IS NULL OR length(btrim(NEW.id_document_path)) = 0) THEN
      RAISE EXCEPTION 'Carica un documento di identità per completare il profilo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;