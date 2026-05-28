import type { User } from "@supabase/supabase-js";
import type { Profile, Role } from "@/lib/auth-context";

export type PupilloAuthFlowState =
  | "NEEDS_PHONE"
  | "NEEDS_OTP"
  | "PHONE_VERIFIED_EMAIL_PENDING"
  | "VERIFIED_NEEDS_PROFILE"
  | "PROFILE_COMPLETE";

type AuthFlowInput = {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
};

export type PupilloAuthFlow = {
  state: PupilloAuthFlowState;
  hasPhone: boolean;
  phoneVerified: boolean;
  otpPending: boolean;
  emailConfirmed: boolean;
  profileCompleted: boolean;
};

const FLOW_ROUTES = new Set([
  "/auth",
  "/verify-phone",
  "/verify-email",
  "/registration-success",
  "/onboarding",
]);

export function hasWhatsAppNumber(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.phone_full?.trim() ||
      profile.phone?.trim() ||
      (profile.phone_country_code?.trim() && profile.phone_number?.trim()),
  );
}

export function getAuthEmailConfirmedAt(user: User | null | undefined): string | null {
  const authUser = user as (User & { confirmed_at?: string | null }) | null | undefined;
  return authUser?.email_confirmed_at ?? authUser?.confirmed_at ?? null;
}

export function isAuthEmailConfirmed(user: User | null | undefined): boolean {
  return Boolean(getAuthEmailConfirmedAt(user));
}

export function computePupilloAuthFlow({ user, profile, role }: AuthFlowInput): PupilloAuthFlow | null {
  if (!user || !profile) return null;

  const hasPhone = hasWhatsAppNumber(profile);
  const phoneVerified = profile.phone_verified === true;
  const status = (profile.whatsapp_confirmation_status ?? "").toLowerCase();
  const otpPending = hasPhone && !phoneVerified && (status === "pending" || status === "sent" || status === "failed");
  const emailConfirmed = isAuthEmailConfirmed(user);
  const profileCompleted = profile.profile_completed === true;

  if (role === "admin") {
    return { state: "PROFILE_COMPLETE", hasPhone, phoneVerified, otpPending, emailConfirmed, profileCompleted };
  }
  if (!hasPhone) {
    return { state: "NEEDS_PHONE", hasPhone, phoneVerified, otpPending, emailConfirmed, profileCompleted };
  }
  if (!phoneVerified) {
    return { state: "NEEDS_OTP", hasPhone, phoneVerified, otpPending: true, emailConfirmed, profileCompleted };
  }
  if (!emailConfirmed) {
    return { state: "PHONE_VERIFIED_EMAIL_PENDING", hasPhone, phoneVerified, otpPending: false, emailConfirmed, profileCompleted };
  }
  if (!profileCompleted) {
    return { state: "VERIFIED_NEEDS_PROFILE", hasPhone, phoneVerified, otpPending: false, emailConfirmed, profileCompleted };
  }
  return { state: "PROFILE_COMPLETE", hasPhone, phoneVerified, otpPending: false, emailConfirmed, profileCompleted };
}

export function destinationForAuthFlowState(state: PupilloAuthFlowState, role: Role | null): string {
  if (role === "admin") return "/admin";
  if (state === "NEEDS_PHONE" || state === "NEEDS_OTP") return "/verify-phone";
  if (state === "PHONE_VERIFIED_EMAIL_PENDING") return "/verify-email";
  if (state === "VERIFIED_NEEDS_PROFILE") return "/onboarding";
  return "/dashboard";
}

export function getAuthFlowRedirect(pathname: string, flow: PupilloAuthFlow, role: Role | null): { to: string; reason: string } | null {
  if (role === "admin") {
    return FLOW_ROUTES.has(pathname) && pathname !== "/admin"
      ? { to: "/admin", reason: "admin_bypass_flow" }
      : null;
  }

  const destination = destinationForAuthFlowState(flow.state, role);
  if (flow.state === "PROFILE_COMPLETE") {
    return FLOW_ROUTES.has(pathname) && pathname !== destination
      ? { to: destination, reason: "profile_complete_exit_creation_flow" }
      : null;
  }

  if (pathname === destination) return null;
  return { to: destination, reason: `state_${flow.state.toLowerCase()}` };
}

export function logPupilloAuthFlow(
  event: string,
  input: AuthFlowInput & {
    currentRoute: string;
    flow: PupilloAuthFlow | null;
    redirectTo?: string | null;
    redirectReason?: string | null;
  },
) {
  if (!import.meta.env.DEV) return;
  const profileRecord = input.profile as (Profile & {
    email_verified?: boolean | null;
    onboarding_step?: string | null;
  }) | null;
  console.info("[PUPILLO_AUTH_FLOW]", event, {
    user_id: input.user?.id ?? null,
    role: input.role,
    current_route: input.currentRoute,
    phone_presente: input.flow?.hasPhone ?? hasWhatsAppNumber(input.profile),
    phone_verified: input.profile?.phone_verified ?? null,
    otp_pending: input.flow?.otpPending ?? null,
    email: input.user?.email ?? input.profile?.email ?? null,
    email_confirmed_at: getAuthEmailConfirmedAt(input.user),
    email_verified: profileRecord?.email_verified ?? null,
    onboarding_step: profileRecord?.onboarding_step ?? null,
    profile_completion: input.profile?.completion_pct ?? input.profile?.profile_completed ?? null,
    stato_calcolato: input.flow?.state ?? null,
    redirect_deciso: input.redirectTo ?? null,
    motivo_redirect: input.redirectReason ?? null,
  });
}