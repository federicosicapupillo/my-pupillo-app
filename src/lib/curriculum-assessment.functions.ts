import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { JOB_ROLES } from '@/lib/job-roles';
import { CURRICULUM_BUCKET, validateCurriculumBytes } from '@/lib/curriculum-file';
import { scoreCurriculum, CV_CRITERIA, CV_RUBRIC_VERSION, automaticCurriculumRole, canAnalyzeCurriculum, shouldAutoPublishCurriculum } from '@/lib/curriculum-assessment';

export const requestCvAssessment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: z.string(), consent: z.literal(true), publicationConsent: z.literal(true) }))
  .handler(async ({ data, context }) => {
    if (!JOB_ROLES.includes(data.role)) return { ok: false, error: 'Seleziona una mansione valida.' };
    const { error } = await context.supabase.rpc('request_auto_public_curriculum_assessment', { _role: data.role, _publication_consent: data.publicationConsent });
    return error ? { ok: false, error: error.message } : { ok: true, error: '' };
  });

export const analyzeCvAssessment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.uuid(), version: z.uuid() }))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    const { data: worker } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'worker' });
    if (!canAnalyzeCurriculum(context.userId, data.userId, !!admin, !!worker)) return { ok: false, error: 'Operazione non autorizzata.' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: service, error: gateError } = await supabaseAdmin.from('curriculum_analysis_service_state').select('paused,message').eq('id',true).maybeSingle();
    if (gateError || service?.paused) return { ok: false, error: service?.message ?? 'Analisi sospesa. Verifica il servizio prima di riattivarlo.' };
    const { data: assessment } = await context.supabase.from('worker_curriculum_assessments').select('*').eq('user_id', data.userId).eq('version', data.version).maybeSingle();
    if (!assessment || !assessment.consent_at || !['requested','pending_review','error'].includes(assessment.status)) return { ok: false, error: 'Richiesta non disponibile.' };
    const { data: current } = await supabaseAdmin.from('worker_curricula').select('storage_path').eq('user_id', data.userId).maybeSingle();
    if (current?.storage_path !== assessment.curriculum_path) return { ok: false, error: 'Il curriculum è cambiato.' };
    const { data: lock, error: lockError } = await supabaseAdmin.from('worker_curriculum_assessments').update({ status: 'analyzing' }).eq('user_id', data.userId).eq('version',data.version).eq('status',assessment.status).select('user_id').maybeSingle();
    if (lockError) return { ok: false, error: 'Non è stato possibile avviare l’analisi.' };
    if (!lock) return { ok: true, error: '' };
    const save = (patch: Record<string, unknown>) => supabaseAdmin.from('worker_curriculum_assessments').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id',data.userId).eq('version',data.version).eq('status','analyzing').select('user_id');
    try {
      const { data: pdf, error: downloadError } = await supabaseAdmin.storage.from(CURRICULUM_BUCKET).download(assessment.curriculum_path);
      if (downloadError || !pdf) throw new Error('Impossibile leggere il curriculum.');
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      const invalid = validateCurriculumBytes(bytes);
      if (invalid) throw new Error(invalid);
      const key = process.env['LOVABLE_API_KEY'];
      const role = automaticCurriculumRole(assessment.role_label, null);
      if (!key) throw new Error('Servizio di analisi non configurato.');
      const request = getRequest();
      const { analyzeCurriculumPdf } = await import('@/lib/cv-ai/analyze.server');
      const { scores, evidence, doubts, total, stars, evaluable } = await analyzeCurriculumPdf(request, key, role, bytes);
      const scoring = { total, stars };
      const output = { evaluable };
      const status = output.evaluable ? 'approved' : 'not_evaluable';
      const publicVisible = shouldAutoPublishCurriculum({ scores, ...scoring, evaluable: output.evaluable, doubts, status, consent_at: assessment.consent_at, rubric_version: CV_RUBRIC_VERSION }, true, assessment.auto_publication_consent);
      const { error, data: saved } = await save({ scores, evidence, ...scoring, rubric_version: CV_RUBRIC_VERSION, role_label: role, evaluable: output.evaluable, doubts, status, reviewed_by: null, reviewed_at: new Date().toISOString(), review_note: 'Riconoscimento automatico Pupillo: ogni curriculum riceve quattro stelle; cinque se buono e con almeno due lavori dichiarati o gestione di attività/team. Dichiarazioni non verificate.', error_message: null, public_visible: publicVisible });
      if (error || !saved?.length) return { ok: false, error: 'La richiesta è cambiata: valutazione non salvata.' };
      // Result is saved: the PDF is no longer needed. Failures are retried by the scheduled sweep.
      const { shouldPurgeCurriculum } = await import('@/lib/curriculum-purge');
      if (shouldPurgeCurriculum(status, true)) {
        const { purgeAnalyzedCurriculum } = await import('@/lib/curriculum-purge.server');
        try { await purgeAnalyzedCurriculum(supabaseAdmin, data.userId, assessment.curriculum_path); }
        catch (e) { console.error('[PUPILLO_CV_PURGE_UNEXPECTED]', e); }
      }
      return { ok: true, error: '' };
    } catch (error) {
      const { CvGatewayError } = await import('@/lib/cv-ai/responses.server');
      let cause: unknown = error;
      for (let i=0; i<5 && !(cause instanceof CvGatewayError); i++) {
        if (!cause || typeof cause!=='object' || !('cause' in cause)) break;
        cause=cause.cause;
      }
      const gateway = cause instanceof CvGatewayError ? cause : null;
      const message = gateway?.message ?? 'Analisi non riuscita. Verifica il documento o la disponibilità del servizio.';
      const paused = gateway && [401,402,403,404].includes(gateway.status);
      if (paused) await supabaseAdmin.from('curriculum_analysis_service_state').upsert({ id:true,paused:true,message,updated_at:new Date().toISOString() });
      await save({ status: paused ? 'blocked' : 'error', error_message: message });
      return { ok: false, error: message };
    }
  });

export const openAssessmentCurriculum = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.uuid(), version: z.uuid() }))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id:context.userId, _role:'admin' });
    if (!admin) return { url: null, error: 'Operazione non autorizzata.' };
    const { data: assessment } = await context.supabase.from('worker_curriculum_assessments').select('curriculum_path,consent_at,status').eq('user_id',data.userId).eq('version',data.version).maybeSingle();
    if (!assessment?.consent_at || assessment.status==='stale') return { url:null, error:'Consenso non disponibile.' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: current } = await supabaseAdmin.from('worker_curricula').select('storage_path,file_deleted_at').eq('user_id',data.userId).maybeSingle();
    if (current?.storage_path !== assessment.curriculum_path) return { url:null, error:'Il curriculum è cambiato.' };
    if (current.file_deleted_at) return { url:null, error:'Il file è stato eliminato dopo l’analisi.' };
    const { data: signed, error } = await supabaseAdmin.storage.from(CURRICULUM_BUCKET).createSignedUrl(assessment.curriculum_path,60);
    if (error || !signed) return { url:null,error:'Impossibile aprire il documento.' };
    const browserUrl = import.meta.env['VITE_SUPABASE_URL'];
    const serverUrl = process.env['SUPABASE_URL'];
    return { url:browserUrl && serverUrl ? signed.signedUrl.replace(serverUrl,browserUrl) : signed.signedUrl, error:'' };
  });