ALTER TABLE public.worker_availability DROP CONSTRAINT IF EXISTS worker_availability_time_slot_check;
ALTER TABLE public.worker_availability ADD CONSTRAINT worker_availability_time_slot_check
  CHECK (time_slot = ANY (ARRAY['colazione','pranzo','aperitivo','cena','serale','intera_giornata','last_minute','flessibile','personalizzata']));

ALTER TABLE public.worker_availability_exceptions DROP CONSTRAINT IF EXISTS worker_availability_exceptions_time_slot_check;
ALTER TABLE public.worker_availability_exceptions ADD CONSTRAINT worker_availability_exceptions_time_slot_check
  CHECK (time_slot IS NULL OR time_slot = ANY (ARRAY['colazione','pranzo','aperitivo','cena','serale','intera_giornata','last_minute','flessibile','personalizzata']));