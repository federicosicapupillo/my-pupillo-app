ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS reused_from_announcement_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_reused_from
  ON public.announcements (reused_from_announcement_id)
  WHERE reused_from_announcement_id IS NOT NULL;