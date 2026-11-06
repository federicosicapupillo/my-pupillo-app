DO $migration$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('enforce_launch_area_announcement','enforce_launch_area_availability','enforce_launch_area_job_request','enforce_launch_area_profile') LOOP
    EXECUTE replace(pg_get_functiondef(f.oid), 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.', 'Pupillo è attualmente disponibile esclusivamente a Torino e nei comuni della Città metropolitana di Torino.');
  END LOOP;
END;
$migration$;