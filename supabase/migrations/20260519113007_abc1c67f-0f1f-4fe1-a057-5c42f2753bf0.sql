
-- Worker availability (weekly recurring)
CREATE TABLE IF NOT EXISTS public.worker_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot TEXT NOT NULL CHECK (time_slot IN ('pranzo','aperitivo','cena','serale','intera_giornata','last_minute','flessibile')),
  start_time TIME NULL,
  end_time TIME NULL,
  is_flexible BOOLEAN NOT NULL DEFAULT false,
  is_last_minute BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, day_of_week, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_worker_availability_worker
  ON public.worker_availability(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_availability_dow
  ON public.worker_availability(day_of_week);

ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability viewable by authenticated"
  ON public.worker_availability FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Workers manage own availability insert"
  ON public.worker_availability FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid() AND public.has_role(auth.uid(), 'worker'::app_role));

CREATE POLICY "Workers manage own availability update"
  ON public.worker_availability FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers manage own availability delete"
  ON public.worker_availability FOR DELETE TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_worker_availability_updated_at
  BEFORE UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Exceptions (per-date overrides)
CREATE TABLE IF NOT EXISTS public.worker_availability_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL,
  time_slot TEXT NULL CHECK (time_slot IS NULL OR time_slot IN ('pranzo','aperitivo','cena','serale','intera_giornata','last_minute','flessibile')),
  start_time TIME NULL,
  end_time TIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_availability_exc_worker_date
  ON public.worker_availability_exceptions(worker_id, date);

ALTER TABLE public.worker_availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exceptions viewable by authenticated"
  ON public.worker_availability_exceptions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Workers insert own exceptions"
  ON public.worker_availability_exceptions FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid() AND public.has_role(auth.uid(), 'worker'::app_role));

CREATE POLICY "Workers update own exceptions"
  ON public.worker_availability_exceptions FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers delete own exceptions"
  ON public.worker_availability_exceptions FOR DELETE TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_worker_availability_exc_updated_at
  BEFORE UPDATE ON public.worker_availability_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- "Available now" instant flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_now_until TIMESTAMPTZ NULL;
