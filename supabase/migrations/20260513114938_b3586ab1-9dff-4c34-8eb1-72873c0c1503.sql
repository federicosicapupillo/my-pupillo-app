-- Tighten avatars bucket policies: only the user's own folder, only valid avatar filenames.

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users read own avatar"   ON storage.objects;

-- INSERT: must be in <uid>/ folder, exactly 2 path segments, valid avatar filename.
CREATE POLICY "Users upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND array_length(storage.foldername(name), 1) = 1
  AND name ~ ('^' || (auth.uid())::text || '/avatar-[0-9]+\.(jpg|jpeg|png|webp)$')
);

-- UPDATE: file must be in user's folder both before AND after the change.
CREATE POLICY "Users update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND name ~ ('^' || (auth.uid())::text || '/avatar-[0-9]+\.(jpg|jpeg|png|webp)$')
);

CREATE POLICY "Users delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users read own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);