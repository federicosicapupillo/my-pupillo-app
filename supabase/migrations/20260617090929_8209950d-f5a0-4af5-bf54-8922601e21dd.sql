-- =========================================================================
-- Tighten column-level SELECT on profiles to hide PII from cross-user reads
-- =========================================================================
REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT (
  id, email,
  full_name, first_name, last_name, business_name, avatar_url,
  city, neighborhood, province, country, primary_role, badge,
  short_bio, professional_profile, languages, spoken_languages,
  rating_avg, reviews_count, reputation_score, reputation_level,
  reputation_updated_at, completed_shifts, no_show_count,
  punctuality_pct, completion_pct, avg_response_minutes,
  avg_punctuality, avg_professionalism, avg_competence,
  avg_reliability, avg_teamwork, rehire_restaurants_count,
  rehire_yes_count, rehire_total_answers, distinct_restaurants_count,
  experience_years, experience_level, hourly_rate, is_motorized,
  secondary_roles, weekly_availability, hourly_availability,
  busy_days, opening_hours, employees_count, venue_type,
  venue_type_other, price_range, plan, profile_completed,
  phone_verified, phone_verified_at, account_status, is_deleted, deleted_at,
  service_area_city, service_area_district, service_area_lat,
  service_area_lng, service_area_radius_m, selected_zones, all_zones,
  work_area_mode, default_arrival_advance_minutes,
  default_arrival_advance_reason, available_now_until,
  last_active_at, is_demo, seed_batch_id, latitude, longitude,
  province_code, city_code,
  created_at, updated_at, terms_accepted, whatsapp_connected,
  phone, phone_full, phone_number, phone_country_code,
  contact_person_first_name, contact_person_last_name,
  contact_person_phone, contact_person_email,
  contact_person_role, contact_person_role_other,
  default_contact_person_name,
  vat_number, vat_company_name, vat_status, vat_verified_at,
  address, street, street_number, postal_code,
  access_restrictions, additional_directions, location_notes,
  registered_office_address, registered_office_city,
  registered_office_province, registered_office_postal_code,
  business_status,
  default_license_requirement, default_language_requirements,
  default_tattoos_allowed, default_piercings_allowed,
  default_beard_allowed, default_required_skills,
  default_dress_code_items, default_dress_code_notes,
  default_settings_updated_at,
  age, age_verified, age_verified_at, representative_age,
  no_shows, reliability_pct, delay_count, cancellation_count,
  clean_shifts_after_penalty, search_penalty_active,
  search_penalty_started_at, search_penalty_until,
  whatsapp_confirmation_sent_at, whatsapp_confirmation_status,
  email_summary_sent_at, email_summary_status,
  last_review_at, review_blocked, review_blocked_at,
  overdue_reviews_count, last_review_reminder_at,
  referral_code, referred_by_user_id, referral_credits_earned,
  credits, company_tax_code
) ON public.profiles TO authenticated;

-- anon keeps no SELECT on profiles (RLS would still gate, but defense in depth).
GRANT ALL ON public.profiles TO service_role;

-- Denied to authenticated (own-only via public.get_my_profile() RPC, admin via service_role):
--   tax_code, id_document_path, id_document_back_path, id_document_number,
--   id_document_type, id_document_issued_at, id_document_expires_at,
--   id_document_issuer, stripe_customer_id, pec_email, sdi_code,
--   birth_date, birth_place, nationality,
--   residence_address, residence_city, residence_postal_code,
--   residence_province, residence_street, residence_number,
--   search_penalty_reason, deletion_reason

-- =========================================================================
-- Tighten column-level SELECT on announcements: contact person fields are
-- only readable via public.get_announcement_contact(_announcement_id uuid)
-- which restricts to owning restaurant / assigned worker / accepted application.
-- =========================================================================
REVOKE SELECT ON public.announcements FROM authenticated, anon;

GRANT SELECT (
  id, restaurant_id, service_date, service_time, end_time, end_date,
  duration_hours, shift_duration_hours, is_long_shift, long_shift_reason,
  speed, tariff_type, tariff_amount, location_address, location_lat, location_lng,
  deposit_paid, expires_at, status, assigned_worker_id, created_at, notes,
  license_requirement, language_requirements, tattoos_allowed, piercings_allowed,
  beard_allowed, required_skills, dress_code_items, dress_code_notes,
  job_address, job_city, job_province, job_postal_code, job_country,
  job_latitude, job_longitude, job_access_restrictions, job_additional_directions,
  job_location_notes,
  cancelled_at, cancellation_note, cancellation_reason, cancelled_by,
  reopened_at, reopened_after_worker_cancellation,
  reused_from_announcement_id, languages, professional_profile,
  seed_batch_id, is_demo
) ON public.announcements TO authenticated;

GRANT ALL ON public.announcements TO service_role;
-- Denied to authenticated/anon:
--   job_contact_person_name, job_contact_person_phone, job_contact_person_email
-- (read via SECURITY DEFINER public.get_announcement_contact(uuid)).