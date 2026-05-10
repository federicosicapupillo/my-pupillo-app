-- Add long-shift tracking fields
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS shift_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS is_long_shift boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS long_shift_reason text;

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS shift_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS is_long_shift boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS long_shift_reason text;

-- Backfill existing rows
UPDATE public.announcements
SET shift_duration_hours = COALESCE(shift_duration_hours, duration_hours),
    is_long_shift = COALESCE(duration_hours, 0) > 8
WHERE shift_duration_hours IS NULL OR is_long_shift IS DISTINCT FROM (COALESCE(duration_hours, 0) > 8);
