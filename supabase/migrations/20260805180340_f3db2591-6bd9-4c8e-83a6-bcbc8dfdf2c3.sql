CREATE OR REPLACE FUNCTION public.block_test_labels_in_visible_notes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _is_fixture boolean;
  _pattern text := '^\s*(a|s|t|e2e|test|fixture|seed)[0-9]{0,3}([ _-][a-z0-9-]{1,20}){0,4}\s*$';
  _v text;
BEGIN
  _is_fixture := COALESCE(NEW.is_demo, false) OR NEW.seed_batch_id IS NOT NULL;
  IF NOT _is_fixture THEN
    RETURN NEW;
  END IF;

  FOREACH _v IN ARRAY (
    CASE TG_TABLE_NAME
      WHEN 'announcements' THEN ARRAY[NEW.notes, NEW.job_location_notes, NEW.job_additional_directions]
      ELSE ARRAY[NEW.operational_notes, NEW.worker_notes, NEW.description]
    END
  ) LOOP
    IF _v IS NOT NULL AND _v ~* _pattern THEN
      RAISE EXCEPTION 'Le note visibili non possono contenere codici di scenario di test (%). Usa is_demo/seed_batch_id.', _v
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_test_labels_announcements ON public.announcements;
CREATE TRIGGER trg_block_test_labels_announcements
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.block_test_labels_in_visible_notes();

DROP TRIGGER IF EXISTS trg_block_test_labels_job_requests ON public.job_requests;
CREATE TRIGGER trg_block_test_labels_job_requests
  BEFORE INSERT OR UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_test_labels_in_visible_notes();