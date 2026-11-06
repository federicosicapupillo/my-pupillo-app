import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { analyzeCvAssessment } from '@/lib/curriculum-assessment.functions';
import { shouldStartCurriculumAnalysis } from '@/lib/curriculum-assessment';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['worker_curriculum_assessments']['Row'];

export function useCurriculumAnalysis(assessment: Assessment | null, current: boolean, reload: () => Promise<void>) {
  const analyze = useServerFn(analyzeCvAssessment);
  const attempted = useRef(new Set<string>());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  async function run() {
    if (!assessment || analyzing) return;
    attempted.current.add(assessment.version);
    setAnalyzing(true); setAnalysisError('');
    try {
      const result = await analyze({ data: { userId: assessment.user_id, version: assessment.version } });
      if (!result.ok) setAnalysisError(result.error);
    } catch { setAnalysisError('Analisi non riuscita. Riprova.'); }
    finally { await reload(); setAnalyzing(false); }
  }
  useEffect(() => {
    if (assessment?.status === 'approved' || assessment?.status === 'not_evaluable') setAnalysisError('');
    if (assessment && shouldStartCurriculumAnalysis(assessment.status, assessment.consent_at, current) && !attempted.current.has(assessment.version)) {
      void run();
    }
  }, [assessment?.version, assessment?.status, current]);
  useEffect(() => {
    if (assessment?.status !== 'analyzing') return;
    const timer = window.setInterval(() => void reload(), 4000);
    return () => window.clearInterval(timer);
  }, [assessment?.status, reload]);
  return { analyzing, analysisError, run };
}