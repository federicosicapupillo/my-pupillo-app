import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  DELAY_REASONS, DELAY_MINUTE_OPTIONS, CANCEL_REASONS,
  reportDelay, cancelPresence,
} from "@/lib/worker-incidents";

export type IncidentTarget = {
  shiftId: string;
  workerId: string;
  restaurantId: string;
  applicationId?: string | null;
  announcementId?: string | null;
  context: { role?: string | null; date?: string | null; time?: string | null };
};

function MinutesPills({
  value, onChange,
}: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DELAY_MINUTE_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            value === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
          }`}
        >
          {m === 60 ? "60+ minuti" : `${m} minuti`}
        </button>
      ))}
    </div>
  );
}

export function ReportDelayDialog({
  open, onClose, target, onDone,
}: {
  open: boolean;
  onClose: () => void;
  target: IncidentTarget | null;
  onDone?: () => void;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [reason, setReason] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMinutes(null); setReason(""); setCustom(""); setStep("form"); setSubmitting(false);
  };

  const close = () => { reset(); onClose(); };

  const canSubmit =
    minutes !== null &&
    reason !== "" &&
    (reason !== "altro" || custom.trim().length > 0);

  const handleConfirm = async () => {
    if (!target || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await reportDelay({
        workerId: target.workerId,
        restaurantId: target.restaurantId,
        shiftId: target.shiftId,
        applicationId: target.applicationId ?? null,
        announcementId: target.announcementId ?? null,
        estimatedMinutes: minutes!,
        reason,
        customReason: reason === "altro" ? custom : null,
        context: target.context,
      });
      toast.success("Ritardo segnalato correttamente.");
      onDone?.();
      close();
    } catch (e: any) {
      toast.error(e?.message || "Non è stato possibile completare l'operazione. Riprova.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" /> Stai per segnalare un ritardo
              </DialogTitle>
              <DialogDescription>
                Il ristoratore verrà avvisato immediatamente. Il ritardo può influire sul
                compenso finale e sulla tua reputazione su Pupillo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Minuti stimati di ritardo *</Label>
                <div className="mt-2"><MinutesPills value={minutes} onChange={setMinutes} /></div>
              </div>
              <div>
                <Label className="text-sm font-medium">Motivazione *</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DELAY_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition ${
                        reason === r.value ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {reason === "altro" && (
                <div>
                  <Label className="text-sm font-medium">Descrivi la motivazione *</Label>
                  <Textarea
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Specifica il motivo del ritardo"
                    rows={3}
                    className="mt-2"
                    maxLength={500}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={close}>Annulla</Button>
              <Button disabled={!canSubmit} onClick={() => setStep("confirm")}>
                Conferma ritardo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Confermi la segnalazione?
              </DialogTitle>
              <DialogDescription>
                Confermando, il ristoratore verrà avvisato e la segnalazione resterà tracciata
                sul turno.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setStep("form")} disabled={submitting}>
                Indietro
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-1" /> Invio segnalazione…</>) : "Confermo"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CancelPresenceDialog({
  open, onClose, target, onDone,
}: {
  open: boolean;
  onClose: () => void;
  target: IncidentTarget | null;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(""); setCustom(""); setNote(""); setStep("form"); setSubmitting(false);
  };
  const close = () => { reset(); onClose(); };

  const canSubmit = reason !== "" && (reason !== "altro" || custom.trim().length > 0);

  const handleConfirm = async () => {
    if (!target || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await cancelPresence({
        workerId: target.workerId,
        restaurantId: target.restaurantId,
        shiftId: target.shiftId,
        applicationId: target.applicationId ?? null,
        announcementId: target.announcementId ?? null,
        reason,
        customReason: reason === "altro" ? custom : null,
        note: note.trim() || null,
        context: target.context,
      });
      toast.success("Presenza annullata correttamente.");
      onDone?.();
      close();
    } catch (e: any) {
      toast.error(e?.message || "Non è stato possibile completare l'operazione. Riprova.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Vuoi annullare la tua presenza?
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block">
                  Annullare un turno confermato può creare un problema organizzativo al
                  ristoratore. Questa azione può influire sulla tua reputazione e sulla
                  visibilità del tuo profilo nelle ricerche future.
                </span>
                <span className="block">
                  Il compenso potrebbe cambiare o non essere riconosciuto in base allo stato
                  del turno e alle regole della piattaforma.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Motivazione annullamento *</Label>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {CANCEL_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      className={`rounded-lg border px-3 py-2 text-sm text-left transition ${
                        reason === r.value ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {reason === "altro" && (
                <div>
                  <Label className="text-sm font-medium">Descrivi il motivo *</Label>
                  <Textarea
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    rows={3}
                    className="mt-2"
                    maxLength={500}
                  />
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Nota aggiuntiva (facoltativa)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-2"
                  maxLength={500}
                  placeholder="Aggiungi un dettaglio per il ristoratore"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={close}>Indietro</Button>
              <Button variant="destructive" disabled={!canSubmit} onClick={() => setStep("confirm")}>
                Conferma annullamento
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Confermi l'annullamento?
              </DialogTitle>
              <DialogDescription>
                Confermando, il ristoratore verrà avvisato e il turno non risulterà più attivo per te.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setStep("form")} disabled={submitting}>
                Indietro
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-1" /> Annullamento in corso…</>) : "Confermo"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}