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

type GateKind = "general" | "availability" | "target";

type OpenOptions = { kind?: GateKind };

type GateCtx = {
  /** Profilo completo al 100% → ok per qualsiasi azione operativa. */
  canPerformOperationalAction: boolean;
  /** Apre il popup informativo. Default "general". */
  openGate: (opts?: OpenOptions) => void;
  /**
   * Wrappa un handler operativo:
   * - se il profilo è completo → esegue `fn(...args)`
   * - altrimenti → apre il popup e blocca l'azione
   *
   * Va bene per onClick, onSubmit, e callback custom.
   */
  requireComplete: <Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
    opts?: OpenOptions,
  ) => (...args: Args) => void;
  /**
   * Variante del wrapper per le azioni della pagina "Disponibilità".
   * Identico a `requireComplete` ma apre il popup dedicato.
   */
  requireCompleteForAvailability: <Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
  ) => (...args: Args) => void;
  /**
   * Blocca un'azione operativa rivolta verso un altro utente quando il
   * profilo TARGET non è completo al 100% (es. inviare un messaggio o
   * una proposta a un lavoratore/ristoratore con profilo incompleto).
   * Ritorna `true` se l'azione può procedere.
   */
  ensureTargetComplete: (
    targetProfileCompleted: boolean | null | undefined,
  ) => boolean;
};

const ProfileGateContext = createContext<GateCtx | null>(null);

export function ProfileGateProvider({ children }: { children: ReactNode }) {
  const { profile, role, user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<GateKind>("general");

  // Gli admin non sono mai bloccati. Gli utenti non loggati nemmeno (sono
  // già gestiti da RequireAuth lato pagina; il gate è per utenti in sessione).
  const isAdmin = role === "admin";
  const isComplete = !!profile?.profile_completed;
  const canPerformOperationalAction = !user || isAdmin || isComplete;

  const openGate = useCallback((opts?: OpenOptions) => {
    setKind(opts?.kind ?? "general");
    setOpen(true);
  }, []);

  const requireComplete = useCallback(
    <Args extends unknown[]>(
      fn: (...args: Args) => void | Promise<void>,
      opts?: OpenOptions,
    ) =>
      (...args: Args) => {
        if (canPerformOperationalAction) {
          void fn(...args);
          return;
        }
        setKind(opts?.kind ?? "general");
        setOpen(true);
      },
    [canPerformOperationalAction],
  );

  const requireCompleteForAvailability = useCallback(
    <Args extends unknown[]>(fn: (...args: Args) => void | Promise<void>) =>
      (...args: Args) => {
        if (canPerformOperationalAction) {
          void fn(...args);
          return;
        }
        setKind("availability");
        setOpen(true);
      },
    [canPerformOperationalAction],
  );

  const ensureTargetComplete = useCallback(
    (targetProfileCompleted: boolean | null | undefined): boolean => {
      if (targetProfileCompleted) return true;
      setKind("target");
      setOpen(true);
      return false;
    },
    [],
  );

  const value = useMemo<GateCtx>(
    () => ({
      canPerformOperationalAction,
      openGate,
      requireComplete,
      requireCompleteForAvailability,
      ensureTargetComplete,
    }),
    [
      canPerformOperationalAction,
      openGate,
      requireComplete,
      requireCompleteForAvailability,
      ensureTargetComplete,
    ],
  );

  const goToProfile = () => {
    setOpen(false);
    nav({ to: "/onboarding" });
  };

  const titles: Record<GateKind, string> = {
    general: "Completa il profilo per continuare",
    availability: "Completa il profilo per modificare la disponibilità",
    target: "Utente non ancora disponibile",
  };
  const isTarget = kind === "target";

  return (
    <ProfileGateContext.Provider value={value}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titles[kind]}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {kind === "general" && (
                <>
                  <span className="block">
                    Per usare questa funzione devi completare il tuo profilo al 100%.
                  </span>
                  <span className="block">
                    Solo i profili completi possono inviare messaggi, ricevere
                    richieste operative, risultare online, inserire disponibilità
                    o usare le funzioni operative della piattaforma.
                  </span>
                </>
              )}
              {kind === "availability" && (
                <span className="block">
                  Per inserire o modificare la tua disponibilità devi prima
                  completare il profilo al 100%.
                </span>
              )}
              {kind === "target" && (
                <span className="block">
                  Questo profilo non è ancora completo al 100% e non può ricevere
                  messaggi o richieste operative.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {isTarget ? (
              <AlertDialogAction onClick={() => setOpen(false)}>Ok</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={goToProfile}>
                  Completa profilo
                </AlertDialogAction>
              </>
            )}
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
      requireCompleteForAvailability: (fn) => ((...args) => void fn(...args)),
      ensureTargetComplete: () => true,
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