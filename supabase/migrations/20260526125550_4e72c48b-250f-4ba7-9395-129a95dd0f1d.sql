-- Prevent duplicate active applications for the same (announcement, worker).
-- Active = any status where the parties are still in contact about the shift.
CREATE UNIQUE INDEX IF NOT EXISTS applications_unique_active_per_ann_worker
  ON public.applications (announcement_id, worker_id)
  WHERE status IN ('pending', 'interested', 'counter_offer', 'accepted');