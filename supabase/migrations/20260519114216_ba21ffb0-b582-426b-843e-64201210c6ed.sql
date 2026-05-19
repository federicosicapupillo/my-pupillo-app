-- Add location fields to worker_availability (weekly recurring)
ALTER TABLE public.worker_availability
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS radius_km integer;

-- Add location fields to worker_availability_exceptions (date-specific overrides)
ALTER TABLE public.worker_availability_exceptions
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS radius_km integer;

-- Indexes to speed up matching queries by city/day
CREATE INDEX IF NOT EXISTS idx_worker_availability_city_dow
  ON public.worker_availability (lower(city), day_of_week)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_availability_exceptions_city_date
  ON public.worker_availability_exceptions (lower(city), date)
  WHERE city IS NOT NULL;