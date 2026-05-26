import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";

const REASONS: { value: string; label: string }[] = [
  { value: "non_uso_piu", label: "Non uso più Pupillo" },
  { value: "poche_offerte", label: "Ho trovato poche offerte / pochi lavoratori" },
  { value: "problemi_turno", label: "Ho avuto problemi con un turno" },
  { value: "problemi_utente", label: "Ho avuto problemi con un utente" },
  { value: "difficile_usare", label: "La piattaforma è difficile da usare" },
  { value: "problemi_notifiche", label: "Problemi con notifiche, chat o candidatura" },
  { value: "problemi_pagamenti", label: "Problemi con pagamenti o crediti" },
  { value: "proteggere_dati", label: "Voglio proteggere meglio i miei dati" },
  { value: "altro_account", label: "Ho creato un altro account" },
  { value: "altro", label: "Altro" },
  { value: "non_rispondo", label: "Preferisco non rispondere" },
];

type Step = "confirm" | "reason" | "final" | "blocked" | "done";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("confirm");
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string>("");

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
    setBusy(true);
    const payloadReason = reason || undefined;
    const payloadCustom = reason === "altro" ? (customReason.trim().slice(0, 500) || undefined) : undefined;
    const { data, error } = await supabase.rpc("delete_my_account", {
      _reason: payloadReason,
      _custom_reason: payloadCustom,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Errore durante l'eliminazione dell'account.");
      return;
    }
    const res = (data as { ok: boolean; error_code?: string; message?: string } | null) ?? null;
    if (!res?.ok) {
      setBusy(false);
      if (res?.error_code === "active_shifts") {
        setBlockedMessage(res.message || "Hai ancora turni attivi.");
        setStep("blocked");
        return;
      }
      toast.error(res?.message || "Impossibile eliminare l'account adesso.");
      return;
    }
    setStep("done");
    setBusy(false);
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
                La tua risposta ci aiuta a migliorare Pupillo. Puoi anche scegliere di non rispondere.
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
              <Button variant="destructive" onClick={() => setStep("final")}>Continua</Button>
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
                {busy ? "Eliminazione…" : "Elimina definitivamente"}
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
                Il tuo account è stato eliminato correttamente. Le recensioni già inviate resteranno visibili in forma anonima, come previsto dalle regole della piattaforma.
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