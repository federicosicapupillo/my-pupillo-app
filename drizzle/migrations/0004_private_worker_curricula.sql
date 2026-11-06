CREATE TABLE public.worker_curricula (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 storage_path text NOT NULL,
 file_name text NOT NULL,
 file_size integer NOT NULL CHECK(file_size > 0 AND file_size <= 5242880),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(split_part(storage_path,'/',1) = user_id::text)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_curricula TO authenticated;
GRANT ALL ON public.worker_curricula TO service_role;
ALTER TABLE public.worker_curricula ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers manage own curriculum" ON public.worker_curricula FOR ALL TO authenticated USING (auth.uid()=user_id AND public.has_role(auth.uid(),'worker')) WITH CHECK (auth.uid()=user_id AND public.has_role(auth.uid(),'worker'));
CREATE POLICY "Workers read own curriculum file" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='worker-curricula' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'worker'));
CREATE POLICY "Workers upload own curriculum file" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='worker-curricula' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'worker'));
CREATE POLICY "Workers remove own curriculum file" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='worker-curricula' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'worker'));