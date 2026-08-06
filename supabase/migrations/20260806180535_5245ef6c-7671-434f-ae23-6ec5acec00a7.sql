CREATE OR REPLACE FUNCTION public.get_restaurant_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_active int := 0;
  v_assigned int := 0;
  v_pending int := 0;
  v_reviews int := 0;
  v_avg numeric := NULL;
  v_completed int := 0;
  v_total_shifts int := 0;
  v_cancelled_shifts int := 0;
  v_top_tag text := NULL;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.announcements a
  WHERE a.restaurant_id = uid AND a.status = 'active';

  SELECT count(*) INTO v_assigned
  FROM public.announcements a
  WHERE a.restaurant_id = uid AND a.status = 'assigned';

  -- Candidatura "da valutare": spontanea del lavoratore, del ristoratore
  -- autenticato, su annuncio ancora aperto/candidabile, in uno stato che
  -- richiede davvero una decisione, e senza alcun turno gia' creato
  -- (scheduled/completed/cancelled/no_show) per quella coppia annuncio+worker.
  SELECT count(*) INTO v_pending
  FROM public.applications ap
  JOIN public.announcements an ON an.id = ap.announcement_id
  WHERE ap.restaurant_id = uid
    AND ap.origin = 'worker_application'
    AND ap.status IN ('pending', 'interested', 'counter_offer')
    AND an.status = 'active'
    AND public.announcement_is_open(an.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.announcement_id = ap.announcement_id
        AND s.worker_id = ap.worker_id
    );

  -- Recensioni ricevute dal ristoratore (autore = lavoratore) e gia' sbloccate
  -- dalla regola blind reciprocal.
  SELECT count(*), avg(r.rating)
    INTO v_reviews, v_avg
  FROM public.reviews r
  WHERE r.target_id = uid
    AND r.direction = 'worker_to_restaurant'
    AND r.visible_at IS NOT NULL
    AND r.is_visible_to_restaurants IS TRUE
    AND r.rating IS NOT NULL
    AND r.rating > 0;

  SELECT
    count(DISTINCT s.id) FILTER (WHERE s.status = 'completed'),
    count(DISTINCT s.id),
    count(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled')
    INTO v_completed, v_total_shifts, v_cancelled_shifts
  FROM public.shifts s
  WHERE s.restaurant_id = uid;

  SELECT t.tag INTO v_top_tag
  FROM public.reviews r
  CROSS JOIN LATERAL unnest(coalesce(r.positive_tags, '{}'::text[])) AS t(tag)
  WHERE r.target_id = uid
    AND r.direction = 'worker_to_restaurant'
    AND r.visible_at IS NOT NULL
    AND r.is_visible_to_restaurants IS TRUE
    AND t.tag IS NOT NULL
    AND length(btrim(t.tag)) > 0
  GROUP BY t.tag
  ORDER BY count(*) DESC, t.tag ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'activeAnnouncementsCount', v_active,
    'assignedAnnouncementsCount', v_assigned,
    'pendingWorkerApplicationsCount', v_pending,
    'receivedVisibleReviewsCount', coalesce(v_reviews, 0),
    'averageReceivedRating', CASE WHEN coalesce(v_reviews, 0) > 0 THEN round(v_avg, 2) ELSE NULL END,
    'completedDistinctShiftsCount', coalesce(v_completed, 0),
    'totalShiftsCount', coalesce(v_total_shifts, 0),
    'cancelledShiftsCount', coalesce(v_cancelled_shifts, 0),
    'topPositiveTag', v_top_tag
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_dashboard_stats() TO authenticated;