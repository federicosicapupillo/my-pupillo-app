import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { DELETED_ACCOUNT_MESSAGE, useAuth } from "@/lib/auth-context";
import { evaluatePhoneGate } from "@/lib/phone-verification-gate";

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, profile, loading, extrasLoaded, role } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const decision = evaluatePhoneGate({
      loading,
      extrasLoaded,
      user: user ? { id: user.id } : null,
      profile: profile
        ? {
            phone_verified: profile.phone_verified ?? null,
            is_deleted: (profile as any).is_deleted ?? null,
            deleted_at: (profile as any).deleted_at ?? null,
          }
        : null,
      role: (role as any) ?? null,
      pathname: loc.pathname,
    });
    if (decision.action === "wait" || decision.action === "pass") return;
    if (decision.to === "/auth" && decision.reason === "deleted-account") {
      console.info("[auth] phone verification blocked for deleted account", { userId: user?.id });
      sessionStorage.setItem("pupillo-auth-message", DELETED_ACCOUNT_MESSAGE);
      nav({ to: "/auth", search: { deleted: "1" } as never });
      return;
    }
    if (decision.to === "/onboarding") {
      console.info("[PUPILLO_PHONE_ONBOARDING_DEBUG] gate redirect → /onboarding", {
        userId: user?.id,
        path: loc.pathname,
        phone_verified: profile?.phone_verified ?? null,
      });
      nav({ to: "/onboarding" });
    }
  }, [user, profile, loading, extrasLoaded, role, loc.pathname, nav]);

  return <>{children}</>;
}