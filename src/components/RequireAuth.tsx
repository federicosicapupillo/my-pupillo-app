import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profile, signOut } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);
  useEffect(() => {
    // If the profile has been soft-deleted (anonymized), log the user out immediately.
    if (user && profile && (profile as { is_deleted?: boolean }).is_deleted) {
      void signOut();
    }
  }, [user, profile, signOut]);
  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }
  return <>{children}</>;
}