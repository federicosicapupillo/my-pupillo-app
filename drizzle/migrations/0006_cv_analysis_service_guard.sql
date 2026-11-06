CREATE TABLE public.curriculum_analysis_service_state (id boolean PRIMARY KEY DEFAULT true CHECK(id), paused boolean NOT NULL DEFAULT false, message text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.curriculum_analysis_service_state TO authenticated;
GRANT ALL ON public.curriculum_analysis_service_state TO service_role;
ALTER TABLE public.curriculum_analysis_service_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read CV analysis state" ON public.curriculum_analysis_service_state FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.resume_curriculum_analysis() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 UPDATE public.curriculum_analysis_service_state SET paused=false,message=NULL,updated_at=now() WHERE id=true;
 UPDATE public.worker_curriculum_assessments SET status='error',error_message=NULL,version=gen_random_uuid(),updated_at=now() WHERE status='blocked' AND consent_at IS NOT NULL;
 INSERT INTO public.admin_audit_log(actor,action,reason) VALUES(auth.uid(),'curriculum_analysis_resume','Riattivazione esplicita del servizio di analisi curriculum');
END $$;
REVOKE ALL ON FUNCTION public.resume_curriculum_analysis() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resume_curriculum_analysis() TO authenticated;
CREATE FUNCTION public.cancel_curriculum_analysis(_user_id uuid,_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 UPDATE public.worker_curriculum_assessments SET status='error',error_message='Analisi interrotta da Pupillo. Puoi avviare una nuova analisi.',version=gen_random_uuid(),updated_at=now() WHERE user_id=_user_id AND version=_version AND status='analyzing';
 INSERT INTO public.admin_audit_log(actor,action,target_user,reason) VALUES(auth.uid(),'curriculum_analysis_cancel',_user_id,'Interruzione esplicita dell’analisi: nessun riavvio automatico');
END $$;
REVOKE ALL ON FUNCTION public.cancel_curriculum_analysis(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_curriculum_analysis(uuid,uuid) TO authenticated;