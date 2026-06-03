import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendShiftProposal } from "@/lib/shift-proposal";

type AnnouncementSnapshot = {
  id: string;
  service_date: string | null;
  service_time: string | null;
  end_time: string | null;
  tariff_amount: number | string | null;
  tariff_type: string | null;
  professional_profile: string | null;
  notes: string | null;
};

type CounterofferType = "compenso" | "orario" | "data" | "ruolo" | "note" | "piu_condizioni";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  restaurantId: string;
  workerId: string;
  announcement: AnnouncementSnapshot | null;
  onSent?: () => void;
};

const TYPE_OPTIONS: { value: CounterofferType; label: string }[] = [
  { value: "compenso", label: "Compenso" },
  { value: "orario", label: "Orario" },
  { value: "data", label: "Data" },
  { value: "ruolo", label: "Ruolo / mansione" },
  { value: "note", label: "Note operative" },
  { value: "piu_condizioni", label: "Più condizioni" },
];

export function CounterofferDialog({
  open,
  onOpenChange,
  applicationId,
  restaurantId,
  workerId,
  announcement,
  onSent,
}: Props) {
  const [type, setType] = useState<CounterofferType>("compenso");
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => ({
    tariff_amount: announcement?.tariff_amount != null ? String(announcement.tariff_amount) : "",
    service_time: announcement?.service_time ? String(announcement.service_time).slice(0, 5) : "",
    end_time: announcement?.end_time ? String(announcement.end_time).slice(0, 5) : "",
    service_date: announcement?.service_date ?? "",
    professional_profile: announcement?.professional_profile ?? "",
    notes: announcement?.notes ?? "",
  }), [announcement]);

  const [tariff, setTariff] = useState(initial.tariff_amount);
  const [startTime, setStartTime] = useState(initial.service_time);
  const [endTime, setEndTime] = useState(initial.end_time);
  const [date, setDate] = useState(initial.service_date);
  const [role, setRole] = useState(initial.professional_profile);
  const [notes, setNotes] = useState(initial.notes);

  // Reset form values when dialog (re-)opens or announcement changes
  useEffect(() => {
    if (open) {
      setTariff(initial.tariff_amount);
      setStartTime(initial.service_time);
      setEndTime(initial.end_time);
      setDate(initial.service_date);
      setRole(initial.professional_profile);
      setNotes(initial.notes);
      setType("compenso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announcement?.id]);

  const showCompenso = type === "compenso" || type === "piu_condizioni";
  const showOrario = type === "orario" || type === "piu_condizioni";
  const showData = type === "data" || type === "piu_condizioni";
  const showRuolo = type === "ruolo" || type === "piu_condizioni";
  const showNote = type === "note" || type === "piu_condizioni";

  const handleSubmit = async () => {
    if (!announcement) return;
    setSubmitting(true);
    const oldTerms = {
      tariff_amount: announcement.tariff_amount,
      service_time: announcement.service_time,
      end_time: announcement.end_time,
      service_date: announcement.service_date,
      professional_profile: announcement.professional_profile,
      notes: announcement.notes,
    };
    const updates: Record<string, unknown> = {};
    if (showCompenso && tariff && tariff !== initial.tariff_amount) updates.tariff_amount = Number(tariff);
    if (showOrario) {
      if (startTime && startTime !== initial.service_time) updates.service_time = startTime;
      if (endTime && endTime !== initial.end_time) updates.end_time = endTime;
    }
    if (showData && date && date !== initial.service_date) updates.service_date = date;
    if (showRuolo && role && role !== initial.professional_profile) updates.professional_profile = role;
    if (showNote && notes !== initial.notes) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      toast.error("Modifica almeno un campo per inviare la controfferta.");
      setSubmitting(false);
      return;
    }

    try {
      // Update announcement with new terms
      const { error: upErr } = await supabase
        .from("announcements")
        .update(updates as never)
        .eq("id", announcement.id);
      if (upErr) throw upErr;

      // Send a new shift_proposal message — supersedes the previous proposal,
      // worker must accept/reject again, no credits consumed.
      await sendShiftProposal({
        applicationId,
        announcementId: announcement.id,
        restaurantId,
        workerId,
      });

      // Reset application status to pending so the worker can show interest again.
      await supabase
        .from("applications")
        .update({ status: "pending", worker_response_at: null } as never)
        .eq("id", applicationId);

      console.log("[PUPILLO_COUNTEROFFER_FLOW_DEBUG]", {
        proposal_id: null,
        application_id: applicationId,
        announcement_id: announcement.id,
        old_terms: oldTerms,
        new_terms: updates,
        counteroffer_type: type,
        counteroffer_sent: true,
        worker_response: null,
        status_after_counteroffer: "pending",
        credits_consumed: false,
        privacy_unlocked: false,
      });

      toast.success("Controfferta inviata al lavoratore.");
      onOpenChange(false);
      onSent?.();
    } catch (e) {
      console.error("[PUPILLO_COUNTEROFFER_FLOW_DEBUG] error", e);
      if ((e as any)?.name === "WorkerBusyError") {
        toast.error((e as Error).message);
      } else {
        toast.error("Impossibile inviare la controfferta. Riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invia controfferta</DialogTitle>
          <DialogDescription>
            Puoi proporre una modifica al lavoratore. Il servizio sarà confermato solo se il
            lavoratore accetterà e tu confermerai definitivamente. Nessun credito verrà scalato ora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cosa vuoi modificare?</Label>
            <Select value={type} onValueChange={(v) => setType(v as CounterofferType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showCompenso && (
            <div className="space-y-1.5">
              <Label>Nuovo compenso {announcement?.tariff_type === "hourly" ? "(€/ora)" : "(€)"}</Label>
              <Input type="number" min={0} step="0.5" value={tariff} onChange={(e) => setTariff(e.target.value)} />
            </div>
          )}

          {showOrario && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Inizio</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fine</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {showData && (
            <div className="space-y-1.5">
              <Label>Nuova data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          {showRuolo && (
            <div className="space-y-1.5">
              <Label>Ruolo / mansione</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Es. Cameriere di sala" />
            </div>
          )}

          {showNote && (
            <div className="space-y-1.5">
              <Label>Note operative</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Invia controfferta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}