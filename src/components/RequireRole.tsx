import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, ReactNode } from "react";

type Role = "admin" | "restaurant" | "worker";

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, role, loading, extrasLoaded } = useAuth();
  const nav = useNavigate();
  const isAdminGate = allow.includes("admin");

  useEffect(() => {
    // Wait for the Supabase session restore to finish before any decision.
    if (loading) return;
    // Not authenticated → send to login.
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    // Authenticated but role/profile still loading → keep waiting,
    // never treat `role === null` as "unauthorized".
    if (!extrasLoaded) return;
    // Role resolved and not allowed → forbidden page.
    if (role && !allow.includes(role)) {
      nav({ to: "/forbidden" });
    }
  }, [user, role, loading, extrasLoaded, allow, nav]);

  if (loading || !user || !extrasLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {isAdminGate ? "Caricamento area admin…" : "Caricamento…"}
      </div>
    );
  }
  if (role && !allow.includes(role)) return null;
  return <>{children}</>;
}