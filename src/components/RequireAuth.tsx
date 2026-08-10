import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, ReactNode } from "react";
import {
  isOnboardingLocked,
  isPathAllowedDuringOnboarding,
} from "@/lib/onboarding-gate";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profile, role, extrasLoaded, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  // Blocco reale delle aree riservate finché l'onboarding non è salvato:
  // vale per URL diretti, refresh, tasto Indietro e link da notifiche.
  const onboardingBlocked =
    !loading &&
    !!user &&
    extrasLoaded &&
    isOnboardingLocked(profile, role) &&
    !isPathAllowedDuringOnboarding(loc.pathname);
  useEffect(() => {
    if (!onboardingBlocked) return;
    console.info("[onboarding-gate] blocked route, redirecting", {
      path: loc.pathname,
    });
    nav({ to: "/onboarding", replace: true });
  }, [onboardingBlocked, loc.pathname, nav]);
  useEffect(() => {
    // Wait for the auth context to finish restoring the session BEFORE
    // deciding to redirect. Without this, a notification deep-link can
    // mount this guard while loading is briefly false but the session is
    // still being hydrated, sending the user to /auth even though they
    // are signed in.
    if (loading) return;
    if (user) return;
    const currentPath = (loc as { href?: string }).href ?? loc.pathname;
    try {
      console.info("[PUPILLO_AUTH_REDIRECT_DEBUG]", {
        current_path: currentPath,
        has_session: false,
        auth_loading: loading,
        profile_loaded: !!profile,
        role: null,
        redirect_to_login_reason: "no_user_after_load",
      });
    } catch { /* ignore */ }
    nav({ to: "/auth", search: { redirect: currentPath } as never });
  }, [user, loading, nav, loc.pathname, (loc as { href?: string }).href, profile]);
  useEffect(() => {
    // If the profile has been soft-deleted (anonymized), log the user out immediately.
    if (user && profile && ((profile as { is_deleted?: boolean }).is_deleted || (profile as { deleted_at?: string | null }).deleted_at)) {
      console.info("[auth] protected route blocked for deleted account", { userId: user.id });
      if (typeof window !== "undefined") sessionStorage.setItem("pupillo-auth-message", DELETED_ACCOUNT_MESSAGE);
      void signOut({ redirectTo: "/auth?deleted=1" });
    }
  }, [user, profile, signOut]);
  if (loading || !user || (user && !extrasLoaded) || (profile && ((profile as { is_deleted?: boolean }).is_deleted || (profile as { deleted_at?: string | null }).deleted_at))) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }
  if (onboardingBlocked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }
  return <>{children}</>;
}