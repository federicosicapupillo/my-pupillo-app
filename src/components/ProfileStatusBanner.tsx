import { Link, useLocation } from "@tanstack/react-router";
import { CheckCircle2, Circle, Phone, UserCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProfileStatusBanner() {
  const { profile } = useAuth();
  const loc = useLocation();
  if (!profile) return null;

  const phoneVerified = !!profile.phone_verified;
  const profileCompleted = !!profile.profile_completed;
  const allDone = phoneVerified && profileCompleted;
  const role = (profile as any).role as "restaurant" | "worker" | "admin" | undefined;

  // Logica prossimo step:
  // 1) telefono non verificato → /verify-phone
  // 2) profilo incompleto → /onboarding
  // 3) profilo attivo → CTA contestuale (dashboard, oppure azione tipica del ruolo)
  let nextStep: { label: string; to: string; description?: string } | null = null;
  if (!phoneVerified) {
    nextStep = {
      label: "Verifica il numero WhatsApp",
      to: "/verify-phone",
      description: "Conferma il tuo numero per attivare l'account.",
    };
  } else if (!profileCompleted) {
    nextStep = {
      label: "Completa il profilo",
      to: "/onboarding",
      description: "Aggiungi le informazioni mancanti per iniziare a usare Pupillo.",
    };
  } else if (loc.pathname !== "/dashboard") {
    nextStep = { label: "Vai alla dashboard", to: "/dashboard" };
  } else if (role === "restaurant") {
    nextStep = {
      label: "Pubblica un annuncio",
      to: "/ristoratore/annunci/nuovo",
      description: "Trova personale extra in pochi minuti.",
    };
  } else if (role === "worker") {
    nextStep = {
      label: "Sfoglia gli annunci",
      to: "/browse",
      description: "Candidati alle offerte disponibili nella tua zona.",
    };
  }

  return (
    <div
      className={cn(
        "mb-6 rounded-xl border p-4",
        allDone
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {allDone ? "Profilo attivo e verificato" : "Stato del profilo"}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <StatusItem ok={phoneVerified} icon={<Phone className="h-4 w-4" />} label="Telefono verificato" />
            <StatusItem ok={profileCompleted} icon={<UserCircle2 className="h-4 w-4" />} label="Profilo completato" />
          </ul>
          {nextStep?.description && (
            <p className="text-xs text-muted-foreground">{nextStep.description}</p>
          )}
        </div>
        {nextStep && (
          <Button
            asChild
            size="sm"
            variant={allDone ? "outline" : "default"}
            className="gap-2 self-start sm:self-auto"
          >
            <Link to={nextStep.to}>
              {nextStep.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusItem({ ok, icon, label }: { ok: boolean; icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        <span className="inline-flex items-center gap-1">{icon}{label}</span>
      </span>
    </li>
  );
}
