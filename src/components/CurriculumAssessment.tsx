import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { requestCvAssessment } from '@/lib/curriculum-assessment.functions';
import { CV_STATUS } from '@/lib/curriculum-assessment';
import { JOB_ROLES } from '@/lib/job-roles';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

export function CurriculumRating({ workerId }: { workerId: string }) {
  const [rating, setRating] = useState<{ stars: number; role_label: string; reviewed_at: string } | null>(null);
  useEffect(() => {
    let active = true;
    setRating(null);
    void supabase.rpc('get_worker_curriculum_rating', { _worker_id: workerId }).then(({ data }) => { if (active) setRating(data?.[0] ?? null); });
    return () => { active = false; };
  }, [workerId]);
  if (!rating) return null;
  return <section className="space-y-2 border-y py-4">
    <h3 className="font-semibold">Curriculum valutato da Pupillo</h3>
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex gap-1 text-primary" role="img" aria-label={`${rating.stars} stelle su 5`}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-5 w-5 ${i < rating.stars ? 'fill-current' : 'text-muted-foreground'}`} />)}
      </span><span className="text-sm">{rating.stars}/5 · {rating.role_label}</span>
    </div>
    <p className="text-xs text-muted-foreground">Valutazione delle informazioni dichiarate nel curriculum, non delle prestazioni sul lavoro. Non costituisce verifica delle esperienze né recensione di un turno svolto.</p>
    <p className="text-xs text-muted-foreground">La valutazione è visibile ai ristoratori sul profilo del lavoratore ed è separata dal Reputation Score delle recensioni dei turni.</p>
  </section>;
}

type Assessment = Database['public']['Tables']['worker_curriculum_assessments']['Row'];
export function CurriculumAssessmentRequest({ userId, curriculumPath }: { userId: string; curriculumPath: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [role, setRole] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const request = useServerFn(requestCvAssessment);
  async function load() {
    const { data, error } = await supabase.from('worker_curriculum_assessments').select('*').eq('user_id',userId).maybeSingle();
    setLoadError(!!error);
    if (!error) setAssessment(data);
  }
  useEffect(() => { setAssessment(null); setConsent(false); void load(); }, [userId, curriculumPath]);
  async function submit() {
    setBusy(true);
    try {
      const result = await request({ data: { role, consent: true } });
      if (!result.ok) { toast.error(result.error); return; }
      await load(); toast.success('Richiesta inviata a Pupillo.');
    } catch { toast.error('Invio non riuscito. Riprova.'); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('withdraw_curriculum_assessment');
      if (error) toast.error('Revoca non riuscita. Riprova.');
      else { await load(); setConsent(false); toast.success('Consenso revocato: la valutazione non è più visibile.'); }
    } finally { setBusy(false); }
  }
  const active = assessment?.consent_at && assessment.curriculum_path === curriculumPath;
  const canRequest = !active || ['rejected','not_evaluable','stale','error'].includes(assessment?.status ?? '');
  return <section className="space-y-3 pt-3">
    <h4 className="font-medium">Valutazione curriculum Pupillo</h4>
    <p className="text-sm text-muted-foreground">Dopo l’approvazione di Pupillo, la valutazione da 4 o 5 stelle sarà visibile nella tua dashboard e ai ristoratori sul tuo profilo, separata dalle recensioni dei turni. Il completamento dell’onboarding non comporta la pubblicazione automatica.</p>
    {loadError ? <p role="alert" className="text-sm text-destructive">Impossibile leggere la valutazione. <Button type="button" variant="outline" onClick={() => void load()}>Riprova</Button></p> : <>
      {active && assessment && <>
        <p className="text-sm">{CV_STATUS[assessment.status] ?? 'In verifica'} · {assessment.role_label}</p>
        {assessment.total != null && <p className="text-sm text-muted-foreground">Punteggio proposto: {assessment.total}/100{assessment.stars ? ` · ${assessment.stars}/5` : ' · non pubblicabile'}.</p>}
        {assessment.error_message && <p role="alert" className="text-sm text-destructive">{assessment.error_message}</p>}
        <Button type="button" variant="outline" disabled={busy} onClick={() => void withdraw()}>Revoca consenso</Button>
      </>}
      {canRequest && <>
        <Label htmlFor={`cv-role-${userId}`}>Mansione da valutare</Label>
        <Select value={role} onValueChange={setRole}><SelectTrigger id={`cv-role-${userId}`}><SelectValue placeholder="Seleziona mansione" /></SelectTrigger><SelectContent>{JOB_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
        <div className="flex items-start gap-2"><Checkbox id={`cv-consent-${userId}`} checked={consent} onCheckedChange={v => setConsent(v === true)} /><Label htmlFor={`cv-consent-${userId}`} className="text-xs leading-relaxed">Acconsento all’analisi del curriculum tramite IA e alla verifica da parte di Pupillo. Autorizzo la pubblicazione nella mia dashboard e sul mio profilo, visibile ai ristoratori, solo di una valutazione approvata da 4 o 5 stelle, distinta dalle recensioni dei turni. Posso revocare il consenso in qualsiasi momento.</Label></div>
        <Button type="button" disabled={!role || !consent || busy || loadError} onClick={() => void submit()}>{busy ? 'Invio in corso…' : 'Richiedi valutazione'}</Button>
      </>}
    </>}
  </section>;
}