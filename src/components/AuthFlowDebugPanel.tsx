import { useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  describeAuthFlowReason,
  getAuthEmailConfirmedAt,
  getAuthFlowRedirect,
  getRegistrationState,
  hasWhatsAppNumber,
} from "@/lib/auth-flow";

export function AuthFlowDebugPanel() {
  const { user, profile, role, loading, extrasLoaded } = useAuth();
  const location = useLocation();
  const enabled = import.meta.env.DEV || role === "admin";
  if (!enabled || (!user && !import.meta.env.DEV)) return null;

  const flow = getRegistrationState({ user, profile, role });
  const redirect = flow ? getAuthFlowRedirect(location.pathname, flow, role) : null;
  const profileRecord = profile as (typeof profile & {
    email_verified?: boolean | null;
    onboarding_step?: string | null;
  }) | null;
  const rows: Array<[string, string]> = [
    ["user_id", user?.id ?? "—"],
    ["email", user?.email ?? profile?.email ?? "—"],
    ["ruolo", role ?? "—"],
    ["route attuale", location.pathname],
    ["WhatsApp presente", hasWhatsAppNumber(profile) ? "sì" : "no"],
    ["phone_verified", String(profile?.phone_verified ?? false)],
    ["otp_pending", String(flow?.otpPending ?? false)],
    ["email_confirmed_at Supabase", getAuthEmailConfirmedAt(user) ?? "null"],
    ["profiles.email_verified", String(profileRecord?.email_verified ?? "non presente")],
    ["onboarding_step", profileRecord?.onboarding_step ?? "—"],
    ["profile_completion", String(profile?.completion_pct ?? profile?.profile_completed ?? "—")],
    ["stato calcolato", flow?.state ?? (loading || !extrasLoaded ? "caricamento" : "—")],
    ["motivo", describeAuthFlowReason(flow)],
    ["redirect deciso", redirect?.to ?? "nessuno"],
    ["motivo redirect", redirect?.reason ?? "—"],
  ];

  return (
    <aside className="fixed bottom-3 left-3 z-50 max-h-[45vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border bg-card/95 p-3 text-xs text-card-foreground shadow-lg backdrop-blur">
      <h2 className="mb-2 text-sm font-semibold">PUPILLO AUTH FLOW DEBUG</h2>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}