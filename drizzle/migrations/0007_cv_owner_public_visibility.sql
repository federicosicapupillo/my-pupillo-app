ALTER TABLE public.worker_curriculum_assessments ADD COLUMN public_visible boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.worker_curriculum_assessments.public_visible IS 'Explicit worker opt-in after admin approval; reset when assessment version changes.';
CREATE FUNCTION public.reset_curriculum_public_visibility() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.public_visible:=false;
 ELSIF NEW.version IS DISTINCT FROM OLD.version OR NEW.consent_at IS NULL OR NEW.status<>'approved' THEN NEW.public_visible:=false;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_curriculum_public_visibility BEFORE INSERT OR UPDATE ON public.worker_curriculum_assessments FOR EACH ROW EXECUTE FUNCTION public.reset_curriculum_public_visibility();
CREATE FUNCTION public.set_curriculum_rating_visibility(_visible boolean,_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.worker_curriculum_assessments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR a.version IS DISTINCT FROM _version THEN RAISE EXCEPTION 'La valutazione è cambiata. Aggiorna la pagina'; END IF;
 IF _visible IS NULL THEN RAISE EXCEPTION 'Scegli la visibilità'; END IF;
 IF _visible AND (a.status<>'approved' OR a.consent_at IS NULL OR NOT a.evaluable OR a.doubts OR a.total IS NULL OR a.total<70 OR a.stars IS NULL OR a.stars NOT IN (4,5) OR a.stars<>CASE WHEN a.total>=85 THEN 5 ELSE 4 END OR NOT EXISTS(SELECT 1 FROM public.worker_curricula c WHERE c.user_id=auth.uid() AND c.storage_path=a.curriculum_path)) THEN RAISE EXCEPTION 'Questa valutazione non è ancora pubblicabile'; END IF;
 UPDATE public.worker_curriculum_assessments SET public_visible=_visible,updated_at=now() WHERE user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_curriculum_rating_visibility(boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_curriculum_rating_visibility(boolean,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_worker_curriculum_rating(_worker_id uuid) RETURNS TABLE(stars integer,role_label text,reviewed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.stars,a.role_label,a.reviewed_at FROM public.worker_curriculum_assessments a JOIN public.profiles p ON p.id=a.user_id JOIN public.worker_curricula c ON c.user_id=a.user_id AND c.storage_path=a.curriculum_path
 WHERE auth.uid() IS NOT NULL AND a.user_id=_worker_id AND a.public_visible AND a.status='approved' AND a.consent_at IS NOT NULL AND a.evaluable AND NOT a.doubts AND a.total>=70 AND a.stars IN (4,5) AND a.stars=CASE WHEN a.total>=85 THEN 5 ELSE 4 END AND NOT p.is_deleted AND NOT p.is_demo AND NOT p.moderation_hidden AND p.profile_completed;
$$;
REVOKE ALL ON FUNCTION public.get_worker_curriculum_rating(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_worker_curriculum_rating(uuid) TO authenticated;