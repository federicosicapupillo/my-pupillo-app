ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_restaurant_id_fkey;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_assigned_worker_id_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_restaurant_id_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_worker_id_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_announcement_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_application_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;