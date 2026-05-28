import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { applyTheme, persistTheme, readUserTheme } from "@/lib/theme";
import { clearKnownRestaurantsCache } from "@/lib/known-restaurants-cache";

export const DELETED_ACCOUNT_MESSAGE = "Questo account è stato eliminato e non può più essere utilizzato.";

type Role = "admin" | "restaurant" | "worker";
type Profile = {
  id: string;
  primary_role?: string | null;
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
  is_deleted: boolean | null;
  deleted_at: string | null;
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
  roleDebug: RoleDebug | null;
  loading: boolean;
  extrasLoaded: boolean;
  refresh: () => Promise<void>;
  signOut: (options?: { redirectTo?: string | false }) => Promise<void>;
};

export type RoleDebug = {
  user_id: string | null;
  email: string | null;
  profile_role: string | null;
  user_role: string | null;
  metadata_role: string | null;
  user_roles_rows: string[];
  profile_error: string | null;
  user_roles_error: string | null;
  rpc_error: string | null;
  final_role: Role | null;
  final_route: string;
};

export function normalizeAccountRole(value: string | null | undefined): Role | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "restaurant" || normalized === "ristoratore") return "restaurant";
  if (normalized === "worker" || normalized === "lavoratore") return "worker";
  return null;
}

export function routeForRole(role: Role | null): string {
  if (role === "admin") return "/admin";
  if (role === "restaurant") return "/dashboard";
  if (role === "worker") return "/jobs";
  return "/account-error";
}

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roleDebug, setRoleDebug] = useState<RoleDebug | null>(null);
  const [loading, setLoading] = useState(true);
  const [extrasLoaded, setExtrasLoaded] = useState(false);

  const blockDeletedAccount = async (uid: string) => {
    console.info("[auth] deleted account login blocked", { userId: uid });
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pupillo-auth-message", DELETED_ACCOUNT_MESSAGE);
      }
      clearKnownRestaurantsCache();
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setRole(null);
      setProfile(null);
      setRoleDebug(null);
      setExtrasLoaded(false);
      setLoading(false);
      if (typeof window !== "undefined") {
        window.location.replace("/auth?deleted=1");
      }
    }
  };

  const loadExtras = async (uid: string) => {
    setExtrasLoaded(false);
    const [{ data: roles, error: rolesError }, { data: prof, error: profileError }, { data: resolvedRows, error: rpcError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      // Use a SECURITY DEFINER RPC so the owner can read their own sensitive
      // PII columns (email, phone, tax code, document fields, etc.). Direct
      // SELECT on those columns is revoked for the `authenticated` role.
      supabase.rpc("get_my_profile").maybeSingle(),
      supabase.rpc("resolve_current_user_role"),
    ]);
    if (rolesError) console.error("[auth] role load failed", rolesError);
    if (profileError) console.error("[auth] profile load failed", profileError);
    if (rpcError) console.error("[auth] role resolver RPC failed", rpcError);
    const loadedProfile = (prof as unknown as Profile) ?? null;
    if (loadedProfile?.is_deleted || loadedProfile?.deleted_at) {
      await blockDeletedAccount(uid);
      return;
    }
    const allRoles = (roles ?? []).map((x: { role: string | null }) => x.role).filter((x): x is string => !!x);
    const resolver = Array.isArray(resolvedRows) ? (resolvedRows[0] as any | undefined) : (resolvedRows as any | undefined);
    const primaryRole = loadedProfile?.primary_role ?? resolver?.profile_role ?? null;
    const userRoleFromRows = allRoles.find((candidate) => normalizeAccountRole(candidate) === "admin")
      ?? allRoles.find((candidate) => normalizeAccountRole(candidate) === "restaurant")
      ?? allRoles.find((candidate) => normalizeAccountRole(candidate) === "worker")
      ?? resolver?.user_role
      ?? null;
    const metadataRole = (user?.user_metadata?.role as string | null | undefined) ?? resolver?.metadata_role ?? null;
    const r = normalizeAccountRole(resolver?.final_role)
      ?? normalizeAccountRole(userRoleFromRows)
      ?? normalizeAccountRole(primaryRole)
      ?? normalizeAccountRole(metadataRole);
    const finalRoute = routeForRole(r);
    const debugPayload: RoleDebug = {
      user_id: uid,
      email: user?.email ?? resolver?.email ?? null,
      profile_role: primaryRole,
      user_role: userRoleFromRows,
      metadata_role: metadataRole,
      user_roles_rows: allRoles,
      final_role: r,
      final_route: finalRoute,
      user_roles_error: rolesError?.message ?? resolver?.user_roles_error ?? null,
      profile_error: profileError?.message ?? resolver?.profile_error ?? null,
      rpc_error: rpcError?.message ?? null,
    };
    console.info("[PUPILLO_ROLE_LOGIN_DEBUG] loadExtras", debugPayload);
    console.info("[PUPILLO_ROLE_RESTORE_DEBUG] loadExtras", debugPayload);
    console.info("[PUPILLO_ROLE_FINAL_DEBUG] resolved role", debugPayload);
    if (!r) {
      console.warn("[PUPILLO_ROLE_MISMATCH_DEBUG] no role resolved for user", debugPayload);
    } else if (primaryRole && normalizeAccountRole(primaryRole) !== r && !allRoles.some((rowRole) => normalizeAccountRole(rowRole) === normalizeAccountRole(primaryRole))) {
      console.warn("[PUPILLO_ROLE_MISMATCH_DEBUG] primary_role differs from user_roles", debugPayload);
    }
    setRole(r);
    setProfile(loadedProfile);
    setRoleDebug(debugPayload);
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
    const currentSession = session ?? (await supabase.auth.getSession()).data.session;
    if (currentSession) {
      setSession(currentSession);
      setUser(currentSession.user);
      await loadExtras(currentSession.user.id);
    }
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
        setRoleDebug(null);
        setExtrasLoaded(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadExtras(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async (options?: { redirectTo?: string | false }) => {
    clearKnownRestaurantsCache();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
    setRoleDebug(null);
    setExtrasLoaded(false);
    if (typeof window !== "undefined") {
      // Hard redirect to public Home, replacing history so back button
      // cannot return to protected pages after logout.
      const redirectTo = options?.redirectTo === undefined ? "/" : options.redirectTo;
      if (redirectTo !== false) window.location.replace(redirectTo);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, roleDebug, loading, extrasLoaded, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}