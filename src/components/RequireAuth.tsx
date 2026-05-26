import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profile, extrasLoaded, signOut } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);
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
  return <>{children}</>;
}