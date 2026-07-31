
-- ========== 1. Anagrafica comuni completa ==========
ALTER TABLE public.launch_area_comuni
  ADD COLUMN IF NOT EXISTS istat_code text,
  ADD COLUMN IF NOT EXISTS cadastral_code text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TEMP TABLE _istat(nome text, istat text, cat text) ON COMMIT DROP;
INSERT INTO _istat(nome, istat, cat) VALUES
('Alto Reno Terme','037062','M369'),
('Anzola dell''Emilia','037001','A324'),
('Argelato','037002','A392'),
('Baricella','037003','A665'),
('Bentivoglio','037005','A785'),
('Bologna','037006','A944'),
('Borgo Tossignano','037007','B044'),
('Budrio','037008','B249'),
('Calderara di Reno','037009','B399'),
('Camugnano','037010','B572'),
('Casalecchio di Reno','037011','B880'),
('Casalfiumanese','037012','B892'),
('Castel Guelfo di Bologna','037016','C121'),
('Castel Maggiore','037019','C204'),
('Castel San Pietro Terme','037020','C265'),
('Castel d''Aiano','037013','C075'),
('Castel del Rio','037014','C086'),
('Castel di Casio','037015','B969'),
('Castello d''Argile','037017','C185'),
('Castenaso','037021','C292'),
('Castiglione dei Pepoli','037022','C296'),
('Crevalcore','037024','D166'),
('Dozza','037025','D360'),
('Fontanelice','037026','D668'),
('Gaggio Montano','037027','D847'),
('Galliera','037028','D878'),
('Granarolo dell''Emilia','037030','E136'),
('Grizzana Morandi','037031','E187'),
('Imola','037032','E289'),
('Lizzano in Belvedere','037033','A771'),
('Loiano','037034','E655'),
('Malalbergo','037035','E844'),
('Marzabotto','037036','B689'),
('Medicina','037037','F083'),
('Minerbio','037038','F219'),
('Molinella','037039','F288'),
('Monghidoro','037040','F363'),
('Monte San Pietro','037042','F627'),
('Monterenzio','037041','F597'),
('Monzuno','037044','F706'),
('Mordano','037045','F718'),
('Ozzano dell''Emilia','037046','G205'),
('Pianoro','037047','G570'),
('Pieve di Cento','037048','G643'),
('Sala Bolognese','037050','H678'),
('San Benedetto Val di Sambro','037051','G566'),
('San Giorgio di Piano','037052','H896'),
('San Giovanni in Persiceto','037053','G467'),
('San Lazzaro di Savena','037054','H945'),
('San Pietro in Casale','037055','I110'),
('Sant''Agata Bolognese','037056','I191'),
('Sasso Marconi','037057','G972'),
('Valsamoggia','037061','M320'),
('Vergato','037059','L762'),
('Zola Predosa','037060','M185');

UPDATE public.launch_area_comuni c
   SET istat_code = i.istat, cadastral_code = i.cat
  FROM _istat i
 WHERE c.area_code = 'BO'
   AND public.norm_place_name(c.comune) = public.norm_place_name(i.nome);

CREATE UNIQUE INDEX IF NOT EXISTS launch_area_comuni_istat_uidx
  ON public.launch_area_comuni(istat_code) WHERE istat_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS launch_area_comuni_norm_idx
  ON public.launch_area_comuni(public.norm_place_name(comune));

-- ========== 2. Validazione comune/provincia (coerenza combinata) ==========
CREATE OR REPLACE FUNCTION public.is_in_launch_area(_city text, _province text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active boolean;
  city_n text := public.norm_place_name(_city);
  prov_n text := public.norm_place_name(_province);
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.launch_areas WHERE active) INTO has_active;
  IF NOT has_active THEN
    RETURN true;
  END IF;

  IF city_n IS NULL AND prov_n IS NULL THEN
    RETURN true; -- nulla da validare (bozze / record legacy senza località)
  END IF;

  IF city_n IS NOT NULL THEN
    -- Il comune deve appartenere a un'area attiva E, se la provincia è
    -- indicata, deve essere quella dell'area (blocca payload incoerenti).
    RETURN EXISTS (
      SELECT 1
      FROM public.launch_area_comuni c
      JOIN public.launch_areas a ON a.code = c.area_code AND a.active
      WHERE c.active
        AND public.norm_place_name(c.comune) = city_n
        AND (
          prov_n IS NULL
          OR public.norm_place_name(a.province) = prov_n
          OR public.norm_place_name(a.province_code) = prov_n
        )
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.launch_areas a
    WHERE a.active
      AND (public.norm_place_name(a.province) = prov_n
           OR public.norm_place_name(a.province_code) = prov_n)
  );
END;
$$;

