
-- Enums
CREATE TYPE public.worker_badge AS ENUM ('basic','pro','elite');
CREATE TYPE public.account_status AS ENUM ('active','pending','suspended');
CREATE TYPE public.user_plan AS ENUM ('free','credits','premium');
CREATE TYPE public.experience_level AS ENUM ('junior','intermediate','senior');
CREATE TYPE public.shift_status AS ENUM ('scheduled','completed','no_show','cancelled');

-- Profiles extension
ALTER TABLE public.profiles
  ADD COLUMN city text,
  ADD COLUMN neighborhood text,
  ADD COLUMN account_status public.account_status DEFAULT 'active',
  ADD COLUMN plan public.user_plan DEFAULT 'free',
  ADD COLUMN credits integer DEFAULT 0,
  ADD COLUMN last_active_at timestamptz DEFAULT now(),
  ADD COLUMN rating_avg numeric(3,2) DEFAULT 0,
  ADD COLUMN reviews_count integer DEFAULT 0,
  -- worker fields
  ADD COLUMN primary_role text,
  ADD COLUMN secondary_roles text[] DEFAULT '{}',
  ADD COLUMN experience_years integer,
  ADD COLUMN experience_level public.experience_level,
  ADD COLUMN hourly_rate numeric(6,2),
  ADD COLUMN is_motorized boolean DEFAULT false,
  ADD COLUMN short_bio text,
  ADD COLUMN badge public.worker_badge DEFAULT 'basic',
  ADD COLUMN completed_shifts integer DEFAULT 0,
  ADD COLUMN no_shows integer DEFAULT 0,
  ADD COLUMN reliability_pct integer DEFAULT 100,
  ADD COLUMN weekly_availability text[] DEFAULT '{}',
  ADD COLUMN hourly_availability text,
  -- restaurant fields
  ADD COLUMN employees_count integer,
  ADD COLUMN busy_days text[] DEFAULT '{}',
  ADD COLUMN opening_hours text;

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  target_id uuid NOT NULL,
  shift_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by authenticated" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE INDEX idx_reviews_target ON public.reviews(target_id);

-- Shifts
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid,
  restaurant_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  shift_date date NOT NULL,
  hours numeric(4,1) NOT NULL DEFAULT 4,
  amount numeric(8,2),
  status public.shift_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shifts viewable by parties" ON public.shifts FOR SELECT TO authenticated
  USING (worker_id = auth.uid() OR restaurant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Restaurants create shifts" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Parties update shifts" ON public.shifts FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() OR restaurant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_shifts_worker ON public.shifts(worker_id);
CREATE INDEX idx_shifts_restaurant ON public.shifts(restaurant_id);
