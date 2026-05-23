import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  getCompleteProfileRoute,
  getProfileCompletion,
  isOperativePath,
  type CompletionResult,
  type Role,
} from "@/lib/profile-completion";

type Ctx = {
  isComplete: boolean;
  completion: CompletionResult;
  /**
   * Returns true if the profile is complete (action may proceed),
   * otherwise opens the global "Completa profilo" dialog and returns false.
   * Use as a guard at the start of operational handlers:
   *
   *   if (!requireComplete()) return;
   */
  requireComplete: () => boolean;
  openGate: () => void;
};

const ProfileGateContext = createContext<Ctx | undefined>(undefined);

export function ProfileGateProvider({ children }: { children: ReactNode }) {
  const { profile, role, extrasLoaded } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const completion = useMemo(
    () => getProfileCompletion(profile as never, role as Role),
    [profile, role],
  );

  const requireComplete = useCallback(() => {
    if (completion.isComplete) return true;
    setOpen(true);
    return false;
  }, [completion.isComplete]);

  const openGate = useCallback(() => setOpen(true), []);

  // Global route guard: when the user lands on an operative route with an
  // incomplete profile, auto-open the dialog and render a blocking overlay.
  const shouldGate =
    extrasLoaded &&
    (role === "worker" || role === "restaurant") &&
    !completion.isComplete &&
    isOperativePath(loc.pathname);

  useEffect(() => {
    if (shouldGate) setOpen(true);
  }, [shouldGate, loc.pathname]);

  const goComplete = () => {
    setOpen(false);
    nav({ to: getCompleteProfileRoute(role as Role) });
  };
  const goDashboard = () => {
    setOpen(false);
    nav({ to: "/dashboard" });
  };

  const value: Ctx = { isComplete: completion.isComplete, completion, requireComplete, openGate };

  return (
    <ProfileGateContext.Provider value={value}>
      {children}
      {shouldGate ? (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" aria-hidden />
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-50">
          <DialogHeader>
            <DialogTitle>Completa il profilo per continuare</DialogTitle>
            <DialogDescription>
              Per garantire sicurezza, affidabilità e qualità del servizio,
              devi completare il tuo profilo prima di utilizzare le funzioni
              operative di Pupillo. Completa tutti i dati richiesti per
              accedere alla piattaforma.
            </DialogDescription>
          </DialogHeader>
          {completion.missing.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {completion.missing.slice(0, 6).map((m) => (
                <li key={m.key}>{m.label}</li>
              ))}
            </ul>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={goDashboard}>
              Torna alla dashboard
            </Button>
            <Button onClick={goComplete}>Completa profilo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProfileGateContext.Provider>
  );
}

export function useProfileGate(): Ctx {
  const ctx = useContext(ProfileGateContext);
  if (!ctx) {
    // Safe fallback: if the provider is not mounted (e.g. in tests),
    // never block actions.
    return {
      isComplete: true,
      completion: { isComplete: true, percent: 100, missing: [], total: 0, done: 0 },
      requireComplete: () => true,
      openGate: () => {},
    };
  }
  return ctx;
}