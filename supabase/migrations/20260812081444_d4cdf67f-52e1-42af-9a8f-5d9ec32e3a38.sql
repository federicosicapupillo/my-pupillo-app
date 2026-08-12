CREATE OR REPLACE FUNCTION public.block_test_labels_in_visible_notes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _is_fixture boolean;
  _pattern text := '^\s*(a|s|t|e2e|test|fixture|seed)[0-9]{0,3}([ _-][a-z0-9-]{1,20}){0,4}\s*$';
  _v text;
  _vals text[];
BEGIN
  _is_fixture := COALESCE(NEW.is_demo, false) OR NEW.seed_batch_id IS NOT NULL;
  IF NOT _is_fixture THEN
    RETURN NEW;
  END IF;

  -- I riferimenti a NEW.<campo> sono risolti a runtime per l'intera
  -- espressione: vanno tenuti in rami separati, altrimenti la tabella
  -- announcements fallisce sui campi di job_requests e viceversa.
  IF TG_TABLE_NAME = 'announcements' THEN
    _vals := ARRAY[NEW.notes, NEW.job_location_notes, NEW.job_additional_directions];
  ELSE
    _vals := ARRAY[NEW.operational_notes, NEW.worker_notes, NEW.description];
  END IF;

  FOREACH _v IN ARRAY _vals LOOP
    IF _v IS NOT NULL AND _v ~* _pattern THEN
      RAISE EXCEPTION 'Le note visibili non possono contenere codici di scenario di test (%). Usa is_demo/seed_batch_id.', _v
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;