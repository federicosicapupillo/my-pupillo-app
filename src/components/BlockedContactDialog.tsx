import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Calendar, Clock, MapPin, Star, User as UserIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import type { ActionShift } from "@/lib/required-reviews";

type Props = {
  open: boolean;
  onClose: () => void;
  shifts: ActionShift[];
};

const KIND_LABEL: Record<ActionShift["kind"], string> = {
  to_close: "Da chiudere",
  review_pending: "Recensione da inviare",
};
const KIND_CLS: Record<ActionShift["kind"], string> = {
  to_close: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  review_pending: "bg-destructive/15 text-destructive border-destructive/30",
};

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatTime(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  const s = start ? start.slice(0, 5) : "—";
  const e = end ? end.slice(0, 5) : null;
  return e ? `${s} – ${e}` : s;
}

/**
 * Modal mostrato al ristoratore quando prova a contattare un nuovo lavoratore
 * mentre ha turni terminati ancora aperti / non recensiti.
 */
export function BlockedContactDialog({ open, onClose, shifts }: Props) {
  const navigate = useNavigate();
  const count = shifts.length;
  const firstShiftId = shifts[0]?.shift_id ?? null;

  const goToReview = () => {
    onClose();
    navigate({
      to: "/shifts",
      search: firstShiftId
        ? ({ tab: "to-review", shift: firstShiftId } as never)
        : ({ tab: "to-review" } as never),
    });
  };

  const goToShifts = () => {
    onClose();
    navigate({ to: "/shifts" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Recensioni mancanti
          </DialogTitle>
          <DialogDescription>
            Puoi continuare a chattare con i lavoratori, ma prima di assegnare nuovi turni devi chiudere i turni conclusi e lasciare le recensioni mancanti.
          </DialogDescription>
        </DialogHeader>

        {count > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            Hai {count} turn{count > 1 ? "i" : "o"} da chiudere prima di poter assegnare nuovi lavoratori.
          </div>
        )}

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {shifts.map((s) => (
            <div key={s.shift_id} className="rounded-xl border bg-card p-3 flex gap-3">
              <UserAvatar userId={s.worker_id} name={s.worker_name} className="h-10 w-10 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {s.worker_name ?? "Lavoratore"}
                  </div>
                  <Badge variant="outline" className={`text-xs ${KIND_CLS[s.kind]}`}>
                    {KIND_LABEL[s.kind]}
                  </Badge>
                </div>
                {s.worker_role && (
                  <div className="text-xs text-muted-foreground capitalize">{s.worker_role}</div>
                )}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDate(s.service_date)}
                  <span className="mx-1">·</span>
                  <Clock className="h-3 w-3" /> {formatTime(s.service_time, s.end_time)}
                </div>
                {(s.venue_name || s.location_address) && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {[s.venue_name, s.location_address].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:flex-1">
            Continua a chattare
          </Button>
          <Button onClick={goToReview} className="gap-1.5 sm:flex-1">
            <Star className="h-4 w-4" />
            Chiudi turno e lascia recensione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
