import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/registration-success")({
  head: () => ({ meta: [{ title: "Registrazione ricevuta — Pupillo" }] }),
  component: RegistrationSuccessPage,
});

function RegistrationSuccessPage() {
  const { user } = useAuth();

  useEffect(() => {
    console.info("[PUPILLO_SIGNUP_NO_PHONE_DEBUG] registration-success rendered — no phone/OTP prompt", {
      hasSession: !!user,
    });
  }, [user]);

  // Destinazione del CTA: se già loggato vai all'onboarding, altrimenti al login.
  // In nessun caso si rimanda a /verify-phone: la verifica WhatsApp vive solo
  // nella pagina di onboarding/completamento profilo.
  const ctaTo = user ? "/onboarding" : "/auth";
  const ctaLabel = user ? "Continua" : "Vai al login";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Registrazione ricevuta con successo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ti abbiamo inviato una mail di conferma. Apri la tua casella di posta e clicca sul link ricevuto per attivare il profilo Pupillo.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Se non trovi la mail, controlla anche nella cartella Spam o Posta indesiderata.
        </p>
        <div className="mt-6">
          <Button asChild className="w-full">
            <Link to={ctaTo}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}