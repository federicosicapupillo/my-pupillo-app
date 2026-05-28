import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";

const ALLOWED_PATHS = new Set([
  "/",
  "/auth",
  "/verify-phone",
  "/registration-success",
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
    // API and public routes pass through
    if (loc.pathname.startsWith("/api/")) return;
    if (ALLOWED_PATHS.has(loc.pathname)) return;
    // Admins are never forced through phone verification.
    if (role === "admin") return;
    // Strict check: only redirect when explicitly false (not null/undefined).
    if (profile && profile.phone_verified === false) {
      nav({ to: "/verify-phone" });
    }
  }, [user, profile, loading, extrasLoaded, role, loc.pathname, nav]);

  return <>{children}</>;
}