import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
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

/**
 * Pupillo: gate globale per le AZIONI OPERATIVE.
 *
 * - La navigazione (mappe, annunci, dashboard, candidature, chat in sola
 *   lettura, profilo, impostazioni, assistenza, privacy, termini, logout)
 *   resta SEMPRE libera.
 * - Tutte le azioni che modificano lo stato (candidarsi, inviare proposta,
 *   pubblicare/accettare/rifiutare annuncio, accettare/rifiutare
 *   candidatura, confermare/chiudere/annullare turno, inviare messaggi
 *   operativi, lasciare recensioni, sbloccare crediti) devono passare per
 *   `requireComplete` o per il check `canPerformOperationalAction`.
 *
 * Uso tipico:
 *
 *   const { requireComplete } = useProfileGate();
 *   <Button onClick={requireComplete(() => doApply())}>Candidati</Button>
 */

type GateCtx = {
  /** Profilo completo al 100% → ok per qualsiasi azione operativa. */
  canPerformOperationalAction: boolean;
  /** Apre il popup informativo "Completa il profilo per continuare". */
  openGate: () => void;
  /**
   * Wrappa un handler operativo:
   * - se il profilo è completo → esegue `fn(...args)`
   * - altrimenti → apre il popup e blocca l'azione
   *
   * Va bene per onClick, onSubmit, e callback custom.
   */
  requireComplete: <Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
  ) => (...args: Args) => void;
};

const ProfileGateContext = createContext<GateCtx | null>(null);

export function ProfileGateProvider({ children }: { children: ReactNode }) {
  const { profile, role, user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  // Gli admin non sono mai bloccati. Gli utenti non loggati nemmeno (sono
  // già gestiti da RequireAuth lato pagina; il gate è per utenti in sessione).
  const isAdmin = role === "admin";
  const isComplete = !!profile?.profile_completed;
  const canPerformOperationalAction = !user || isAdmin || isComplete;

  const openGate = useCallback(() => setOpen(true), []);

  const requireComplete = useCallback(
    <Args extends unknown[]>(fn: (...args: Args) => void | Promise<void>) =>
      (...args: Args) => {
        if (canPerformOperationalAction) {
          void fn(...args);
          return;
        }
        setOpen(true);
      },
    [canPerformOperationalAction],
  );

  const value = useMemo<GateCtx>(
    () => ({ canPerformOperationalAction, openGate, requireComplete }),
    [canPerformOperationalAction, openGate, requireComplete],
  );

  const goToProfile = () => {
    setOpen(false);
    // Tutti i ruoli completano il profilo dalla stessa pagina /onboarding,
    // che si adatta automaticamente a worker/restaurant.
    nav({ to: "/onboarding" });
  };

  return (
    <ProfileGateContext.Provider value={value}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completa il profilo per continuare</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Per usare questa funzione devi completare il tuo profilo al 100%.
              </span>
              <span className="block">
                Questo ci aiuta a mantenere la piattaforma sicura, affidabile e
                professionale per lavoratori e ristoratori.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={goToProfile}>
              Completa profilo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProfileGateContext.Provider>
  );
}

export function useProfileGate(): GateCtx {
  const ctx = useContext(ProfileGateContext);
  if (!ctx) {
    // Fallback safe: in test/storybook senza provider, le azioni passano.
    return {
      canPerformOperationalAction: true,
      openGate: () => {},
      requireComplete: (fn) => ((...args) => void fn(...args)),
    };
  }
  return ctx;
}

/**
 * Helper puro (no hook) per check inline. Usalo solo in casi limite, ad es.
 * per decidere la classe `opacity-60` su un bottone. Per intercettare
 * il click usa sempre `requireComplete` del provider.
 */
export function canPerformOperationalAction(
  profile: { profile_completed?: boolean | null } | null | undefined,
  role?: string | null,
): boolean {
  if (role === "admin") return true;
  return !!profile?.profile_completed;
}