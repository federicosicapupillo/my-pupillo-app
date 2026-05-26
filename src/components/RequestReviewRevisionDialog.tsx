import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Mail } from "lucide-react";

const SUPPORT_EMAIL = "supporto@pupillo.life";
const MIN_LEN = 30;
const MAX_LEN = 2000;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string;
  targetId: string; // chi ha ricevuto la recensione (= requester)
  authorId: string; // chi ha scritto la recensione contestata
  reviewSummary?: string; // breve descrizione es. "Recensione di Mario Rossi del 12/05/2026"
  onSubmitted?: () => void;
};

export function RequestReviewRevisionDialog({
  open, onOpenChange, reviewId, targetId, authorId, reviewSummary, onSubmitted,
}: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<{ id: string; status: string; created_at: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      const { data } = await (supabase as any)
        .from("review_revision_requests")
        .select("id, status, created_at")
        .eq("review_id", reviewId)
        .eq("requester_id", targetId)
        .maybeSingle();
      if (!cancelled) {
        setExisting((data as any) ?? null);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, reviewId, targetId]);

  const reasonLen = reason.trim().length;
  const canSubmit = reasonLen >= MIN_LEN && reasonLen <= MAX_LEN && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato.");
        setSubmitting(false);
        return;
      }
      // 1) Salva richiesta nel database
      const { data: created, error: insErr } = await (supabase as any)
        .from("review_revision_requests")
        .insert({
          review_id: reviewId,
          requester_id: user.id,
          target_id: authorId,
          reason: reason.trim(),
        })
        .select("id")
        .single();
      if (insErr) {
        if (String(insErr.message).toLowerCase().includes("unique")) {
          toast.error("Hai già inviato una richiesta di revisione per questa recensione.");
        } else {
          toast.error("Errore durante l'invio della richiesta.");
        }
        setSubmitting(false);
        return;
      }

      // 2) Crea ticket di supporto collegato (admin lo vedrà nel pannello supporto)
      const ticketMsg =
        `Richiesta di revisione recensione\n\n` +
        `ID recensione: ${reviewId}\n` +
        `ID richiesta: ${created?.id ?? "—"}\n` +
        (reviewSummary ? `Dettagli: ${reviewSummary}\n` : "") +
        `\nMotivazioni dell'utente:\n${reason.trim()}`;
      const { data: ticket } = await (supabase as any)
        .from("support_tickets")
        .insert({
          user_id: user.id,
          category: "revisione_recensione",
          message: ticketMsg,
          page_url: typeof window !== "undefined" ? window.location.href : null,
        })
        .select("id")
        .single();

      if (ticket?.id) {
        await (supabase as any)
          .from("review_revision_requests")
          .update({ support_ticket_id: ticket.id })
          .eq("id", created!.id);
      }

      // 3) Apri client email pre-compilato verso supporto@pupillo.life
      const subject = `Richiesta revisione recensione — ID ${created?.id ?? reviewId}`;
      const body =
        `Ciao team Pupillo,\n\n` +
        `richiedo la revisione della recensione ricevuta.\n\n` +
        `ID recensione: ${reviewId}\n` +
        `ID richiesta: ${created?.id ?? "—"}\n` +
        (reviewSummary ? `Dettagli: ${reviewSummary}\n` : "") +
        `\nMotivazioni:\n${reason.trim()}\n\n` +
        `Grazie.`;
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      try {
        if (typeof window !== "undefined") window.location.href = mailto;
      } catch { /* non bloccante */ }

      toast.success("Richiesta inviata al supporto. Verrai contattato via email.");
      onSubmitted?.();
      onOpenChange(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Richiedi revisione della recensione
          </DialogTitle>
          <DialogDescription>
            Se ritieni che questa recensione sia ingiusta, scorretta o contenga informazioni false,
            puoi richiederne la revisione al team Pupillo. La richiesta sarà inviata a{" "}
            <strong>{SUPPORT_EMAIL}</strong> e valutata da un operatore.
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="py-4 text-sm text-muted-foreground">Verifica in corso…</div>
        ) : existing ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Hai già inviato una richiesta di revisione per questa recensione il{" "}
            <strong>{new Date(existing.created_at).toLocaleDateString("it-IT")}</strong>.
            <br />
            Stato attuale: <strong>{existing.status}</strong>. Il team ti contatterà via email.
          </div>
        ) : (
          <div className="space-y-3">
            {reviewSummary && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {reviewSummary}
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="revision-reason" className="text-sm font-medium">
                Motivazioni della richiesta <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="revision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, MAX_LEN))}
                placeholder="Spiega in modo chiaro e dettagliato perché ritieni che questa recensione debba essere revisionata (es. fatti non veri, linguaggio offensivo, valutazione non coerente con quanto accaduto)."
                rows={6}
                className="resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {reasonLen < MIN_LEN
                    ? `Minimo ${MIN_LEN} caratteri (${MIN_LEN - reasonLen} mancanti)`
                    : "Lunghezza adeguata"}
                </span>
                <span>{reasonLen}/{MAX_LEN}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Dopo l'invio si aprirà il tuo client email per inoltrare automaticamente la richiesta a{" "}
                <strong>{SUPPORT_EMAIL}</strong>. La richiesta è già stata registrata nel sistema.
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {existing ? "Chiudi" : "Annulla"}
          </Button>
          {!existing && (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? "Invio…" : "Invia richiesta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}