
-- 1. New column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- 2. Backfill for rows that already carry a recognizable entity in metadata.
--    The key shape is: <kind>:<entity_id>:<user_id>, matching the helper.
UPDATE public.notifications n
SET dedupe_key = format(
  '%s:%s:%s',
  COALESCE(NULLIF(n.metadata->>'kind',''), 'generic'),
  COALESCE(
    NULLIF(n.metadata->>'shift_id',''),
    NULLIF(n.metadata->>'application_id',''),
    NULLIF(n.metadata->>'announcement_id',''),
    NULLIF(n.metadata->>'review_id','')
  ),
  n.user_id::text
)
WHERE n.dedupe_key IS NULL
  AND n.metadata IS NOT NULL
  AND (
    NULLIF(n.metadata->>'shift_id','')        IS NOT NULL OR
    NULLIF(n.metadata->>'application_id','')  IS NOT NULL OR
    NULLIF(n.metadata->>'announcement_id','') IS NOT NULL OR
    NULLIF(n.metadata->>'review_id','')       IS NOT NULL
  );

-- 3. Remove already-existing duplicates for the same (user_id, dedupe_key).
--    Keeps the OLDEST row (the original event) and deletes the later copies.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, dedupe_key
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.notifications
  WHERE dedupe_key IS NOT NULL
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;

-- 4. Partial unique index: enforce idempotency only where a key is provided.
--    Legacy rows with dedupe_key IS NULL are not affected.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_uniq
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
