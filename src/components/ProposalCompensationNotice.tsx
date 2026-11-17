import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { proposalCompensation } from "@/lib/proposal-compensation";
import { formatEuroRate } from "@/lib/hourly-rate-guidance";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export function useProposalCompensation(workerId: string | undefined, announcementId: string | undefined, amount: number | string | null | undefined, tariffType: string | null | undefined) {
  const [loaded, setLoaded] = useState<{ workerId: string; rate: number | null } | null>(null);
  const [error, setError] = useState(false);
  const [acceptedKey, setAcceptedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;
    setLoaded(null);
    setError(false);
    setAcceptedKey(null);
    void supabase.from("public_profiles").select("hourly_rate").eq("id", workerId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setError(true); return; }
      setLoaded({ workerId, rate: data.hourly_rate });
    });
    return () => { cancelled = true; };
  }, [workerId, announcementId]);
  const loading = !!workerId && !error && loaded?.workerId !== workerId;
  const terms = proposalCompensation(amount, tariffType, loaded && loaded.workerId === workerId ? loaded.rate : null);
  const key = `${announcementId}:${workerId}:${terms.announced}:${terms.worker}`;
  const accepted = acceptedKey === key;
  return { ...terms, loading, error, accepted, setAccepted: (value: boolean) => setAcceptedKey(value ? key : null), canSend: !loading && !error && !terms.needsExactRate && (!terms.needsAgreement || accepted) };
}

export function ProposalCompensationNotice({ terms }: { terms: ReturnType<typeof useProposalCompensation> }) {
  if (terms.loading) return <p role="status" className="text-sm text-muted-foreground">Verifica del compenso richiesto…</p>;
  if (terms.error) return <p role="alert" className="text-sm text-destructive">Non è stato possibile verificare il compenso del lavoratore. Chiudi e riapri la proposta per riprovare.</p>;
  if (!terms.higher) return null;
  if (terms.needsExactRate) return <p role="alert" className="text-sm text-foreground">Il lavoratore richiede oltre 30 €/h netti. Concordate prima un importo preciso e aggiornate il compenso del profilo prima di inviare la proposta.</p>;
  return (
    <div className="space-y-3 border-l-4 border-primary bg-muted/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 shrink-0 text-primary" aria-hidden="true" />Il lavoratore richiede un compenso più alto</p>
      <p>L’annuncio indica {formatEuroRate(terms.announced ?? 0)} €/h. Il lavoratore richiede <strong>{formatEuroRate(terms.worker ?? 0)} €/h netti</strong>: inviando la proposta accetti questo compenso per il turno, non quello dell’annuncio.</p>
      <p className="text-xs text-muted-foreground">È il compenso del lavoratore, non un pagamento a Pupillo né il costo complessivo per il locale.</p>
      <Label className="flex cursor-pointer items-start gap-2 leading-relaxed">
        <Checkbox checked={terms.accepted} onCheckedChange={(value) => terms.setAccepted(value === true)} className="mt-0.5 shrink-0" />
        Accetto il compenso di {formatEuroRate(terms.worker ?? 0)} €/h netti per questo lavoratore
      </Label>
    </div>
  );
}