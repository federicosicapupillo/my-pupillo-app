CREATE OR REPLACE FUNCTION public.curriculum_rating_eligible(a public.worker_curriculum_assessments) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(a.status='approved' AND a.consent_at IS NOT NULL AND a.evaluable AND a.total IS NOT NULL AND a.stars IN(4,5) AND CASE WHEN a.rubric_version='2' THEN a.stars=CASE WHEN a.total>=85 AND NOT a.doubts THEN 5 ELSE 4 END ELSE NOT a.doubts AND a.total>=70 AND a.stars=CASE WHEN a.total>=85 THEN 5 ELSE 4 END END,false);
$$;
REVOKE ALL ON FUNCTION public.curriculum_rating_eligible(public.worker_curriculum_assessments) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curriculum_rating_eligible(public.worker_curriculum_assessments) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_worker_curriculum_rating(_worker_id uuid) RETURNS TABLE(stars integer,role_label text,reviewed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.stars,a.role_label,a.reviewed_at FROM public.worker_curriculum_assessments a JOIN public.profiles p ON p.id=a.user_id JOIN public.worker_curricula c ON c.user_id=a.user_id AND c.storage_path=a.curriculum_path WHERE auth.uid() IS NOT NULL AND a.user_id=_worker_id AND a.public_visible AND public.curriculum_rating_eligible(a) AND NOT p.is_deleted AND NOT p.is_demo AND NOT p.moderation_hidden AND p.profile_completed;
$$;
CREATE OR REPLACE FUNCTION public.set_curriculum_rating_visibility(_visible boolean,_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.worker_curriculum_assessments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR a.version IS DISTINCT FROM _version THEN RAISE EXCEPTION 'La valutazione è cambiata. Aggiorna la pagina'; END IF;
 IF _visible IS NULL THEN RAISE EXCEPTION 'Scegli la visibilità'; END IF;
 IF _visible AND (NOT public.curriculum_rating_eligible(a) OR NOT EXISTS(SELECT 1 FROM public.worker_curricula c WHERE c.user_id=auth.uid() AND c.storage_path=a.curriculum_path)) THEN RAISE EXCEPTION 'Questa valutazione non è ancora pubblicabile'; END IF;
 UPDATE public.worker_curriculum_assessments SET public_visible=_visible,updated_at=now() WHERE user_id=auth.uid();
END; $$;
CREATE OR REPLACE FUNCTION public.review_curriculum_assessment(_user_id uuid,_version uuid,_approve boolean,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.worker_curriculum_assessments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=_user_id AND version=_version FOR UPDATE;
 IF NOT FOUND OR a.status<>'pending_review' OR a.consent_at IS NULL THEN RAISE EXCEPTION 'La valutazione non è più disponibile'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.worker_curricula WHERE user_id=_user_id AND storage_path=a.curriculum_path) THEN RAISE EXCEPTION 'Il curriculum è cambiato'; END IF;
 IF length(trim(coalesce(_note,''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Inserisci una nota di verifica'; END IF;
 a.status:='approved';
 IF _approve AND NOT public.curriculum_rating_eligible(a) THEN RAISE EXCEPTION 'Questa valutazione non è pubblicabile'; END IF;
 UPDATE public.worker_curriculum_assessments SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(_note),updated_at=now() WHERE user_id=_user_id;
 INSERT INTO public.admin_audit_log(actor,action,target_user,reason,metadata) VALUES(auth.uid(),'curriculum_assessment_review',_user_id,trim(_note),jsonb_build_object('approved',_approve,'version',_version));
END; $$;