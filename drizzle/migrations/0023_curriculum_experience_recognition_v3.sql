CREATE OR REPLACE FUNCTION public.curriculum_rating_eligible(a public.worker_curriculum_assessments) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(a.status='approved' AND a.consent_at IS NOT NULL AND a.evaluable AND a.total IS NOT NULL AND a.stars IN(4,5) AND CASE
 WHEN a.rubric_version='3' THEN jsonb_typeof(a.scores->'work_experiences')='number' AND jsonb_typeof(a.scores->'managed_business_or_team')='boolean' AND a.stars=CASE WHEN (a.scores->>'work_experiences')::numeric>=2 OR a.scores->>'managed_business_or_team'='true' THEN 5 ELSE 4 END
 WHEN a.rubric_version='2' THEN a.stars=CASE WHEN a.total>=85 AND NOT a.doubts THEN 5 ELSE 4 END
 ELSE NOT a.doubts AND a.total>=70 AND a.stars=CASE WHEN a.total>=85 THEN 5 ELSE 4 END END,false);
$$;