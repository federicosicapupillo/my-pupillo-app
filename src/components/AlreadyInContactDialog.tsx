import { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  applicationId: string | null;
  onClose: () => void;
};

/**
 * Popup mostrato quando lavoratore e ristoratore risultano già in contatto
 * per lo stesso annuncio/turno (candidatura o proposta attiva).
 */
export function AlreadyInContactDialog({ open, applicationId, onClose }: Props) {
  const navigate = useNavigate();
  const openChat = () => {
    if (!applicationId) {
      onClose();
      return;
    }
    onClose();
    navigate({ to: "/messages/$id", params: { id: applicationId } });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Siete già in contatto</DialogTitle>
          <DialogDescription>
            Esiste già una richiesta o una conversazione attiva per questo turno.
            Puoi continuare dalla chat o attendere la risposta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Ho capito</Button>
          <Button onClick={openChat} disabled={!applicationId} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Apri chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}