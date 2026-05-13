-- Harden avatars storage bucket: make private and restrict access to owner only
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- Only authenticated users can read avatars, and only files inside their own folder.
-- This prevents listing or accessing other users' avatars.
CREATE POLICY "Users read own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);