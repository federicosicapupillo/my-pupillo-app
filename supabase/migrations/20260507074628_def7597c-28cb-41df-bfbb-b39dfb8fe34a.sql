
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'restaurant', 'worker');
CREATE TYPE public.announcement_status AS ENUM ('draft','active','expired','assigned','cancelled');
CREATE TYPE public.application_status AS ENUM ('pending','interested','not_interested','counter_offer','accepted','rejected','expired');
CREATE TYPE public.service_speed AS ENUM ('normal','fast','flash');
CREATE TYPE public.tariff_type AS ENUM ('hourly','flat');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  age INT,
  languages TEXT[] DEFAULT '{}',
  professional_profile TEXT,
  whatsapp_connected BOOLEAN DEFAULT false,
  -- restaurant fields
  business_name TEXT,
  vat_number TEXT,
  venue_type TEXT,
  address TEXT,
  price_range TEXT,
  -- worker fields
  service_area_lat DOUBLE PRECISION,
  service_area_lng DOUBLE PRECISION,
  service_area_radius_m INT DEFAULT 500,
  terms_accepted BOOLEAN DEFAULT false,
  profile_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'restaurant' THEN 2 WHEN 'worker' THEN 3 END
  LIMIT 1;
$$;

-- ANNOUNCEMENTS (offerte di lavoro)
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_time TIME NOT NULL,
  duration_hours NUMERIC NOT NULL DEFAULT 4,
  speed public.service_speed NOT NULL DEFAULT 'normal',
  tariff_type public.tariff_type NOT NULL DEFAULT 'hourly',
  tariff_amount NUMERIC NOT NULL,
  location_address TEXT NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  professional_profile TEXT,
  languages TEXT[] DEFAULT '{}',
  deposit_paid BOOLEAN DEFAULT false,
  status public.announcement_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  assigned_worker_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- APPLICATIONS / CHAT THREADS
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'pending',
  proposed_tariff NUMERIC,
  worker_response_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  binding_offer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, worker_id)
);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIGGER: auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'worker'));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Profiles viewable by all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- USER_ROLES policies
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ANNOUNCEMENTS policies
CREATE POLICY "Announcements viewable by authenticated" ON public.announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Restaurants create own announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = restaurant_id AND public.has_role(auth.uid(),'restaurant'));
CREATE POLICY "Restaurants update own announcements" ON public.announcements
  FOR UPDATE TO authenticated USING (auth.uid() = restaurant_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Restaurants delete own announcements" ON public.announcements
  FOR DELETE TO authenticated USING (auth.uid() = restaurant_id OR public.has_role(auth.uid(),'admin'));

-- APPLICATIONS policies
CREATE POLICY "Applications viewable by parties" ON public.applications
  FOR SELECT TO authenticated USING (
    auth.uid() = worker_id OR auth.uid() = restaurant_id OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "Restaurants create applications" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = restaurant_id);
CREATE POLICY "Parties update applications" ON public.applications
  FOR UPDATE TO authenticated USING (
    auth.uid() = worker_id OR auth.uid() = restaurant_id OR public.has_role(auth.uid(),'admin')
  );

-- MESSAGES policies
CREATE POLICY "Messages viewable by app parties" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "Send messages in own threads" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.applications a WHERE a.id = application_id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid())
    )
  );

-- NOTIFICATIONS policies
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- ACTIVITY_LOGS policies
CREATE POLICY "Admins view logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone log own activity" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
