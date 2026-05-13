import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles, AlertTriangle } from "lucide-react";
import { CREDITS_PER_HIRE, CREDIT_PACKS } from "@/lib/pricing";
import { useNavigate } from "@tanstack/react-router";

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
  // Recommended pack: SMART (best value entry pack)
  const recommended = CREDIT_PACKS.pack_smart_49;

  const goToBilling = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    params.set("action", "confirm-worker");
    const search = params.toString();
    navigate({ to: "/billing", search: search ? Object.fromEntries(params) as any : undefined });
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
              Per confermare un lavoratore servono <strong className="text-foreground">{needed} crediti</strong>.
              <br />Acquista nuovi crediti per continuare.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 space-y-3">
          <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Crediti disponibili</div>
              <div className="text-2xl font-bold tabular-nums flex items-center gap-1">
                <Coins className="h-4 w-4 text-muted-foreground" />{currentCredits}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Crediti necessari</div>
              <div className="text-2xl font-bold tabular-nums text-primary">{needed}</div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-semibold">
              <Sparkles className="h-3.5 w-3.5" />Consigliato
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div>
                <div className="text-lg font-bold">{recommended.label} — {recommended.credits} crediti</div>
                <div className="text-xs text-muted-foreground">≈ {recommended.hires} conferme lavoratore</div>
              </div>
              <div className="text-2xl font-bold">€{recommended.priceEur}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            Annulla
          </Button>
          <Button onClick={goToBilling} className="sm:flex-1 gap-2 shadow-lg shadow-primary/30">
            <Coins className="h-4 w-4" />Acquista crediti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}