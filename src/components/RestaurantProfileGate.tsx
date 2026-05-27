import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { goToRestaurantOnboarding } from "@/lib/restaurant-onboarding-navigation";

/**
 * Gate per le pagine operative del ristoratore (es. crea nuovo annuncio).
 * - Profilo completo → mostra i children.
 * - Profilo incompleto → mostra un popup chiaro che chiede di completare
 *   il profilo prima di poter usare la funzione.
 * - Errore/timeout nel caricamento del profilo → mostra messaggio con
 *   pulsante "Riprova" così la pagina non resta mai in "Caricamento…".
 */
export function RestaurantProfileGate({ children }: { children: ReactNode }) {
  const { profile, role, loading, extrasLoaded, refresh } = useAuth();
  const nav = useNavigate();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [completingProfile, setCompletingProfile] = useState(false);
  const completingProfileRef = useRef(false);

  const profileReady = !loading && extrasLoaded && !!profile;

  useEffect(() => {
    if (profileReady) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [profileReady, retrying]);

  // Admin bypass: never blocked.
  if (role === "admin") return <>{children}</>;

  if (!profileReady) {
    if (timedOut) {
      return (
        <AppShell>
          <div className="mx-auto max-w-md text-center space-y-4 py-12">
            <h2 className="text-lg font-semibold">
              Non è stato possibile verificare il completamento del profilo.
            </h2>
            <p className="text-sm text-muted-foreground">Riprova fra qualche secondo.</p>
            <Button
              onClick={async () => {
                setTimedOut(false);
                setRetrying((v) => !v);
                try {
                  await refresh();
                } catch {
                  setTimedOut(true);
                }
              }}
            >
              Riprova
            </Button>
          </div>
        </AppShell>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  const isComplete = !!profile?.profile_completed;
  if (isComplete) return <>{children}</>;

  // Log tecnico per diagnosi
  console.info("[restaurant-profile-gate] blocked: profile incomplete", {
    userId: profile?.id,
    profile_completed: profile?.profile_completed,
    business_name: profile?.business_name,
    phone_verified: profile?.phone_verified,
  });

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      nav({ to: "/dashboard" });
    }
  };

  const completeProfile = () => {
    console.info("[restaurant-profile-gate] complete profile clicked", {
      to: "/onboarding",
      profile_completed: profile?.profile_completed,
      role,
    });
    completingProfileRef.current = true;
    setCompletingProfile(true);
    goToRestaurantOnboarding(nav);
  };

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (completingProfile || completingProfileRef.current) return;
        if (!open) goBack();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Completa il profilo per creare un annuncio</AlertDialogTitle>
          <AlertDialogDescription>
            Per pubblicare un annuncio su Pupillo devi prima completare il profilo
            del tuo locale. Questa verifica serve a rendere la piattaforma più
            sicura e affidabile per i lavoratori.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={goBack}>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={completeProfile}>
            Completa profilo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}