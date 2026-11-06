CREATE TABLE public.worker_curriculum_assessments (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 curriculum_path text NOT NULL,
 role_label text NOT NULL,
 consent_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','analyzing','pending_review','approved','rejected','not_evaluable','stale','error','blocked')),
 scores jsonb,
 evidence jsonb,
 total integer CHECK (total BETWEEN 0 AND 100),
 stars integer CHECK (stars IN (4,5)),
 evaluable boolean NOT NULL DEFAULT false,
 doubts boolean NOT NULL DEFAULT true,
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text,
 error_message text,
 version uuid NOT NULL DEFAULT gen_random_uuid(),
 rubric_version text NOT NULL DEFAULT '1',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worker_curriculum_assessments TO authenticated;
GRANT ALL ON public.worker_curriculum_assessments TO service_role;
ALTER TABLE public.worker_curriculum_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner and admin read CV assessments" ON public.worker_curriculum_assessments FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.request_curriculum_assessment(_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_path text; v_state text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 IF length(trim(_role)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Seleziona una mansione valida'; END IF;
 SELECT storage_path INTO v_path FROM public.worker_curricula WHERE user_id=auth.uid() FOR UPDATE;
 IF v_path IS NULL THEN RAISE EXCEPTION 'Carica prima il curriculum'; END IF;
 SELECT status INTO v_state FROM public.worker_curriculum_assessments WHERE user_id=auth.uid() FOR UPDATE;
 IF v_state IN ('requested','analyzing','pending_review','blocked') THEN RAISE EXCEPTION 'La richiesta è già presente o richiede un controllo Pupillo'; END IF;
 INSERT INTO public.worker_curriculum_assessments(user_id,curriculum_path,role_label) VALUES(auth.uid(),v_path,trim(_role))
 ON CONFLICT(user_id) DO UPDATE SET curriculum_path=v_path,role_label=trim(_role),consent_at=now(),status='requested',scores=NULL,evidence=NULL,total=NULL,stars=NULL,evaluable=false,doubts=true,reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,error_message=NULL,version=gen_random_uuid(),updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.request_curriculum_assessment(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_curriculum_assessment(text) TO authenticated;

CREATE FUNCTION public.withdraw_curriculum_assessment() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 UPDATE public.worker_curriculum_assessments SET status='stale',consent_at=NULL,version=gen_random_uuid(),updated_at=now() WHERE user_id=auth.uid();
END $$;
-- Consent withdrawal uses a nullable timestamp.
ALTER TABLE public.worker_curriculum_assessments ALTER COLUMN consent_at DROP NOT NULL;
REVOKE ALL ON FUNCTION public.withdraw_curriculum_assessment() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.withdraw_curriculum_assessment() TO authenticated;

CREATE FUNCTION public.review_curriculum_assessment(_user_id uuid,_version uuid,_approve boolean,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.worker_curriculum_assessments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=_user_id AND version=_version FOR UPDATE;
 IF NOT FOUND OR a.status <> 'pending_review' OR a.consent_at IS NULL THEN RAISE EXCEPTION 'La valutazione non è più disponibile'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.worker_curricula WHERE user_id=_user_id AND storage_path=a.curriculum_path) THEN RAISE EXCEPTION 'Il curriculum è cambiato'; END IF;
 IF length(trim(coalesce(_note,''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Inserisci una nota di verifica'; END IF;
 IF _approve AND (NOT a.evaluable OR a.doubts OR a.total<70 OR a.stars IS NULL OR a.stars<>CASE WHEN a.total>=85 THEN 5 ELSE 4 END) THEN RAISE EXCEPTION 'Questa valutazione non è pubblicabile'; END IF;
 UPDATE public.worker_curriculum_assessments SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(_note),updated_at=now() WHERE user_id=_user_id;
 INSERT INTO public.admin_audit_log(actor,action,target_user,reason,metadata) VALUES(auth.uid(),'curriculum_assessment_review',_user_id,trim(_note),jsonb_build_object('approved',_approve,'version',_version));
END $$;
REVOKE ALL ON FUNCTION public.review_curriculum_assessment(uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_curriculum_assessment(uuid,uuid,boolean,text) TO authenticated;

CREATE FUNCTION public.get_worker_curriculum_rating(_worker_id uuid) RETURNS TABLE(stars integer,role_label text,reviewed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.stars,a.role_label,a.reviewed_at FROM public.worker_curriculum_assessments a JOIN public.profiles p ON p.id=a.user_id JOIN public.worker_curricula c ON c.user_id=a.user_id AND c.storage_path=a.curriculum_path
 WHERE auth.uid() IS NOT NULL AND a.user_id=_worker_id AND a.status='approved' AND a.consent_at IS NOT NULL AND a.evaluable AND NOT a.doubts AND a.total>=70 AND a.stars IN (4,5) AND NOT p.is_deleted AND NOT p.is_demo AND NOT p.moderation_hidden AND p.profile_completed;
$$;
REVOKE ALL ON FUNCTION public.get_worker_curriculum_rating(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_worker_curriculum_rating(uuid) TO authenticated;

CREATE FUNCTION public.invalidate_curriculum_assessment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.storage_path IS DISTINCT FROM NEW.storage_path THEN
 UPDATE public.worker_curriculum_assessments SET status='stale',version=gen_random_uuid(),updated_at=now() WHERE user_id=OLD.user_id;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER invalidate_curriculum_assessment AFTER UPDATE OR DELETE ON public.worker_curricula FOR EACH ROW EXECUTE FUNCTION public.invalidate_curriculum_assessment();