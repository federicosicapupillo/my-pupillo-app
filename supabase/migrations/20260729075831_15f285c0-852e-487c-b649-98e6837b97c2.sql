-- 1) Restrict internal recompute helpers: no PUBLIC/anon/authenticated EXECUTE.
--    Call sites (documented): SECURITY DEFINER triggers (handle_new_review,
--    trg_recompute_reputation_review/_shift/_incident, trg_recompute_penalty_incident,
--    required_reviews_recompute_after_change, trg_clean_shift_after_penalty),
--    recompute_worker_penalty -> recompute_worker_reputation, and the
--    service-role demo seeder (src/lib/demo-seed.server.ts). No client call sites.
REVOKE ALL ON FUNCTION public.recompute_worker_reputation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_worker_penalty(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_review_block(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_worker_reputation(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_worker_penalty(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_review_block(uuid) TO postgres, service_role;

-- 2) Extend public_profiles with non-sensitive columns only.
--    approx_lat/approx_lng are rounded to 2 decimals (~1.1 km) so the public
--    surface never carries a precise home/venue location.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
  SELECT id,
    full_name,
    first_name,
    last_name,
    business_name,
    avatar_url,
    primary_role,
    secondary_roles,
    venue_type,
    venue_type_other,
    professional_profile,
    city,
    neighborhood,
    province,
    province_code,
    service_area_city,
    service_area_district,
    service_area_radius_m,
    selected_zones,
    all_zones,
    work_area_mode,
    languages,
    spoken_languages,
    experience_years,
    experience_level,
    is_motorized,
    hourly_rate,
    weekly_availability,
    hourly_availability,
    price_range,
    employees_count,
    opening_hours,
    busy_days,
    badge,
    rating_avg,
    reviews_count,
    reputation_score,
    reputation_level,
    reliability_pct,
    punctuality_pct,
    completion_pct,
    completed_shifts,
    no_show_count,
    avg_punctuality,
    avg_professionalism,
    avg_competence,
    avg_reliability,
    avg_teamwork,
    rehire_restaurants_count,
    rehire_yes_count,
    rehire_total_answers,
    distinct_restaurants_count,
    age,
    available_now_until,
    phone_verified,
    profile_completed,
    default_arrival_advance_minutes,
    default_arrival_advance_reason,
    is_deleted,
    round(COALESCE(service_area_lat, latitude)::numeric, 2)::double precision AS approx_lat,
    round(COALESCE(service_area_lng, longitude)::numeric, 2)::double precision AS approx_lng,
    default_dress_code_items,
    default_dress_code_notes,
    default_required_skills,
    default_language_requirements,
    default_license_requirement
   FROM public.profiles p
  WHERE is_deleted = false AND moderation_hidden = false AND account_status = 'active'::account_status;

GRANT SELECT ON public.public_profiles TO authenticated, service_role;