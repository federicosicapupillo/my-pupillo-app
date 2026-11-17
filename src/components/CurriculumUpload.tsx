import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { scoreCurriculumPdf } from "@/lib/curriculum.functions";
import { toast } from "sonner";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CurriculumStars } from '@/components/CurriculumStars';
import type { Database } from '@/integrations/supabase/types';

type Pending = Database['public']['Tables']['worker_cv_pending_scores']['Row'];
type Accepted = { stars: number | null; status: string };

export function CurriculumUpload({ userId }: { userId: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const score = useServerFn(scoreCurriculumPdf);

  const load = useCallback(async () => {
    const [a, p, s] = await Promise.all([
      supabase.rpc('my_cv_upload_allowed'),
      supabase.from('worker_cv_pending_scores').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('worker_curriculum_assessments').select('stars,status').eq('user_id', userId).maybeSingle(),
    ]);
    setLoadError(!!(a.error || p.error || s.error));
    setAllowed(!!a.data);
    setPending(p.data ?? null);
    setAccepted(s.data && s.data.status !== 'stale' ? s.data : null);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function select(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set('assessmentConsent', String(consent));
      const result = await score({ data: form });
      if (!result.ok) { toast.error(result.error); return; }
      setConsent(false);
      await load();
      toast.success("Analisi completata. Il PDF è stato scartato.");
    } catch { toast.error("Analisi del curriculum non riuscita. Riprova."); }
    finally { setBusy(false); }
  }

  async function decide(accept: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc(accept ? 'accept_pending_curriculum_score' : 'discard_pending_curriculum_score');
      if (error) toast.error(error.message || 'Operazione non riuscita. Riprova.');
      else toast.success(accept ? 'Punteggio accettato: ora è quello di Pupillo.' : 'Punteggio non accettato.');
      await load();
    } finally { setBusy(false); }
  }

  return <div className="space-y-2 border-t pt-4">
    <h4 className="font-medium">Curriculum <span className="text-sm font-normal text-muted-foreground">(facoltativo)</span></h4>
    {allowed === null ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Caricamento curriculum" /> : loadError ?
      <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-destructive">Impossibile leggere i dati del curriculum.</p><Button type="button" variant="outline" onClick={() => void load()}>Riprova</Button></div> :
    !allowed ? <p className="text-sm text-muted-foreground">Hai già ricevuto recensioni: le tue stelle ora derivano dalle recensioni dei turni e il curriculum non serve più.</p> : <>
      <p className="text-xs text-muted-foreground">PDF · massimo 5 MB. L’IA assegna un punteggio e tu decidi se accettarlo. Il PDF non viene mai conservato: viene scartato subito dopo l’analisi. Il punteggio vale fino alla tua prima recensione, che lo sostituisce.</p>
      {accepted?.stars && <div className="flex items-center gap-2 text-sm"><span>Punteggio attuale:</span><CurriculumStars stars={accepted.stars} /></div>}
      {pending ? <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Punteggio proposto dall’IA</p>
        {pending.evaluable && pending.stars ? <div className="flex flex-wrap items-center gap-3"><CurriculumStars stars={pending.stars} />{pending.total !== null && <span className="text-sm text-muted-foreground tabular-nums">{pending.total}/100</span>}</div>
          : <p className="text-sm text-muted-foreground">Il curriculum non è valutabile: nessuna stella.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" disabled={busy} onClick={() => void decide(true)}><Check className="h-4 w-4" />Accetta</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void decide(false)}><X className="h-4 w-4" />Non accetto</Button>
        </div>
      </div> : <>
        <div className="flex items-start gap-2"><Checkbox id={`upload-cv-consent-${userId}`} checked={consent} disabled={busy} onCheckedChange={v => setConsent(v === true)} /><Label htmlFor={`upload-cv-consent-${userId}`} className="text-xs leading-relaxed">Acconsento all’analisi automatica del curriculum tramite IA: 4 stelle per chi è agli inizi, 5 per almeno due lavori dichiarati o gestione di attività o team. Se accetto il punteggio, sarà visibile ai ristoratori. Le dichiarazioni non sono verificate.</Label></div>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Carica curriculum" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void select(file);
          e.target.value = "";
        }} />
        <Button type="button" variant="outline" disabled={busy || !consent} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? 'Analisi in corso…' : accepted ? 'Carica un nuovo curriculum' : 'Carica curriculum'}
        </Button>
      </>}
    </>}
  </div>;
}
