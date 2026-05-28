-- Revert security_invoker on the public projection views.
-- These views intentionally bypass the base-table RLS so workers can browse
-- the national list of active announcements / published job requests, while
-- still excluding PII columns (contact details, exact GPS, etc.) by design.
-- Setting security_invoker=true broke "Trova offerte" because the worker
-- has no party-based access to other restaurants' announcement rows.
ALTER VIEW public.announcements_public SET (security_invoker = false);
ALTER VIEW public.job_requests_public SET (security_invoker = false);