
-- Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-documents', 'worker-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (per-user folder = user id)
CREATE POLICY "Workers read own id docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers upload own id docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers update own id docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers delete own id docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all id docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'worker-documents' AND public.has_role(auth.uid(), 'admin'));

-- Profile column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id_document_path text;

-- Backend rule: workers must have id document before completing profile
CREATE OR REPLACE FUNCTION public.enforce_worker_id_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE is_worker boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  IF COALESCE(NEW.profile_completed, false) = true
     AND (NEW.id_document_path IS NULL OR length(btrim(NEW.id_document_path)) = 0) THEN
    RAISE EXCEPTION 'Carica un documento di identità per completare il profilo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_worker_id_document_trg ON public.profiles;
CREATE TRIGGER enforce_worker_id_document_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_id_document();
