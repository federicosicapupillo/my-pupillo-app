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
  _old text[];
  i int;
BEGIN
  _is_fixture := COALESCE(NEW.is_demo, false) OR NEW.seed_batch_id IS NOT NULL;
  IF NOT _is_fixture THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'announcements' THEN
    _vals := ARRAY[NEW.notes, NEW.job_location_notes, NEW.job_additional_directions];
    IF TG_OP = 'UPDATE' THEN
      _old := ARRAY[OLD.notes, OLD.job_location_notes, OLD.job_additional_directions];
    END IF;
  ELSE
    _vals := ARRAY[NEW.operational_notes, NEW.worker_notes, NEW.description];
    IF TG_OP = 'UPDATE' THEN
      _old := ARRAY[OLD.operational_notes, OLD.worker_notes, OLD.description];
    END IF;
  END IF;

  FOR i IN 1..3 LOOP
    _v := _vals[i];
    -- Su UPDATE si controllano solo i testi effettivamente modificati.
    IF TG_OP = 'UPDATE' AND _v IS NOT DISTINCT FROM _old[i] THEN
      CONTINUE;
    END IF;
    IF _v IS NOT NULL AND _v ~* _pattern THEN
      RAISE EXCEPTION 'Le note visibili non possono contenere codici di scenario di test (%). Usa is_demo/seed_batch_id.', _v
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;