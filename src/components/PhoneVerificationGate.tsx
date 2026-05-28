import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";
import { computePupilloAuthFlow, getAuthFlowRedirect, logPupilloAuthFlow } from "@/lib/auth-flow";

const ALLOWED_PATHS = new Set([
  "/reset-password",
  "/terms",
  "/forbidden",
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
    if (ALLOWED_PATHS.has(loc.pathname)) return;
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
    if (redirect) {
      nav({ to: redirect.to as never, replace: true });
    }
  }, [user, profile, loading, extrasLoaded, role, loc.pathname, nav]);

  return <>{children}</>;
}