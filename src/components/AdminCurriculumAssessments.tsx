import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { analyzeCvAssessment, openAssessmentCurriculum } from '@/lib/curriculum-assessment.functions';
import { CV_CRITERIA, CV_STATUS } from '@/lib/curriculum-assessment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
type Assessment = Database['public']['Tables']['worker_curriculum_assessments']['Row'];
export function AdminCurriculumAssessments() {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const analyze = useServerFn(analyzeCvAssessment);
  const openPdf = useServerFn(openAssessmentCurriculum);
  async function load() {
    const { data, error } = await supabase.from('worker_curriculum_assessments').select('*').not('consent_at','is',null).order('updated_at',{ ascending:false }).limit(100);
    setError(!!error); if (!error) setRows(data ?? []);
    const { data: state } = await supabase.from('curriculum_analysis_service_state').select('paused').eq('id',true).maybeSingle();
    setPaused(!!state?.paused);
  }
  useEffect(() => { void load(); }, []);
  async function action(a: Assessment, approve?: boolean) {
    setBusy(a.user_id);
    try {
      if (approve === undefined) {
        const result = await analyze({ data: { userId:a.user_id, version:a.version } });
        if (!result.ok) toast.error(result.error);
      } else {
        const { error } = await supabase.rpc('review_curriculum_assessment', { _user_id:a.user_id, _version:a.version, _approve:approve, _note:notes[a.user_id] ?? '' });
        if (error) toast.error(error.message); else toast.success(approve ? 'Valutazione pubblicata.' : 'Valutazione non pubblicata.');
      }
      await load();
    } catch { toast.error('Operazione non riuscita. Riprova.'); }
    finally { setBusy(null); }
  }
  async function open(a: Assessment) {
    const tab = window.open('about:blank','_blank'); if (tab) tab.opener=null;
    try {
      const result = await openPdf({ data: { userId:a.user_id, version:a.version } });
      if (!result.url) { tab?.close(); toast.error(result.error); return; }
      if (tab) tab.location.href=result.url;
    } catch { tab?.close(); toast.error('Impossibile aprire il documento.'); }
  }
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Valutazioni curriculum</h2><Button variant="outline" onClick={() => void load()}>Aggiorna</Button></div>
    {error && <p role="alert" className="text-destructive">Impossibile leggere le richieste.</p>}
    {paused && <div className="space-y-2"><p className="text-destructive">Servizio sospeso. Riattiva solo dopo aver risolto la causa indicata.</p><Button variant="outline" onClick={async () => { const { error }=await supabase.rpc('resume_curriculum_analysis'); if(error) toast.error(error.message); else await load(); }}>Confermo il ripristino del servizio</Button></div>}
    {!error && !rows.length && <p className="text-muted-foreground">Nessuna richiesta.</p>}
    {rows.map(a => <article key={a.user_id} className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-medium">{a.role_label} · {CV_STATUS[a.status] ?? 'In verifica'}</h3>
      <p className="text-xs text-muted-foreground">Richiesta del {new Date(a.consent_at ?? a.updated_at).toLocaleString('it-IT')}</p>
      <Button variant="outline" onClick={() => void open(a)}>Apri curriculum autorizzato</Button>
      {a.total != null && <p className="font-semibold">{a.total}/100 · {a.stars ? `${a.stars}/5 proposto` : 'Non pubblicabile'}</p>}
      {a.scores && <dl className="grid gap-2 sm:grid-cols-2">{CV_CRITERIA.map(c => <div key={c.key} className="text-sm"><dt className="text-muted-foreground">{c.label}</dt><dd>{String((a.scores as Record<string,unknown>)[c.key] ?? '—')}/{c.max}</dd></div>)}</dl>}
      {Array.isArray(a.evidence) && a.evidence.map((entry, i) => {
        if (!entry || typeof entry!=='object' || Array.isArray(entry)) return null;
        return <blockquote key={i} className="border-l-2 pl-3 text-sm break-words"><p>«{String(entry.quote ?? '')}»</p><p className="text-muted-foreground">{String(entry.explanation ?? '')}</p></blockquote>;
      })}
      {a.doubts && a.total != null && <p className="text-sm text-destructive">Dubbi da chiarire: pubblicazione bloccata.</p>}
      {a.error_message && <p role="alert" className="text-sm text-destructive">{a.error_message}</p>}
      {['requested','error'].includes(a.status) && <Button disabled={!!busy || paused} onClick={() => void action(a)}>{busy===a.user_id ? 'Analisi in corso…' : 'Analizza curriculum'}</Button>}
      {a.status==='analyzing' && <Button variant="outline" onClick={async () => { const {error}=await supabase.rpc('cancel_curriculum_analysis',{_user_id:a.user_id,_version:a.version}); if(error) toast.error(error.message); else await load(); }}>Interrompi analisi sospesa</Button>}
      {a.status==='pending_review' && <>
        <Input aria-label="Nota di verifica" placeholder="Nota di verifica Pupillo" maxLength={1000} value={notes[a.user_id] ?? ''} onChange={e => setNotes(n => ({...n,[a.user_id]:e.target.value}))} />
        <div className="flex flex-wrap gap-2"><Button disabled={!!busy || !a.stars || a.doubts || (notes[a.user_id]?.trim().length ?? 0)<5} onClick={() => void action(a,true)}>Approva e pubblica</Button><Button variant="outline" disabled={!!busy || (notes[a.user_id]?.trim().length ?? 0)<5} onClick={() => void action(a,false)}>Non pubblicare</Button></div>
      </>}
    </article>)}
  </section>;
}