import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";
import { computePupilloAuthFlow, getAuthFlowRedirect, logPupilloAuthFlow } from "@/lib/auth-flow";

const ALLOWED_PATHS = new Set([
  "/",
  "/reset-password",
  "/terms",
  "/forbidden",
  "/verify-phone",
  "/verify-email",
  "/registration-success",
  "/onboarding",
  "/dashboard",
  "/profile",
  "/billing",
  "/admin",
  "/browse",
  "/jobs",
  "/availability",
  "/messages",
  "/notifications",
  "/mappa",
  "/workers",
  "/announcements",
  "/shifts",
]);

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, profile, loading, extrasLoaded, role } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    // Wait for auth session restore AND profile/role load before any decision.
    // This prevents redirecting anonymous users (no session yet) or users
    // whose profile.phone_verified is still undefined during loading.
    if (loading) return;
    if (!user) return;
    if (!extrasLoaded) return;
    if (profile && (profile.is_deleted || profile.deleted_at)) {
      console.info("[auth] phone verification blocked for deleted account", { userId: user.id });
      sessionStorage.setItem("pupillo-auth-message", DELETED_ACCOUNT_MESSAGE);
      nav({ to: "/auth", search: { deleted: "1" } as never });
      return;
    }
    // API and non-registration public routes pass through
    if (loc.pathname.startsWith("/api/")) return;
    const isAllowedPage = ALLOWED_PATHS.has(loc.pathname) ||
      loc.pathname.startsWith("/messages") ||
      loc.pathname.startsWith("/announcements") ||
      loc.pathname.startsWith("/workers") ||
      loc.pathname.startsWith("/restaurants") ||
      loc.pathname.startsWith("/ristoratore") ||
      loc.pathname.startsWith("/reviews");
    const flow = computePupilloAuthFlow({ user, profile, role });
    const redirect = flow ? getAuthFlowRedirect(loc.pathname, flow, role) : null;
    logPupilloAuthFlow("route_guard", {
      user,
      profile,
      role,
      currentRoute: loc.pathname,
      flow,
      redirectTo: redirect?.to ?? null,
      redirectReason: redirect?.reason ?? null,
    });
    console.info("[PUPILLO_BLOCK_DEBUG] route_guard", {
      route_attuale: loc.pathname,
      user_id: user.id,
      ruolo: role,
      phone_verified: profile?.phone_verified ?? null,
      email_confirmed_at: user.email_confirmed_at ?? (user as typeof user & { confirmed_at?: string | null }).confirmed_at ?? null,
      profile_completion: profile?.completion_pct ?? profile?.profile_completed ?? null,
      isProfileComplete: profile?.profile_completed === true,
      calculated_state: flow?.state ?? null,
      isPageBlocked: Boolean(redirect && !isAllowedPage),
      motivo_blocco: redirect && !isAllowedPage ? redirect.reason : null,
      disabled_buttons: [],
      disabled_by_component: "PhoneVerificationGate",
      overlay_active: false,
      main_container_pointer_events_none: false,
      redirect_deciso: redirect?.to ?? null,
    });
    if (redirect && !isAllowedPage) {
      nav({ to: redirect.to as never, replace: true });
    }
  }, [user, profile, loading, extrasLoaded, role, loc.pathname, nav]);

  return <>{children}</>;
}