-- ========== 3. Validazione coordinate ==========
CREATE OR REPLACE FUNCTION public.are_coords_in_launch_area(_lat double precision, _lng double precision)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.launch_areas WHERE active) INTO has_active;
  IF NOT has_active THEN RETURN true; END IF;

  -- Coordinate assenti: consentite (geocoding fallito / record legacy);
  -- la validazione ricade sul comune normalizzato.
  IF _lat IS NULL AND _lng IS NULL THEN RETURN true; END IF;
  IF _lat IS NULL OR _lng IS NULL THEN RETURN false; END IF;

  -- Valori palesemente non validi.
  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN RETURN false; END IF;
  IF abs(_lat) < 0.0001 AND abs(_lng) < 0.0001 THEN RETURN false; END IF; -- 0,0

  RETURN EXISTS (
    SELECT 1 FROM public.launch_areas a
    WHERE a.active
      AND a.center_lat IS NOT NULL AND a.center_lng IS NOT NULL
      AND sqrt(
            power((_lat - a.center_lat) * 111.0, 2)
          + power((_lng - a.center_lng) * 111.0 * cos(radians(a.center_lat)), 2)
          ) <= coalesce(a.radius_km, 0) + 5   -- +5km di tolleranza sui confini
  );
END;
$$;

-- Validazione combinata: fonte definitiva di verità.
CREATE OR REPLACE FUNCTION public.validate_launch_location(
  _city text, _province text, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_in_launch_area(_city, _province)
     AND public.are_coords_in_launch_area(_lat, _lng);
$$;

GRANT EXECUTE ON FUNCTION public.are_coords_in_launch_area(double precision, double precision) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_launch_location(text, text, double precision, double precision) TO anon, authenticated, service_role;

-- ========== 4. Enforcement scritture ==========
CREATE OR REPLACE FUNCTION public.enforce_launch_area_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.job_city IS NOT DISTINCT FROM OLD.job_city
     AND NEW.job_province IS NOT DISTINCT FROM OLD.job_province
     AND NEW.job_latitude IS NOT DISTINCT FROM OLD.job_latitude
     AND NEW.job_longitude IS NOT DISTINCT FROM OLD.job_longitude
     AND NEW.location_lat IS NOT DISTINCT FROM OLD.location_lat
     AND NEW.location_lng IS NOT DISTINCT FROM OLD.location_lng
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.validate_launch_location(
        NEW.job_city, NEW.job_province,
        coalesce(NEW.job_latitude, NEW.location_lat),
        coalesce(NEW.job_longitude, NEW.location_lng))
     OR NOT public.are_coords_in_launch_area(NEW.location_lat, NEW.location_lng) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_launch_area_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT'
      OR NEW.city IS DISTINCT FROM OLD.city
      OR NEW.province IS DISTINCT FROM OLD.province
      OR NEW.latitude IS DISTINCT FROM OLD.latitude
      OR NEW.longitude IS DISTINCT FROM OLD.longitude)
     AND coalesce(NEW.city, NEW.province) IS NOT NULL
     AND NOT public.validate_launch_location(NEW.city, NEW.province, NEW.latitude, NEW.longitude) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT'
      OR NEW.service_area_city IS DISTINCT FROM OLD.service_area_city
      OR NEW.service_area_lat IS DISTINCT FROM OLD.service_area_lat
      OR NEW.service_area_lng IS DISTINCT FROM OLD.service_area_lng)
     AND coalesce(NEW.service_area_city::text, NEW.service_area_lat::text) IS NOT NULL
     AND NOT public.validate_launch_location(
           NEW.service_area_city, NULL, NEW.service_area_lat, NEW.service_area_lng) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_launch_area_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.city, NEW.province) IS NOT NULL
     AND NOT public.validate_launch_location(NEW.city, NEW.province, NEW.latitude, NEW.longitude) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Sede del turno / richieste di lavoro: finora non protette.
CREATE OR REPLACE FUNCTION public.enforce_launch_area_job_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.city IS NOT DISTINCT FROM OLD.city
     AND NEW.province IS NOT DISTINCT FROM OLD.province
     AND NEW.latitude IS NOT DISTINCT FROM OLD.latitude
     AND NEW.longitude IS NOT DISTINCT FROM OLD.longitude
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.city, NEW.province) IS NOT NULL
     AND NOT public.validate_launch_location(NEW.city, NEW.province, NEW.latitude, NEW.longitude) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_launch_area_job_request ON public.job_requests;
CREATE TRIGGER trg_enforce_launch_area_job_request
  BEFORE INSERT OR UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_launch_area_job_request();

