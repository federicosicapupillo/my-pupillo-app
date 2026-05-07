import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

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
};

type Ctx = {
  user: User | null;
  session: Session | null;
  role: Role | null;
  profile: Profile | null;
  loading: boolean;
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

  const loadExtras = async (uid: string) => {
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    const r = roles?.[0]?.role as Role | undefined;
    setRole(r ?? null);
    setProfile((prof as Profile) ?? null);
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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}