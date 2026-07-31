-- =========================================================
-- Aree di lancio territoriali (Bologna e Città metropolitana)
-- =========================================================

CREATE TABLE public.launch_areas (
  code text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  province text NOT NULL,
  province_code text NOT NULL,
  center_lat double precision,
  center_lng double precision,
  radius_km numeric,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.launch_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.launch_areas TO authenticated;
GRANT ALL ON public.launch_areas TO service_role;
ALTER TABLE public.launch_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "launch_areas_read_all" ON public.launch_areas
  FOR SELECT USING (true);
CREATE POLICY "launch_areas_admin_write" ON public.launch_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.launch_area_comuni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_code text NOT NULL REFERENCES public.launch_areas(code) ON DELETE CASCADE,
  comune text NOT NULL,
  caps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_code, comune)
);

GRANT SELECT ON public.launch_area_comuni TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.launch_area_comuni TO authenticated;
GRANT ALL ON public.launch_area_comuni TO service_role;
ALTER TABLE public.launch_area_comuni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "launch_area_comuni_read_all" ON public.launch_area_comuni
  FOR SELECT USING (true);
CREATE POLICY "launch_area_comuni_admin_write" ON public.launch_area_comuni
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_launch_areas_updated_at BEFORE UPDATE ON public.launch_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_launch_area_comuni_updated_at BEFORE UPDATE ON public.launch_area_comuni
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- Normalizzazione nome comune (case/accento/apostrofo insensitive)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_place_name(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(
    regexp_replace(
      translate(
        lower(btrim(coalesce(_v, ''))),
        'àáâãäèéêëìíîïòóôõöùúûüçñ''`’-',
        'aaaaaeeeeiiiiooooouuuucn    '
      ),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;

-- ---------------------------------------------------------
-- Verifica appartenenza all'area di lancio attiva
-- ---------------------------------------------------------
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
  -- Nessuna area attiva => nessuna restrizione territoriale.
  IF NOT has_active THEN
    RETURN true;
  END IF;

  IF city_n IS NULL AND prov_n IS NULL THEN
    RETURN true; -- nulla da validare (bozze / record senza località)
  END IF;

  IF city_n IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.launch_area_comuni c
      JOIN public.launch_areas a ON a.code = c.area_code AND a.active
      WHERE public.norm_place_name(c.comune) = city_n
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

GRANT EXECUTE ON FUNCTION public.norm_place_name(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_in_launch_area(text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------
-- Seed: Bologna – Città metropolitana di Bologna (unica area attiva)
-- ---------------------------------------------------------
INSERT INTO public.launch_areas (code, name, region, province, province_code, center_lat, center_lng, radius_km, active)
VALUES ('BO', 'Città metropolitana di Bologna', 'Emilia-Romagna', 'Bologna', 'BO', 44.4949, 11.3426, 60, true);

INSERT INTO public.launch_area_comuni (area_code, comune, caps) VALUES
('BO','Alto Reno Terme','{40046}'),
('BO','Anzola dell''Emilia','{40011}'),
('BO','Argelato','{40050}'),
('BO','Baricella','{40052}'),
('BO','Bentivoglio','{40010}'),
('BO','Bologna','{40121,40122,40123,40124,40125,40126,40127,40128,40129,40131,40132,40133,40134,40135,40136,40137,40138,40139,40141}'),
('BO','Borgo Tossignano','{40021}'),
('BO','Budrio','{40054}'),
('BO','Calderara di Reno','{40012}'),
('BO','Camugnano','{40032}'),
('BO','Casalecchio di Reno','{40033}'),
('BO','Casalfiumanese','{40020}'),
('BO','Castel d''Aiano','{40034}'),
('BO','Castel del Rio','{40022}'),
('BO','Castel di Casio','{40030}'),
('BO','Castel Guelfo di Bologna','{40023}'),
('BO','Castel Maggiore','{40013}'),
('BO','Castel San Pietro Terme','{40024}'),
('BO','Castello d''Argile','{40050}'),
('BO','Castenaso','{40055}'),
('BO','Castiglione dei Pepoli','{40035}'),
('BO','Crevalcore','{40014}'),
('BO','Dozza','{40060}'),
('BO','Fontanelice','{40025}'),
('BO','Gaggio Montano','{40041}'),
('BO','Galliera','{40015}'),
('BO','Granarolo dell''Emilia','{40057}'),
('BO','Grizzana Morandi','{40030}'),
('BO','Imola','{40026}'),
('BO','Lizzano in Belvedere','{40042}'),
('BO','Loiano','{40050}'),
('BO','Malalbergo','{40051}'),
('BO','Marzabotto','{40043}'),
('BO','Medicina','{40059}'),
('BO','Minerbio','{40061}'),
('BO','Molinella','{40062}'),
('BO','Monghidoro','{40063}'),
('BO','Monte San Pietro','{40050}'),
('BO','Monterenzio','{40050}'),
('BO','Monzuno','{40036}'),
('BO','Mordano','{40027}'),
('BO','Ozzano dell''Emilia','{40064}'),
('BO','Pianoro','{40065}'),
('BO','Pieve di Cento','{40066}'),
('BO','Sala Bolognese','{40010}'),
('BO','San Benedetto Val di Sambro','{40048}'),
('BO','San Giorgio di Piano','{40016}'),
('BO','San Giovanni in Persiceto','{40017}'),
('BO','San Lazzaro di Savena','{40068}'),
('BO','San Pietro in Casale','{40018}'),
('BO','Sant''Agata Bolognese','{40019}'),
('BO','Sasso Marconi','{40037}'),
('BO','Valsamoggia','{40053}'),
('BO','Vergato','{40038}'),
('BO','Zola Predosa','{40069}');

-- ---------------------------------------------------------
-- Enforcement: annunci
-- ---------------------------------------------------------
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
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_in_launch_area(NEW.job_city, NEW.job_province) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_launch_area_announcement ON public.announcements;
CREATE TRIGGER trg_enforce_launch_area_announcement
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_launch_area_announcement();

-- ---------------------------------------------------------
-- Enforcement: sede ristoratore / area di servizio lavoratore (profiles)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_launch_area_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.city IS DISTINCT FROM OLD.city OR NEW.province IS DISTINCT FROM OLD.province)
     AND coalesce(NEW.city, NEW.province) IS NOT NULL
     AND NOT public.is_in_launch_area(NEW.city, NEW.province) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.service_area_city IS DISTINCT FROM OLD.service_area_city)
     AND NEW.service_area_city IS NOT NULL
     AND NOT public.is_in_launch_area(NEW.service_area_city, NULL) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_launch_area_profile ON public.profiles;
CREATE TRIGGER trg_enforce_launch_area_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_launch_area_profile();

-- ---------------------------------------------------------
-- Enforcement: disponibilità lavoratore
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_launch_area_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.city IS NOT NULL AND NOT public.is_in_launch_area(NEW.city, NEW.province) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_launch_area_availability ON public.worker_availability;
CREATE TRIGGER trg_enforce_launch_area_availability
  BEFORE INSERT OR UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.enforce_launch_area_availability();

DROP TRIGGER IF EXISTS trg_enforce_launch_area_availability_exc ON public.worker_availability_exceptions;
CREATE TRIGGER trg_enforce_launch_area_availability_exc
  BEFORE INSERT OR UPDATE ON public.worker_availability_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_launch_area_availability();

-- ---------------------------------------------------------
-- Gli annunci fuori area non sono più visibili agli utenti
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW public.announcements_public AS
 SELECT id, restaurant_id, service_date, service_time, end_time, end_date,
    duration_hours, speed, tariff_type, tariff_amount, location_address,
    location_lat, location_lng, professional_profile, languages, deposit_paid,
    status, expires_at, assigned_worker_id, created_at, notes,
    license_requirement, language_requirements, tattoos_allowed,
    piercings_allowed, beard_allowed, required_skills, dress_code_items,
    dress_code_notes, job_city, job_province, job_postal_code, job_country,
    seed_batch_id, is_demo, reused_from_announcement_id, long_shift_reason,
    is_long_shift, shift_duration_hours, job_location_notes
   FROM announcements
  WHERE public.is_in_launch_area(job_city, job_province);