import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { computePupilloAuthFlow, destinationForAuthFlowState, isAuthEmailConfirmed, logPupilloAuthFlow } from "@/lib/auth-flow";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Conferma la tua email — Pupillo" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user, profile, role, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const emailConfirmed = isAuthEmailConfirmed(user);
  const phoneVerified = !!profile?.phone_verified;

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!profile) return;
    const flow = computePupilloAuthFlow({ user, profile, role });
    const dest = flow ? destinationForAuthFlowState(flow.state, role) : null;
    logPupilloAuthFlow("verify_email_page", {
      user,
      profile,
      role,
      currentRoute: "/verify-email",
      flow,
      redirectTo: dest !== "/verify-email" ? dest : null,
      redirectReason: dest !== "/verify-email" ? "verify_email_state_mismatch" : null,
    });
    if (dest && dest !== "/verify-email") {
      nav({ to: dest as any, replace: true });
    }
  }, [user, profile, role, loading, emailConfirmed, phoneVerified, nav]);

  const handleCheck = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        toast.error("Impossibile aggiornare lo stato. Riprova.");
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        toast.error("Impossibile controllare la conferma email. Riprova.");
        return;
      }
      const confirmed = isAuthEmailConfirmed(userData.user);
      if (!confirmed) {
        toast.error("Email non ancora confermata. Controlla la tua casella di posta.");
        return;
      }
      toast.success("Email confermata.");
      await refresh();
      const nextFlow = computePupilloAuthFlow({ user: userData.user, profile, role });
      const dest = nextFlow ? destinationForAuthFlowState(nextFlow.state, role) : "/onboarding";
      logPupilloAuthFlow("verify_email_check_success", {
        user: userData.user,
        profile,
        role,
        currentRoute: "/verify-email",
        flow: nextFlow,
        redirectTo: dest,
        redirectReason: "email_confirmed_after_refresh_and_get_user",
      });
      nav({ to: dest as any });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    const email = user?.email;
    if (!email) {
      toast.error("Email non disponibile. Effettua di nuovo l'accesso.");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) {
        toast.error("Non siamo riusciti a inviare la mail di conferma. Riprova tra qualche secondo.");
        return;
      }
      toast.success("Email di conferma inviata nuovamente.");
    } finally {
      setResending(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Caricamento…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-center">Conferma la tua email</h1>
        <p className="mt-3 text-sm text-muted-foreground text-center">
          Il numero WhatsApp è stato verificato. Ora controlla la tua casella email e clicca sul link di conferma.
        </p>
        {user.email && (
          <p className="mt-3 text-sm text-center">
            Email: <strong className="break-all">{user.email}</strong>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground text-center">Se non trovi l'email, controlla anche nello spam.</p>
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={handleCheck} disabled={busy}>
            {busy ? "Verifica in corso…" : "Ho confermato, controlla ora"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Invio…" : "Reinvia email"}
          </Button>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="underline hover:text-foreground">Torna al login</Link>
        </div>
      </div>
    </div>
  );
}