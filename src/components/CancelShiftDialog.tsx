import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelShiftWithNotifications } from "@/lib/shift-cancel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string | null;
  restaurantId: string | null;
  workerId: string | null;
  applicationId?: string | null;
  onCancelled?: () => void;
};

/**
 * Confirmation dialog for the restaurant to cancel an assigned shift.
 *
 * The dialog states explicitly that credits are NOT refunded and requires
 * the restaurant to (1) tick an acknowledgement checkbox and (2) provide a
 * reason (min 10 chars) before confirming.
 */
export function CancelShiftDialog({
  open, onOpenChange, shiftId, restaurantId, workerId, applicationId, onCancelled,
}: Props) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setAcknowledged(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = acknowledged && reason.trim().length >= 10 && !submitting && !!shiftId && !!restaurantId;

  const handleConfirm = async () => {
    if (!canSubmit || !shiftId || !restaurantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await cancelShiftWithNotifications({
        shiftId,
        restaurantId,
        workerId,
        applicationId: applicationId ?? null,
        reason: reason.trim(),
      });
      toast.success("Turno annullato. Il lavoratore è stato avvisato.");
      onCancelled?.();
      onOpenChange(false);
    } catch (e: any) {
      const msg = typeof e?.message === "string" && e.message ? e.message : "Impossibile annullare il turno.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vuoi annullare questo turno?</DialogTitle>
          <DialogDescription>
            Annullando il turno, i crediti utilizzati non verranno rimborsati.
            Il lavoratore verrà avvisato dell'annullamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive font-medium">
            Questa operazione non prevede rimborso dei crediti.
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Motivo dell'annullamento <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(null); }}
              placeholder="Indica il motivo. Sarà inviato al lavoratore."
              rows={4}
              maxLength={1000}
              disabled={submitting}
            />
            <div className="text-xs text-muted-foreground">
              Minimo 10 caratteri ({reason.trim().length}/10).
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              disabled={submitting}
              className="mt-0.5"
            />
            <span>Ho capito che i crediti non verranno rimborsati.</span>
          </label>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            No, torna indietro
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="gap-1"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Annulla turno senza rimborso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}