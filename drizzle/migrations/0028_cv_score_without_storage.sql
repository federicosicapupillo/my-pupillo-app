CREATE TABLE public.worker_cv_pending_scores (
  user_id uuid PRIMARY KEY,
  role_label text NOT NULL,
  scores jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer,
  stars integer CHECK (stars IN (4,5)),
  evaluable boolean NOT NULL,
  doubts boolean NOT NULL,
  rubric_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worker_cv_pending_scores TO authenticated;
GRANT ALL ON public.worker_cv_pending_scores TO service_role;
ALTER TABLE public.worker_cv_pending_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads pending CV score" ON public.worker_cv_pending_scores FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.worker_received_review(_worker_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.reviews r WHERE r.target_id=_worker_id AND r.direction='restaurant_to_worker' AND NOT r.is_demo);
$$;
REVOKE EXECUTE ON FUNCTION public.worker_received_review(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_cv_upload_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'worker') AND NOT public.worker_received_review(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.my_cv_upload_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_cv_upload_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_pending_curriculum_score() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.worker_cv_pending_scores; a public.worker_curriculum_assessments;
BEGIN
 IF NOT public.my_cv_upload_allowed() THEN RAISE EXCEPTION 'Il punteggio del curriculum non è più disponibile: hai già ricevuto recensioni'; END IF;
 SELECT * INTO p FROM public.worker_cv_pending_scores WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nessun punteggio da accettare'; END IF;
 INSERT INTO public.worker_curriculum_assessments(user_id,curriculum_path,role_label,consent_at,status,scores,evidence,total,stars,evaluable,doubts,reviewed_at,review_note,error_message,version,rubric_version,updated_at)
 VALUES (p.user_id,'memory:'||gen_random_uuid(),p.role_label,now(),CASE WHEN p.evaluable THEN 'approved' ELSE 'not_evaluable' END,p.scores,p.evidence,p.total,p.stars,p.evaluable,p.doubts,now(),'Punteggio IA accettato dal lavoratore. PDF non conservato.',NULL,gen_random_uuid(),p.rubric_version,now())
 ON CONFLICT (user_id) DO UPDATE SET curriculum_path=EXCLUDED.curriculum_path,role_label=EXCLUDED.role_label,consent_at=EXCLUDED.consent_at,status=EXCLUDED.status,scores=EXCLUDED.scores,evidence=EXCLUDED.evidence,total=EXCLUDED.total,stars=EXCLUDED.stars,evaluable=EXCLUDED.evaluable,doubts=EXCLUDED.doubts,reviewed_by=NULL,reviewed_at=EXCLUDED.reviewed_at,review_note=EXCLUDED.review_note,error_message=NULL,version=EXCLUDED.version,rubric_version=EXCLUDED.rubric_version,updated_at=now();
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=auth.uid();
 UPDATE public.worker_curriculum_assessments SET auto_publication_consent=true, public_visible=public.curriculum_rating_eligible(a) WHERE user_id=auth.uid();
 DELETE FROM public.worker_cv_pending_scores WHERE user_id=auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_pending_curriculum_score() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pending_curriculum_score() TO authenticated;

CREATE OR REPLACE FUNCTION public.discard_pending_curriculum_score() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 DELETE FROM public.worker_cv_pending_scores WHERE user_id=auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.discard_pending_curriculum_score() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discard_pending_curriculum_score() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_worker_curriculum_rating(_worker_id uuid) RETURNS TABLE(stars integer, role_label text, reviewed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT a.stars,a.role_label,a.reviewed_at FROM public.worker_curriculum_assessments a JOIN public.profiles p ON p.id=a.user_id
 WHERE auth.uid() IS NOT NULL AND a.user_id=_worker_id AND a.public_visible AND public.curriculum_rating_eligible(a)
 AND (a.curriculum_path LIKE 'memory:%' OR EXISTS (SELECT 1 FROM public.worker_curricula c WHERE c.user_id=a.user_id AND c.storage_path=a.curriculum_path))
 AND NOT public.worker_received_review(a.user_id)
 AND NOT p.is_deleted AND NOT p.is_demo AND NOT p.moderation_hidden AND p.profile_completed;
$$;

CREATE OR REPLACE FUNCTION public.set_curriculum_rating_visibility(_visible boolean, _version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.worker_curriculum_assessments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 SELECT * INTO a FROM public.worker_curriculum_assessments WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR a.version IS DISTINCT FROM _version THEN RAISE EXCEPTION 'La valutazione è cambiata. Aggiorna la pagina'; END IF;
 IF _visible IS NULL THEN RAISE EXCEPTION 'Scegli la visibilità'; END IF;
 IF _visible AND (NOT public.curriculum_rating_eligible(a) OR public.worker_received_review(auth.uid()) OR NOT (a.curriculum_path LIKE 'memory:%' OR EXISTS(SELECT 1 FROM public.worker_curricula c WHERE c.user_id=auth.uid() AND c.storage_path=a.curriculum_path))) THEN RAISE EXCEPTION 'Questa valutazione non è ancora pubblicabile'; END IF;
 UPDATE public.worker_curriculum_assessments SET public_visible=_visible,updated_at=now() WHERE user_id=auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.discard_cv_score_on_first_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.direction='restaurant_to_worker' AND NOT NEW.is_demo THEN
  UPDATE public.worker_curriculum_assessments SET status='stale',public_visible=false,version=gen_random_uuid(),review_note='Sostituito dalla prima recensione ricevuta.',updated_at=now() WHERE user_id=NEW.target_id AND status<>'stale';
  DELETE FROM public.worker_cv_pending_scores WHERE user_id=NEW.target_id;
 END IF;
 RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.discard_cv_score_on_first_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER discard_cv_score_on_first_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.discard_cv_score_on_first_review();

UPDATE public.worker_curriculum_assessments a SET status='stale',public_visible=false,version=gen_random_uuid(),review_note='Sostituito dalla prima recensione ricevuta.',updated_at=now()
 WHERE status<>'stale' AND public.worker_received_review(a.user_id);