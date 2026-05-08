import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

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
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    // API and public routes pass through
    if (loc.pathname.startsWith("/api/")) return;
    if (ALLOWED_PATHS.has(loc.pathname)) return;
    if (profile && profile.phone_verified === false) {
      nav({ to: "/verify-phone" });
    }
  }, [user, profile, loading, loc.pathname, nav]);

  return <>{children}</>;
}