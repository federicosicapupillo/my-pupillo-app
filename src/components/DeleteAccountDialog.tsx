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
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

type DeletionImpact = {
  announcements: number;
  applications: number;
  proposals: number;
  assigned_shifts: number;
  imminent_shifts: number;
  completed_shifts: number;
};

type DeletionReason =
  | "non_uso_piu"
  | "lavoro_altro_modo"
  | "problemi_piattaforma"
  | "problemi_notifiche_chat"
  | "problemi_pagamenti_crediti"
  | "cancellare_dati"
  | "altro";

const REASONS: { value: DeletionReason; label: string }[] = [
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
  const [reason, setReason] = useState<DeletionReason | "">("");
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string>("");
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [shiftsConfirmed, setShiftsConfirmed] = useState(false);
  const [cleanupPartial, setCleanupPartial] = useState(false);
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_my_account_deletion_impact" as never);
      if (cancelled || error) return;
      const payload = data as unknown as (DeletionImpact & { ok?: boolean }) | null;
      if (payload?.ok) setImpact(payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setStep("confirm");
    setReason("");
    setCustomReason("");
    setConfirmText("");
    setBusy(false);
    setBlockedMessage("");
    setUnderstood(false);
    setShiftsConfirmed(false);
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
    if (!understood) {
      toast.error("Devi confermare di aver compreso le conseguenze dell'eliminazione.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const payloadReason = reason;
    const payloadCustom = reason === "altro" ? (customReason.trim().slice(0, 500) || undefined) : undefined;
    let res: { ok: boolean; error_code?: string; message?: string } | null = null;
    try {
      res = await deleteAccountFn({
        data: { reason: payloadReason, customReason: payloadCustom, confirmActiveShifts: shiftsConfirmed },
      });
    } catch {
      setBusy(false);
      toast.error("Non è stato possibile eliminare l'account. Riprova o contatta l'assistenza.");
      return;
    }
    if (!res?.ok) {
      setBusy(false);
      if (res?.error_code === "active_shifts_confirmation_required") {
        if ((res as { impact?: DeletionImpact }).impact) {
          setImpact((res as { impact?: DeletionImpact }).impact ?? null);
        }
        setBlockedMessage(
          res.message ||
            "Alcuni lavoratori sono già stati assegnati a turni imminenti o in corso. Eliminando il profilo, questi turni saranno annullati e i lavoratori verranno avvisati.",
        );
        setStep("blocked");
        return;
      }
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
    const partial = (res as { cleanup_status?: string }).cleanup_status === "partial";
    setCleanupPartial(partial);
    if (partial) {
      toast.warning("Profilo eliminato. Alcune operazioni di annullamento sono ancora in corso.");
    } else {
      toast.success("Account eliminato correttamente.");
    }
    setBusy(false);
    logoutTimerRef.current = window.setTimeout(() => {
      void finishAndExit();
    }, 1200);
  };

  const finishAndExit = async () => {
    try {
      await signOut();
    } finally {
      onOpenChange(false);
      nav({ to: "/" });
    }
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
              <RadioGroup value={reason} onValueChange={(value) => setReason(value as DeletionReason)} className="space-y-2">
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
            {impact && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Eliminando il tuo account:</p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  <li>{impact.announcements} annunci verranno annullati e rimossi dalle ricerche</li>
                  <li>{impact.applications} candidature verranno annullate</li>
                  <li>{impact.proposals} proposte inviate non saranno più accettabili</li>
                  <li>{impact.assigned_shifts} turni assegnati saranno annullati e i lavoratori avvisati</li>
                  <li>{impact.completed_shifts} turni già conclusi resteranno nello storico in forma anonimizzata</li>
                </ul>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="delete-understood"
                checked={understood}
                onCheckedChange={(v) => setUnderstood(v === true)}
              />
              <Label htmlFor="delete-understood" className="text-sm font-normal leading-snug">
                Ho compreso che gli annunci e i turni futuri saranno annullati.
              </Label>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("reason")} disabled={busy}>Indietro</Button>
              <Button
                variant="destructive"
                disabled={busy || confirmText !== "ELIMINA" || !understood}
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
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Hai turni ancora attivi
              </DialogTitle>
              <DialogDescription>{blockedMessage}</DialogDescription>
            </DialogHeader>
            {impact && (
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                <li>{impact.announcements} annunci attivi</li>
                <li>{impact.applications} candidature pendenti</li>
                <li>{impact.proposals} proposte inviate</li>
                <li>{impact.assigned_shifts} turni assegnati</li>
                <li>{impact.imminent_shifts} turni imminenti o in corso</li>
              </ul>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="delete-shifts-confirm"
                checked={shiftsConfirmed}
                onCheckedChange={(v) => setShiftsConfirmed(v === true)}
              />
              <Label htmlFor="delete-shifts-confirm" className="text-sm font-normal leading-snug">
                Confermo l'annullamento dei turni e l'eliminazione dell'account
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>Annulla</Button>
              <Button variant="destructive" disabled={busy || !shiftsConfirmed} onClick={submit}>
                {busy ? "Eliminazione in corso…" : "Elimina definitivamente il profilo"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>{cleanupPartial ? "Profilo eliminato — completamento in corso" : "Account eliminato"}</DialogTitle>
              <DialogDescription>
                {cleanupPartial
                  ? "Il tuo profilo è stato eliminato e i tuoi annunci non sono più visibili. L'annullamento di alcune candidature o turni non è stato completato: verrà finalizzato automaticamente e l'assistenza è già stata avvisata."
                  : "Account eliminato correttamente. Le recensioni già inviate resteranno visibili in forma anonima, come previsto dalle regole della piattaforma."}
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