-- ========== 5. Letture: esclusione lavoratori fuori area ==========
CREATE OR REPLACE FUNCTION public.list_worker_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS user_id
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id
  HAVING (
      bool_or(ur.role = 'worker')
      OR lower(coalesce(p.primary_role, '')) = 'worker'
    )
    AND NOT bool_or(coalesce(ur.role::text, '') IN ('admin', 'restaurant'))
    AND lower(coalesce(p.primary_role, '')) NOT IN ('admin', 'restaurant', 'ristoratore')
    AND coalesce(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND coalesce(p.account_status::text, 'active') = 'active'
    AND coalesce(p.profile_completed, false) = true
    AND coalesce(p.is_demo, false) = false
    AND p.seed_batch_id IS NULL
    AND coalesce(bool_or(p.moderation_hidden), false) = false
    AND public.is_in_launch_area(coalesce(p.service_area_city, p.city), p.province);
$$;

-- Vista pubblica profili: indicatore "in area attiva".
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
 SELECT id, full_name, first_name, last_name, business_name, avatar_url,
    primary_role, secondary_roles, venue_type, venue_type_other,
    professional_profile, city, neighborhood, province, province_code,
    service_area_city, service_area_district, service_area_radius_m,
    selected_zones, all_zones, work_area_mode, languages, spoken_languages,
    experience_years, experience_level, is_motorized, hourly_rate,
    weekly_availability, hourly_availability, price_range, employees_count,
    opening_hours, busy_days, badge, rating_avg, reviews_count,
    reputation_score, reputation_level, reliability_pct, punctuality_pct,
    completion_pct, completed_shifts, no_show_count, avg_punctuality,
    avg_professionalism, avg_competence, avg_reliability, avg_teamwork,
    rehire_restaurants_count, rehire_yes_count, rehire_total_answers,
    distinct_restaurants_count, age, available_now_until, phone_verified,
    profile_completed, default_arrival_advance_minutes,
    default_arrival_advance_reason, is_deleted,
    round(COALESCE(service_area_lat, latitude)::numeric, 2)::double precision AS approx_lat,
    round(COALESCE(service_area_lng, longitude)::numeric, 2)::double precision AS approx_lng,
    default_dress_code_items, default_dress_code_notes, default_required_skills,
    default_language_requirements, default_license_requirement,
    public.is_in_launch_area(COALESCE(service_area_city, city), province) AS in_launch_area
   FROM profiles p
  WHERE is_deleted = false AND moderation_hidden = false AND account_status = 'active'::account_status;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ========== 6. Amministrazione: statistiche + audit ==========
CREATE OR REPLACE FUNCTION public.admin_launch_area_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'profiles_in_area', (SELECT count(*) FROM profiles WHERE coalesce(is_deleted,false)=false AND city IS NOT NULL AND is_in_launch_area(city, province)),
    'profiles_out_of_area', (SELECT count(*) FROM profiles WHERE coalesce(is_deleted,false)=false AND city IS NOT NULL AND NOT is_in_launch_area(city, province)),
    'profiles_missing_city', (SELECT count(*) FROM profiles WHERE coalesce(is_deleted,false)=false AND city IS NULL),
    'announcements_in_area', (SELECT count(*) FROM announcements WHERE is_in_launch_area(job_city, job_province)),
    'announcements_out_of_area', (SELECT count(*) FROM announcements WHERE NOT is_in_launch_area(job_city, job_province)),
    'announcements_missing_coords', (SELECT count(*) FROM announcements WHERE job_latitude IS NULL OR job_longitude IS NULL),
    'job_requests_out_of_area', (SELECT count(*) FROM job_requests WHERE city IS NOT NULL AND NOT is_in_launch_area(city, province)),
    'availability_out_of_area', (SELECT count(*) FROM worker_availability WHERE city IS NOT NULL AND NOT is_in_launch_area(city, province)),
    'availability_exceptions_out_of_area', (SELECT count(*) FROM worker_availability_exceptions WHERE city IS NOT NULL AND NOT is_in_launch_area(city, province))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_launch_area_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_launch_area_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_launch_area_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log(actor, action, metadata)
  VALUES (
    coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'launch_area.' || lower(TG_OP) || '.' || TG_TABLE_NAME,
    jsonb_build_object(
      'old', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
      'new', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_launch_areas ON public.launch_areas;
CREATE TRIGGER trg_audit_launch_areas
  AFTER INSERT OR UPDATE OR DELETE ON public.launch_areas
  FOR EACH ROW EXECUTE FUNCTION public.audit_launch_area_change();

DROP TRIGGER IF EXISTS trg_audit_launch_area_comuni ON public.launch_area_comuni;
CREATE TRIGGER trg_audit_launch_area_comuni
  AFTER INSERT OR UPDATE OR DELETE ON public.launch_area_comuni
  FOR EACH ROW EXECUTE FUNCTION public.audit_launch_area_change();
