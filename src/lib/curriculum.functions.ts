import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CURRICULUM_MAX_BYTES, validateCurriculumBytes } from "@/lib/curriculum-file";
import { automaticCurriculumRole } from '@/lib/curriculum-assessment';

/**
 * Scores a CV PDF in memory and saves only the result as a pending score.
 * The PDF is never written to storage: it is discarded when the request ends.
 * Allowed only while the worker has received no restaurant reviews.
 */
export const scoreCurriculumPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input instanceof FormData ? input.get("file") : null;
    return { file: value instanceof File ? value : null, consent: input instanceof FormData && input.get('assessmentConsent') === 'true' };
  })
  .handler(async ({ data, context }) => {
    const { file, consent } = data;
    if (!consent) return { ok: false as const, error: "Conferma il consenso alla valutazione automatica del curriculum." };
    if (!file || !file.size) return { ok: false as const, error: "Seleziona un curriculum." };
    if (file.size > CURRICULUM_MAX_BYTES) return { ok: false as const, error: "Il curriculum supera il limite di 5 MB." };
    const { data: allowed, error: allowedError } = await context.supabase.rpc("my_cv_upload_allowed");
    if (allowedError) return { ok: false as const, error: "Impossibile verificare il tuo profilo. Riprova." };
    if (!allowed) return { ok: false as const, error: "Hai già ricevuto recensioni: le tue stelle derivano dalle recensioni dei turni." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateCurriculumBytes(bytes);
    if (validation) return { ok: false as const, error: validation };
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false as const, error: "Servizio di analisi non configurato." };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: service } = await supabaseAdmin.from('curriculum_analysis_service_state').select('paused,message').eq('id', true).maybeSingle();
    if (service?.paused) return { ok: false as const, error: service.message ?? 'Analisi sospesa. Riprova più tardi.' };
    const [{ data: previous }, { data: profile }] = await Promise.all([
      context.supabase.from('worker_curriculum_assessments').select('role_label').eq('user_id', context.userId).maybeSingle(),
      context.supabase.from('profiles').select('primary_role').eq('id', context.userId).maybeSingle(),
    ]);
    const role = automaticCurriculumRole(previous?.role_label, profile?.primary_role);
    try {
      const { analyzeCurriculumPdf } = await import('@/lib/cv-ai/analyze.server');
      const r = await analyzeCurriculumPdf(getRequest(), key, role, bytes);
      const { error } = await supabaseAdmin.from('worker_cv_pending_scores').upsert({
        user_id: context.userId, role_label: role, scores: r.scores, evidence: r.evidence, total: r.total, stars: r.stars,
        evaluable: r.evaluable, doubts: r.doubts, rubric_version: r.rubric_version, created_at: new Date().toISOString(),
      });
      if (error) return { ok: false as const, error: "Non è stato possibile salvare il punteggio. Riprova." };
      return { ok: true as const };
    } catch (error) {
      const { CvGatewayError } = await import('@/lib/cv-ai/responses.server');
      let cause: unknown = error;
      for (let i = 0; i < 5 && !(cause instanceof CvGatewayError); i++) {
        if (!cause || typeof cause !== 'object' || !('cause' in cause)) break;
        cause = cause.cause;
      }
      const gateway = cause instanceof CvGatewayError ? cause : null;
      const message = gateway?.message ?? 'Analisi non riuscita. Verifica il documento e riprova.';
      if (gateway && [401, 402, 403, 404].includes(gateway.status)) await supabaseAdmin.from('curriculum_analysis_service_state').upsert({ id: true, paused: true, message, updated_at: new Date().toISOString() });
      console.error('[PUPILLO_CV_SCORE]', error);
      return { ok: false as const, error: message };
    }
  });
