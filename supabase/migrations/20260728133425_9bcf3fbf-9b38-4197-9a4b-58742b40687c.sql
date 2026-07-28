-- FASE 3 / migration 1: vista public.public_profiles
-- Rollback: DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true, security_invoker = true) AS
SELECT
  p.id,
  p.full_name,
  p.first_name,
  p.last_name,
  p.business_name,
  p.avatar_url,
  p.primary_role,
  p.secondary_roles,
  p.venue_type,
  p.venue_type_other,
  p.professional_profile,
  p.city,
  p.neighborhood,
  p.province,
  p.province_code,
  p.service_area_city,
  p.service_area_district,
  p.service_area_radius_m,
  p.selected_zones,
  p.all_zones,
  p.work_area_mode,
  p.languages,
  p.spoken_languages,
  p.experience_years,
  p.experience_level,
  p.is_motorized,
  p.hourly_rate,
  p.weekly_availability,
  p.hourly_availability,
  p.price_range,
  p.employees_count,
  p.opening_hours,
  p.busy_days,
  p.badge,
  p.rating_avg,
  p.reviews_count,
  p.reputation_score,
  p.reputation_level,
  p.reliability_pct,
  p.punctuality_pct,
  p.completion_pct,
  p.completed_shifts,
  p.no_show_count,
  p.avg_punctuality,
  p.avg_professionalism,
  p.avg_competence,
  p.avg_reliability,
  p.avg_teamwork,
  p.rehire_restaurants_count,
  p.rehire_yes_count,
  p.rehire_total_answers,
  p.distinct_restaurants_count,
  p.age,
  p.available_now_until,
  p.phone_verified,
  p.profile_completed,
  p.default_arrival_advance_minutes,
  p.default_arrival_advance_reason,
  p.is_deleted
FROM public.profiles p
WHERE p.is_deleted = false
  AND p.moderation_hidden = false
  AND p.account_status = 'active';

COMMENT ON VIEW public.public_profiles IS
  'Fase 3: superficie pubblica di profiles. Solo colonne vetrina, filtra utenti eliminati/nascosti/non attivi. Nessun dato di contatto, documento o amministrativo.';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO service_role;