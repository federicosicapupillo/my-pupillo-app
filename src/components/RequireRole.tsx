import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, ReactNode } from "react";

type Role = "admin" | "restaurant" | "worker";

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    if (role && !allow.includes(role)) {
      nav({ to: "/forbidden" });
    }
  }, [user, role, loading, allow, nav]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }
  if (role && !allow.includes(role)) return null;
  return <>{children}</>;
}