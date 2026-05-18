-- Private bucket for admin-only backup downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-backups', 'admin-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Admin-only read
CREATE POLICY "admin_backups_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'admin-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin-only write
CREATE POLICY "admin_backups_admin_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_backups_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'admin-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_backups_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'admin-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role));