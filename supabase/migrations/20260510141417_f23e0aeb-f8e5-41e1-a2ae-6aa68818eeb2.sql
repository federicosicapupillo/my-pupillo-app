
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS end_time time;

ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS end_date date;

-- Backfill announcements: derive end_time from service_time + duration_hours, end_date = service_date (+1 if end_time < start_time)
UPDATE public.announcements
SET end_time = (
    (service_date + service_time + (duration_hours || ' hours')::interval)::time
  ),
    end_date = CASE
      WHEN ((service_date + service_time + (duration_hours || ' hours')::interval)::time) < service_time
        THEN service_date + 1
      ELSE service_date
    END
WHERE end_date IS NULL;

-- Backfill job_requests: end_date based on existing start_time / end_time
UPDATE public.job_requests
SET end_date = CASE
  WHEN end_time IS NOT NULL AND start_time IS NOT NULL AND end_time < start_time
    THEN shift_date + 1
  ELSE shift_date
END
WHERE end_date IS NULL;
