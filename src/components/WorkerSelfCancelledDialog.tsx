import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WORKER_SELF_CANCELLED_MESSAGE } from "@/lib/application-reapply";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Mostrato al lavoratore quando tenta di candidarsi a un'inserzione che lui
 * stesso aveva precedentemente annullato/ritirato. Il lavoratore non può
 * candidarsi nuovamente alla stessa inserzione.
 */
export function WorkerSelfCancelledDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" aria-hidden="true" />
            Candidatura annullata da te
          </DialogTitle>
          <DialogDescription>{WORKER_SELF_CANCELLED_MESSAGE}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Ho capito</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}