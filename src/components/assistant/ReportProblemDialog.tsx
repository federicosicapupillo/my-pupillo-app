import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TICKET_CATEGORIES } from "@/lib/assistant-kb";
import { createSupportTicket } from "@/lib/assistant.functions";

export function ReportProblemDialog({
  open,
  onOpenChange,
  pageUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageUrl: string;
}) {
  const [category, setCategory] = useState<string>("Altro");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = useServerFn(createSupportTicket);

  const onSubmit = async () => {
    if (message.trim().length < 5) {
      toast.error("Descrivi il problema con almeno qualche parola.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({ data: { category, message: message.trim(), pageUrl } });
      toast.success("Segnalazione inviata. Grazie!");
      setMessage("");
      setCategory("Altro");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore invio segnalazione");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Segnala un problema</DialogTitle>
          <DialogDescription>
            Raccontaci cosa non funziona. Il team riceverà la tua segnalazione con la pagina in cui ti trovi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cosa è successo? Quando? Che messaggio hai visto?"
              maxLength={4000}
            />
          </div>
          <div className="text-xs text-muted-foreground break-all">
            Pagina: <span className="font-mono">{pageUrl || "/"}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annulla</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Invio…" : "Invia segnalazione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}