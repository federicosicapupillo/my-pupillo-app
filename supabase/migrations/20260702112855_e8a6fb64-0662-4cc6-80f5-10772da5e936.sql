-- Replace partial unique index on notifications(user_id, dedupe_key) with a full unique constraint
-- so that PostgREST/Supabase upsert with onConflict='user_id,dedupe_key' can infer the arbiter index.
-- NULL dedupe_key values remain allowed (Postgres treats NULLs as distinct in unique constraints).

DROP INDEX IF EXISTS public.notifications_user_dedupe_key_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_uniq
  ON public.notifications (user_id, dedupe_key);
