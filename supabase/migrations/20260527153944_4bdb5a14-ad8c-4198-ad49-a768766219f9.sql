
ALTER TABLE public.worker_incidents
  DROP CONSTRAINT IF EXISTS worker_incidents_kind_check;

ALTER TABLE public.worker_incidents
  ADD CONSTRAINT worker_incidents_kind_check
  CHECK (kind IN (
    'no_show','abandoned','misconduct','offensive','client_issue','other',
    'delay','cancellation','worker_cancelled'
  ));

ALTER TABLE public.worker_incidents
  ALTER COLUMN description DROP NOT NULL;

ALTER TABLE public.worker_incidents
  ADD COLUMN IF NOT EXISTS incident_type text,
  ADD COLUMN IF NOT EXISTS estimated_delay_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_delay_minutes integer,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS custom_reason text,
  ADD COLUMN IF NOT EXISTS job_request_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_by_restaurant_at timestamptz,
  ADD COLUMN IF NOT EXISTS affects_reputation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_compensation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE ON public.worker_incidents TO authenticated;
GRANT ALL ON public.worker_incidents TO service_role;

-- Allow workers to create their own delay / cancellation incidents on shifts they own
DROP POLICY IF EXISTS "Workers create own incidents" ON public.worker_incidents;
CREATE POLICY "Workers create own incidents"
  ON public.worker_incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_id = auth.uid()
    AND kind IN ('delay','cancellation','worker_cancelled')
    AND (
      shift_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.shifts s
        WHERE s.id = worker_incidents.shift_id
          AND s.worker_id = auth.uid()
          AND s.status = 'scheduled'
      )
    )
  );

-- Allow workers to update their own pending delay incident (revise estimated minutes / reason)
DROP POLICY IF EXISTS "Workers update own delay incidents" ON public.worker_incidents;
CREATE POLICY "Workers update own delay incidents"
  ON public.worker_incidents FOR UPDATE
  TO authenticated
  USING (worker_id = auth.uid() AND kind = 'delay' AND status = 'pending')
  WITH CHECK (worker_id = auth.uid() AND kind = 'delay');

-- Restaurants can confirm / close a delay incident on their own shifts
DROP POLICY IF EXISTS "Restaurants confirm own incidents" ON public.worker_incidents;
CREATE POLICY "Restaurants confirm own incidents"
  ON public.worker_incidents FOR UPDATE
  TO authenticated
  USING (restaurant_id = auth.uid())
  WITH CHECK (restaurant_id = auth.uid());

-- Prevent duplicate delay incidents per shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_incidents_unique_delay_per_shift
  ON public.worker_incidents(shift_id, kind)
  WHERE shift_id IS NOT NULL AND kind = 'delay';

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_worker_incidents_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_incidents_touch_updated_at ON public.worker_incidents;
CREATE TRIGGER trg_worker_incidents_touch_updated_at
BEFORE UPDATE ON public.worker_incidents
FOR EACH ROW EXECUTE FUNCTION public.touch_worker_incidents_updated_at();
