import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CV_CRITERIA, CV_STATUS, canPublishCurriculum } from '@/lib/curriculum-assessment';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useCurriculumAnalysis } from '@/lib/use-curriculum-analysis';
import { CurriculumStars } from '@/components/CurriculumStars';

type Assessment = Database['public']['Tables']['worker_curriculum_assessments']['Row'];

export function OwnCurriculumAssessment({ workerId }: { workerId: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [current, setCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [result, cv] = await Promise.all([
      supabase.from('worker_curriculum_assessments').select('*').eq('user_id', workerId).maybeSingle(),
      supabase.from('worker_curricula').select('storage_path').eq('user_id', workerId).maybeSingle(),
    ]);
    setError(!!result.error || !!cv.error);
    if (!result.error && !cv.error) {
      setAssessment(result.data);
      setCurrent(!!cv.data && result.data?.curriculum_path === cv.data.storage_path);
    }
    setLoading(false);
  }, [workerId]);
  const { analyzing, analysisError, run } = useCurriculumAnalysis(assessment, current, load);
  useEffect(() => {
    setAssessment(null); setCurrent(false); setLoading(true);
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);
  async function changeVisibility(visible: boolean) {
    if (!assessment) return;
    setBusy(true);
    try {
      const { error: updateError } = await supabase.rpc('set_curriculum_rating_visibility', { _visible: visible, _version: assessment.version });
      if (updateError) toast.error('Non è stato possibile cambiare la visibilità. Aggiorna e riprova.');
      else toast.success(visible ? 'Valutazione visibile ai ristoratori.' : 'Valutazione mantenuta privata.');
      await load();
    } catch { toast.error('Non è stato possibile cambiare la visibilità. Riprova.'); }
    finally { setBusy(false); }
  }
  const active = assessment && current && assessment.consent_at && assessment.status !== 'stale';
  const publishable = !!assessment && canPublishCurriculum(assessment, current);
  const scores = assessment?.scores;
  return <section className="space-y-3 border-t pt-4" aria-label="Valutazione del tuo curriculum">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold">Valutazione curriculum Pupillo</h3>
      <Button type="button" variant="ghost" size="icon" title="Aggiorna valutazione" aria-label="Aggiorna valutazione" disabled={loading || busy} onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    <p className="text-xs text-muted-foreground">Valutazione delle informazioni dichiarate per la mansione scelta, secondo criteri di esperienza, competenze, responsabilità, formazione e informazioni sufficienti. Non è una recensione di un turno e non modifica la media delle recensioni.</p>
    {loading ? <p className="text-sm text-muted-foreground">Caricamento valutazione…</p> : error ? <p role="alert" className="text-sm text-destructive">Impossibile leggere la valutazione. Riprova con il pulsante di aggiornamento.</p> : !active ? <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Non hai una valutazione attiva del curriculum.</p>
      <Link to="/profile"><Button type="button" variant="outline" size="sm">Gestisci curriculum</Button></Link>
    </div> : <>
      <p className="text-sm">{analyzing ? 'Analisi in corso' : CV_STATUS[assessment.status] ?? 'In verifica'} · {assessment.role_label}</p>
      {(analysisError || assessment.error_message) && <p role="alert" className="text-sm text-destructive">{analysisError || assessment.error_message}</p>}
      {assessment.status === 'error' && <Button type="button" variant="outline" disabled={analyzing} onClick={() => void run()}>Riprova analisi</Button>}
      {assessment.total !== null ? <>
        <div className="flex flex-wrap items-center gap-3"><span className="text-3xl font-bold tabular-nums">{assessment.total}<span className="text-base font-normal text-muted-foreground">/100</span></span>{assessment.stars && <CurriculumStars stars={assessment.stars} />}</div>
        <p className="text-xs text-muted-foreground">Punteggio calcolato automaticamente da Pupillo sui criteri indicati, senza verifica manuale delle esperienze dichiarate.</p>
        <dl className="space-y-1 text-xs">{CV_CRITERIA.map(c => {
          const value = scores && typeof scores === 'object' && !Array.isArray(scores) ? scores[c.key] : null;
          return typeof value === 'number' ? <div key={c.key} className="flex justify-between gap-3"><dt>{c.label}</dt><dd className="tabular-nums">{value}/{c.max}</dd></div> : null;
        })}</dl>
      </> : <p className="text-sm text-muted-foreground">{assessment.status === 'not_evaluable' ? 'Non è disponibile un punteggio per questo curriculum.' : 'Il punteggio non è ancora disponibile.'}</p>}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Eye className="h-4 w-4 shrink-0" />{assessment.public_visible && publishable ? 'La valutazione è visibile ai ristoratori sul tuo profilo completato. Il documento rimane privato.' : assessment.status === 'approved' || assessment.status === 'not_evaluable' ? 'Il tuo curriculum non verrà pubblicato.' : 'La valutazione sarà pubblicata solo se raggiunge 4 o 5 stelle e hai dato il consenso.'}</p>
      {publishable && !assessment.auto_publication_consent && <div className="flex items-center gap-3"><Switch id={`cv-public-${workerId}`} checked={assessment.public_visible} disabled={busy} onCheckedChange={v => void changeVisibility(v)} /><Label htmlFor={`cv-public-${workerId}`} className="text-sm">Acconsento a mostrare la valutazione ai ristoratori</Label></div>}
      <Link to="/profile"><Button type="button" variant="outline" size="sm">Sostituisci curriculum</Button></Link>
    </>}
  </section>;
}