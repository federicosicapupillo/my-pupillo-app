import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { CREDITS_PER_HIRE } from "@/lib/pricing";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCredits: number;
  needed?: number;
  /** URL path to return to after purchase, e.g. `/messages/123` */
  returnTo?: string;
};

export function InsufficientCreditsDialog({ open, onOpenChange, currentCredits, needed = CREDITS_PER_HIRE, returnTo }: Props) {
  const navigate = useNavigate();
  const [activatingBasic, setActivatingBasic] = useState(false);
  const [viewingPlans, setViewingPlans] = useState(false);

  const buildSearch = (extra: Record<string, string>) => {
    const params: Record<string, string> = { ...extra };
    if (returnTo) params.returnTo = returnTo;
    return params;
  };

  const activateBasic = async () => {
    if (activatingBasic) return; // evita doppio click / doppio checkout
    setActivatingBasic(true);
    try {
      // PLACEHOLDER CHECKOUT — sostituire con la chiamata reale al provider
      // di pagamento per aprire direttamente il checkout del piano Basic
      // (es. Stripe Checkout Session per priceId del piano "basic").
      // Per ora reindirizziamo al billing con un parametro che indica
      // l'intento di avviare il checkout del piano Basic.
      onOpenChange(false);
      await navigate({
        to: "/billing",
        search: buildSearch({ action: "confirm-worker", checkout: "basic" }) as any,
      });
    } catch (e) {
      toast.error("Non siamo riusciti ad aprire il pagamento. Riprova tra qualche secondo.");
    } finally {
      setActivatingBasic(false);
    }
  };

  const viewAllPlans = async () => {
    if (viewingPlans) return;
    setViewingPlans(true);
    try {
      onOpenChange(false);
      await navigate({
        to: "/billing",
        search: buildSearch({ action: "confirm-worker" }) as any,
      });
    } finally {
      setViewingPlans(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.45)] animate-scale-in">
        <div className="bg-gradient-to-br from-amber-500/10 via-card to-card p-6 pb-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-3">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </div>
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-2xl font-bold text-center">Crediti insufficienti</DialogTitle>
            <DialogDescription className="text-center text-base">
              Hai terminato i crediti disponibili. Per continuare puoi attivare subito il piano <strong className="text-foreground">Basic</strong> oppure confrontare tutti i piani Pupillo.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 space-y-3">
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-semibold">
              <Sparkles className="h-3.5 w-3.5" />Piano consigliato
            </div>
            <div className="mt-1 text-lg font-bold">Basic</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ideale per iniziare a usare Pupillo con continuità e sbloccare nuove opportunità di contatto.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={viewAllPlans} disabled={viewingPlans || activatingBasic} className="sm:flex-1">
            {viewingPlans ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vedi tutti i piani"}
          </Button>
          <Button onClick={activateBasic} disabled={activatingBasic} className="sm:flex-1 gap-2 shadow-lg shadow-primary/30">
            {activatingBasic ? (<><Loader2 className="h-4 w-4 animate-spin" />Apertura…</>) : "Attiva Basic"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}