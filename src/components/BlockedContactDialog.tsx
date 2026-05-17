import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Calendar, Clock, MapPin, Star, User as UserIcon, Timer } from "lucide-react";
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

function daysLate(deadlineIso: string | null): number {
  if (!deadlineIso) return 0;
  const ms = Date.now() - new Date(deadlineIso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

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
  const overdue = shifts.filter((s) => s.is_overdue);
  const hasOverdue = overdue.length > 0;
  const list = hasOverdue ? overdue : shifts;
  const count = list.length;
  const firstShiftId = list[0]?.shift_id ?? null;

  const goToReview = () => {
    onClose();
    navigate({
      to: "/shifts",
      search: firstShiftId
        ? ({ tab: "to-review", shift: firstShiftId } as never)
        : ({ tab: "to-review" } as never),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !hasOverdue) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {hasOverdue ? "Recensione obbligatoria" : "Recensioni da completare"}
          </DialogTitle>
          <DialogDescription>
            {hasOverdue
              ? "Hai turni conclusi da più di 3 giorni senza recensione. Per continuare a usare l'app devi chiudere i turni completati e lasciare la recensione ai lavoratori."
              : "Hai turni conclusi da chiudere e recensire. Hai 3 giorni di tempo dalla fine di ciascun turno."}
          </DialogDescription>
        </DialogHeader>

        {count > 0 && (
          <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            hasOverdue
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
          }`}>
            Hai {count} turn{count > 1 ? "i" : "o"} {hasOverdue ? "scaduti da recensire" : "da recensire"}.
          </div>
        )}

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {list.map((s) => {
            const late = daysLate(s.review_deadline);
            return (
            <div key={s.shift_id} className={`rounded-xl border p-3 flex gap-3 ${s.is_overdue ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
              <UserAvatar userId={s.worker_id} name={s.worker_name} className="h-10 w-10 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {s.worker_name ?? "Lavoratore"}
                  </div>
                  <Badge variant="outline" className={`text-xs ${s.is_overdue ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"}`}>
                    {s.is_overdue ? "Recensione mancante" : "Da recensire"}
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
                {s.is_overdue && late > 0 && (
                  <div className="text-xs font-medium text-destructive flex items-center gap-1">
                    <Timer className="h-3 w-3" /> In ritardo di {late} giorn{late === 1 ? "o" : "i"}
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!hasOverdue && (
            <Button variant="outline" onClick={onClose} className="sm:flex-1">
              Continua a chattare
            </Button>
          )}
          {hasOverdue && (
            <Button variant="outline" onClick={() => { onClose(); navigate({ to: "/shifts" }); }} className="sm:flex-1">
              Vai ai miei turni
            </Button>
          )}
          <Button onClick={goToReview} className="gap-1.5 sm:flex-1">
            <Star className="h-4 w-4" />
            {hasOverdue ? "Recensisci ora" : "Chiudi turno e lascia recensione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
