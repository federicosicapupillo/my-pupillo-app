import { useEffect, useState } from 'react';
import { CurriculumStars } from '@/components/CurriculumStars';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CV_STATUS } from '@/lib/curriculum-assessment';
import type { Database } from '@/integrations/supabase/types';
import { useCurriculumAnalysis } from '@/lib/use-curriculum-analysis';

export function CurriculumRating({ workerId, compact = false }: { workerId: string; compact?: boolean }) {
  const [rating, setRating] = useState<{ stars: number; role_label: string; reviewed_at: string } | null>(null);
  useEffect(() => {
    let active = true;
    setRating(null);
    void supabase.rpc('get_worker_curriculum_rating', { _worker_id: workerId }).then(({ data }) => { if (active) setRating(data?.[0] ?? null); });
    return () => { active = false; };
  }, [workerId]);
  if (!rating) return null;
  if (compact) return <div className="mt-2 space-y-1">
    <p className="text-xs font-medium">Curriculum valutato da Pupillo</p>
    <div className="flex flex-wrap items-center gap-2"><CurriculumStars stars={rating.stars} /><span className="text-xs text-muted-foreground">{rating.role_label}</span></div>
  </div>;
  return <section className="space-y-2 border-y py-4">
    <h3 className="font-semibold">Curriculum valutato da Pupillo</h3>
    <div className="flex flex-wrap items-center gap-2">
      <CurriculumStars stars={rating.stars} /><span className="text-sm">{rating.role_label}</span>
    </div>
    <p className="text-xs text-muted-foreground">Valutazione automatica delle informazioni dichiarate nel curriculum, non delle prestazioni sul lavoro. Non costituisce verifica delle esperienze né recensione di un turno svolto.</p>
    <p className="text-xs text-muted-foreground">La valutazione è visibile ai ristoratori sul profilo del lavoratore ed è separata dal Reputation Score delle recensioni dei turni.</p>
  </section>;
}

type Assessment = Database['public']['Tables']['worker_curriculum_assessments']['Row'];
export function CurriculumAssessmentRequest({ userId, curriculumPath }: { userId: string; curriculumPath: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loadError, setLoadError] = useState(false);
  async function load() {
    const { data, error } = await supabase.from('worker_curriculum_assessments').select('*').eq('user_id',userId).maybeSingle();
    setLoadError(!!error);
    if (!error) setAssessment(data);
  }
  useEffect(() => { setAssessment(null); void load(); }, [userId, curriculumPath]);
  const { analyzing, analysisError, run } = useCurriculumAnalysis(assessment, assessment?.curriculum_path === curriculumPath, load);
  const active = assessment?.consent_at && assessment.curriculum_path === curriculumPath;
  return <section className="space-y-3 pt-3">
    <h4 className="font-medium">Valutazione curriculum Pupillo</h4>
    <p className="text-sm text-muted-foreground">Pupillo valuta il curriculum secondo criteri di esperienza, competenze, responsabilità, formazione e informazioni sufficienti. Vedrai sempre il punteggio nella dashboard. Con il tuo consenso, una nuova valutazione da 4 o 5 stelle sarà visibile automaticamente ai ristoratori; il documento rimane privato.</p>
    {loadError ? <p role="alert" className="text-sm text-destructive">Impossibile leggere la valutazione. <Button type="button" variant="outline" onClick={() => void load()}>Riprova</Button></p> : <>
      {active && assessment && <>
        <p className="text-sm">{analyzing ? 'Analisi in corso' : CV_STATUS[assessment.status] ?? 'In verifica'} · {assessment.role_label}</p>
        {assessment.total != null && <div className="flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">Punteggio curriculum: {assessment.total}/100{assessment.stars ? '' : ' · non pubblicabile'}.</p>{assessment.stars && <CurriculumStars stars={assessment.stars} />}</div>}
        {(analysisError || assessment.error_message) && <p role="alert" className="text-sm text-destructive">{analysisError || assessment.error_message}</p>}
        {assessment.status === 'error' && <Button type="button" variant="outline" disabled={analyzing} onClick={() => void run()}>Riprova analisi</Button>}
        {assessment.status === 'approved' && !assessment.stars && <p className="text-sm text-muted-foreground">Il tuo curriculum non verrà pubblicato.</p>}
      </>}
      {!active && <p className="text-sm text-muted-foreground">Carica un nuovo curriculum con il consenso alla valutazione automatica.</p>}
    </>}
  </section>;
}