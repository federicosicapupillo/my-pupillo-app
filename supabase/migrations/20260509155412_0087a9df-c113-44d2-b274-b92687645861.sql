-- Add read tracking to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_app_unread ON public.messages (application_id, sender_id) WHERE read_at IS NULL;

-- Allow recipients (the application's other party) to mark messages as read
DROP POLICY IF EXISTS "Recipients mark messages read" ON public.messages;
CREATE POLICY "Recipients mark messages read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = messages.application_id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = messages.application_id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid())
  )
);