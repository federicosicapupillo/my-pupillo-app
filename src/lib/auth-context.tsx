import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { applyTheme, persistTheme, readUserTheme } from "@/lib/theme";
import { clearKnownRestaurantsCache } from "@/lib/known-restaurants-cache";

type Role = "admin" | "restaurant" | "worker";
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  profile_completed: boolean;
  whatsapp_connected: boolean;
  vat_number: string | null;
  phone: string | null;
  age: number | null;
  professional_profile: string | null;
  languages: string[] | null;
  address: string | null;
  venue_type: string | null;
  price_range: string | null;
  terms_accepted: boolean;
  service_area_radius_m: number | null;
  service_area_lat: number | null;
  service_area_lng: number | null;
  vat_status: "pending" | "valid" | "invalid" | "error" | null;
  vat_company_name: string | null;
  vat_verified_at: string | null;
  plan: string | null;
  credits: number | null;
  rating_avg: number | null;
  reviews_count: number | null;
  reliability_pct: number | null;
  city: string | null;
  province: string | null;
  country: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  access_restrictions: string | null;
  additional_directions: string | null;
  location_notes: string | null;
  contact_person_first_name: string | null;
  contact_person_last_name: string | null;
  contact_person_role: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
  phone_full: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  whatsapp_confirmation_sent_at: string | null;
  whatsapp_confirmation_status: string | null;
  email_summary_sent_at: string | null;
  email_summary_status: string | null;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  role: Role | null;
  profile: Profile | null;
  loading: boolean;
  extrasLoaded: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [extrasLoaded, setExtrasLoaded] = useState(false);

  const loadExtras = async (uid: string) => {
    setExtrasLoaded(false);
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    const allRoles = (roles ?? []).map((x: { role: Role }) => x.role);
    const r: Role | undefined =
      allRoles.includes("admin") ? "admin"
      : allRoles.includes("restaurant") ? "restaurant"
      : allRoles.includes("worker") ? "worker"
      : undefined;
    setRole(r ?? null);
    setProfile((prof as Profile) ?? null);
    // Apply per-user theme preference. Default restaurants to light.
    const saved = readUserTheme(uid);
    if (saved) {
      applyTheme(saved);
    } else if (r === "restaurant") {
      applyTheme("light");
      persistTheme("light", uid);
    }
    setExtrasLoaded(true);
  };

  const refresh = async () => {
    if (user) await loadExtras(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadExtras(s.user.id), 0);
      } else {
        setRole(null);
        setProfile(null);
        setExtrasLoaded(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadExtras(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    clearKnownRestaurantsCache();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      // Hard redirect to public Home, replacing history so back button
      // cannot return to protected pages after logout.
      window.location.replace("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, extrasLoaded, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}