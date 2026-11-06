ALTER TABLE public.worker_curriculum_assessments ADD COLUMN auto_publication_consent boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.worker_curriculum_assessments.auto_publication_consent IS 'Explicit consent on a new assessment request to publish only eligible completed ratings; legacy requests remain false.';
CREATE OR REPLACE FUNCTION public.reset_curriculum_public_visibility() RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.public_visible:=false; NEW.auto_publication_consent:=false;
 ELSIF NEW.version IS DISTINCT FROM OLD.version OR NEW.consent_at IS NULL OR NEW.status='stale' THEN
  NEW.public_visible:=false; NEW.auto_publication_consent:=false;
 ELSIF NEW.status<>'approved' THEN NEW.public_visible:=false;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.request_auto_public_curriculum_assessment(_role text, _publication_consent boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 IF _publication_consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Conferma il consenso alla pubblicazione della valutazione idonea'; END IF;
 PERFORM public.request_curriculum_assessment(_role);
 UPDATE public.worker_curriculum_assessments SET auto_publication_consent=true WHERE user_id=auth.uid() AND status='requested';
END $$;
REVOKE ALL ON FUNCTION public.request_auto_public_curriculum_assessment(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_auto_public_curriculum_assessment(text,boolean) TO authenticated;