CREATE OR REPLACE FUNCTION public.curriculum_rating_eligible(a worker_curriculum_assessments)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
 SELECT COALESCE(a.status='approved' AND a.consent_at IS NOT NULL AND a.total IS NOT NULL AND a.stars IN(4,5) AND CASE
 WHEN a.rubric_version='4' THEN jsonb_typeof(a.scores->'work_experiences')='number' AND jsonb_typeof(a.scores->'managed_business_or_team')='boolean' AND a.stars=CASE WHEN a.total>=70 AND ((a.scores->>'work_experiences')::numeric>=2 OR a.scores->>'managed_business_or_team'='true') THEN 5 ELSE 4 END
 WHEN a.rubric_version='3' THEN a.evaluable AND jsonb_typeof(a.scores->'work_experiences')='number' AND jsonb_typeof(a.scores->'managed_business_or_team')='boolean' AND a.stars=CASE WHEN (a.scores->>'work_experiences')::numeric>=2 OR a.scores->>'managed_business_or_team'='true' THEN 5 ELSE 4 END
 WHEN a.rubric_version='2' THEN a.evaluable AND a.stars=CASE WHEN a.total>=85 AND NOT a.doubts THEN 5 ELSE 4 END
 ELSE a.evaluable AND NOT a.doubts AND a.total>=70 AND a.stars=CASE WHEN a.total>=85 THEN 5 ELSE 4 END END,false);
$function$;

CREATE OR REPLACE FUNCTION public.accept_pending_curriculum_score()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.worker_cv_pending_scores; a public.worker_curriculum_assessments;
BEGIN
 IF NOT public.my_cv_upload_allowed() THEN RAISE EXCEPTION 'Il punteggio del curriculum non è più disponibile: hai già ricevuto recensioni'; END IF;
 SELECT * INTO p FROM public.worker_cv_pending_scores WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nessun punteggio da accettare'; END IF;
 INSERT INTO public.worker_curriculum_assessments(user_id,curriculum_path,role_label,consent_at,status,scores,evidence,total,stars,evaluable,doubts,reviewed_at,review_note,error_message,version,rubric_version,updated_at)
 VALUES (p.user_id,'memory:'||gen_random_uuid(),p.role_label,now(),CASE WHEN p.evaluable OR p.rubric_version='4' THEN 'approved' ELSE 'not_evaluable' END,p.scores,p.evidence,p.total,p.stars,p.evaluable,p.doubts,now(),'Punteggio IA accettato dal lavoratore. PDF non conservato.',NULL,gen_random_uuid(),p.rubric_version,now())
 ON CONFLICT (user_id) DO UPDATE SET curriculum_path=EXCLUDED.curriculum_path,role_label=EXCLUDED.role_label,consent_at=EXCLUDED.consent_at,status=EXCLUDED.status,scores=EXCLUDED.scores,evidence=EXCLUDED.evidence,total=EXCLUDED.total,stars=EXCLUDED.stars,evaluable=EXCLUDED.evaluable,doubts=EXCLUDED.doubts,reviewed_by=NULL,reviewed_at=EXCLUDED.reviewed_at,review_note=EXCLUDED.review_note,error_message=NULL,version=EXCLUDED.version,rubric_version=EXCLUDED.rubric_version,updated_at=now();
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=auth.uid();
 UPDATE public.worker_curriculum_assessments SET auto_publication_consent=true, public_visible=public.curriculum_rating_eligible(a) WHERE user_id=auth.uid();
 DELETE FROM public.worker_cv_pending_scores WHERE user_id=auth.uid();
END $function$;