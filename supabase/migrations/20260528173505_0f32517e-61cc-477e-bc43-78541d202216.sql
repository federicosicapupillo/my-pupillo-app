ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS reopened_after_worker_cancellation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reopened_at timestamp with time zone;