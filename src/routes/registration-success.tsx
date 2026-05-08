import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/registration-success")({
  head: () => ({ meta: [{ title: "Registrazione ricevuta — Pupillo" }] }),
  component: RegistrationSuccessPage,
});

function RegistrationSuccessPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  const phoneVerified = !!profile?.phone_verified;
  const profileComplete = !!profile?.profile_completed;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Registrazione ricevuta con successo.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Riceverai un messaggio WhatsApp per confermare il tuo numero e completare l'attivazione del profilo.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Ti abbiamo inviato anche una mail di riepilogo con i dati principali della tua registrazione.
        </p>
        <div className="mt-6 space-y-2">
          {!phoneVerified && (
            <Button asChild className="w-full">
              <Link to="/verify-phone">Conferma numero WhatsApp</Link>
            </Button>
          )}
          {phoneVerified && !profileComplete && (
            <Button asChild className="w-full">
              <Link to="/onboarding">Completa il profilo</Link>
            </Button>
          )}
          {phoneVerified && profileComplete && (
            <Button asChild className="w-full">
              <Link to="/dashboard">Vai alla dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}