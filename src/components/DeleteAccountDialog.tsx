import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";
import { deleteAccount } from "@/lib/account-deletion.functions";

const REASONS: { value: string; label: string }[] = [
  { value: "non_uso_piu", label: "Non uso più Pupillo" },
  { value: "lavoro_altro_modo", label: "Ho trovato lavoro / collaboratori in altro modo" },
  { value: "problemi_piattaforma", label: "Ho avuto problemi con la piattaforma" },
  { value: "problemi_notifiche_chat", label: "Ho problemi con notifiche o chat" },
  { value: "problemi_pagamenti_crediti", label: "Ho problemi con pagamenti o crediti" },
  { value: "cancellare_dati", label: "Voglio cancellare i miei dati" },
  { value: "altro", label: "Altro" },
];

type Step = "confirm" | "reason" | "final" | "blocked" | "done";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const deleteAccountFn = useServerFn(deleteAccount);
  const [step, setStep] = useState<Step>("confirm");
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string>("");
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const reset = () => {
    setStep("confirm");
    setReason("");
    setCustomReason("");
    setConfirmText("");
    setBusy(false);
    setBlockedMessage("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const submit = async () => {
    if (!reason) {
      toast.error("Seleziona il motivo della cancellazione.");
      return;
    }
    if (reason === "altro" && !customReason.trim()) {
      toast.error("Inserisci il motivo della cancellazione.");
      return;
    }
    if (confirmText !== "ELIMINA") {
      toast.error("Per confermare devi scrivere ELIMINA");
      return;
    }
    setBusy(true);
    const payloadReason = reason || undefined;
    const payloadCustom = reason === "altro" ? (customReason.trim().slice(0, 500) || undefined) : undefined;
    let res: { ok: boolean; error_code?: string; message?: string } | null = null;
    try {
      res = await deleteAccountFn({
        data: { reason: payloadReason as Exclude<typeof reason, "">, customReason: payloadCustom },
      });
    } catch {
      setBusy(false);
      toast.error("Non è stato possibile eliminare l'account. Riprova o contatta l'assistenza.");
      return;
    }
    if (!res?.ok) {
      setBusy(false);
      if (res?.error_code === "active_shifts") {
        setBlockedMessage(res.message || "Hai ancora turni attivi.");
        setStep("blocked");
        return;
      }
      if (res?.error_code === "missing_reason") toast.error("Seleziona il motivo della cancellazione.");
      else if (res?.error_code === "missing_custom_reason") toast.error("Inserisci il motivo della cancellazione.");
      else toast.error("Non è stato possibile eliminare l'account. Riprova o contatta l'assistenza.");
      return;
    }
    setStep("done");
    toast.success("Account eliminato correttamente.");
    setBusy(false);
    logoutTimerRef.current = window.setTimeout(() => {
      void finishAndExit();
    }, 1200);
  };

  const finishAndExit = async () => {
    await signOut();
    onOpenChange(false);
    nav({ to: "/" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Eliminare account?
              </DialogTitle>
              <DialogDescription>
                Questa azione è definitiva. Il tuo profilo verrà eliminato e non potrai più accedere a Pupillo con questo account. Le recensioni che hai già inviato resteranno visibili in forma anonima.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Annulla</Button>
              <Button variant="destructive" onClick={() => setStep("reason")}>Continua</Button>
            </DialogFooter>
          </>
        )}

        {step === "reason" && (
          <>
            <DialogHeader>
              <DialogTitle>Perché vuoi eliminare il tuo account?</DialogTitle>
              <DialogDescription>
                La tua risposta ci aiuta a migliorare Pupillo. Seleziona un motivo per continuare.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto">
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {REASONS.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                    <Label htmlFor={`reason-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {reason === "altro" && (
                <div className="mt-3 space-y-1">
                  <Label htmlFor="custom-reason">Scrivi il motivo</Label>
                  <Textarea
                    id="custom-reason"
                    placeholder="Raccontaci brevemente il motivo…"
                    maxLength={500}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value.slice(0, 500))}
                  />
                  <div className="text-xs text-muted-foreground text-right">{customReason.length}/500</div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("confirm")}>Indietro</Button>
              <Button
                variant="destructive"
                disabled={!reason || (reason === "altro" && !customReason.trim())}
                onClick={() => setStep("final")}
              >
                Continua
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "final" && (
          <>
            <DialogHeader>
              <DialogTitle>Conferma eliminazione</DialogTitle>
              <DialogDescription>
                Per confermare, scrivi <strong>ELIMINA</strong> nel campo qui sotto.
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Scrivi ELIMINA"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("reason")} disabled={busy}>Indietro</Button>
              <Button
                variant="destructive"
                disabled={busy || confirmText !== "ELIMINA"}
                onClick={submit}
              >
                {busy ? "Eliminazione in corso…" : "Elimina definitivamente"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "blocked" && (
          <>
            <DialogHeader>
              <DialogTitle>Non puoi eliminare l'account adesso</DialogTitle>
              <DialogDescription>{blockedMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Ho capito</Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Account eliminato</DialogTitle>
              <DialogDescription>
                Account eliminato correttamente. Le recensioni già inviate resteranno visibili in forma anonima, come previsto dalle regole della piattaforma.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={finishAndExit}>Torna alla home</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}