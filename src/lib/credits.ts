import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function consumeCredits(amount: number, reason: string, referenceId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_credits", {
    _amount: amount,
    _reason: reason,
    ...(referenceId ? { _reference_id: referenceId } : {}),
  });
  if (error) {
    toast.error(`Errore crediti: ${error.message}`);
    return false;
  }
  if (data === false) {
    toast.error(`Crediti insufficienti (${amount} richiesti). Acquista crediti per continuare.`, {
      action: { label: "Acquista", onClick: () => { window.location.href = "/billing"; } },
    });
    return false;
  }
  return true;
}