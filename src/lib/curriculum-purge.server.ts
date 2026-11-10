import type { SupabaseClient } from '@supabase/supabase-js';
import { CURRICULUM_BUCKET } from '@/lib/curriculum-file';
import { CV_PURGE_STATUSES, CV_AUTO_DELETE_SINCE } from '@/lib/curriculum-purge';

/**
 * Removes the analysed PDF from private storage and marks the curriculum row.
 * Idempotent: removing an already-missing object succeeds, and the mark only
 * applies while the row still points at the same path. The row and its
 * storage_path stay, so the saved assessment remains linked and publishable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purgeAnalyzedCurriculum(admin: SupabaseClient<any>, userId: string, path: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin.storage.from(CURRICULUM_BUCKET).remove([path]);
    if (!error) {
      const { error: markError } = await admin.from('worker_curricula')
        .update({ file_deleted_at: new Date().toISOString() })
        .eq('user_id', userId).eq('storage_path', path).is('file_deleted_at', null);
      if (markError) console.error('[PUPILLO_CV_PURGE_MARK]', { userId, message: markError.message });
      return !markError;
    }
    console.error('[PUPILLO_CV_PURGE]', { userId, attempt, message: error.message });
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  return false;
}

/** Retries purges that failed earlier. Only analyses completed after the feature went live. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sweepAnalyzedCurricula(admin: SupabaseClient<any>) {
  const { data: rows, error } = await admin.from('worker_curricula').select('user_id,storage_path').is('file_deleted_at', null).limit(200);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { purged: 0, failed: 0 };
  const { data: done, error: aErr } = await admin.from('worker_curriculum_assessments')
    .select('user_id,curriculum_path').in('user_id', rows.map(r => r.user_id))
    .in('status', [...CV_PURGE_STATUSES]).gte('reviewed_at', CV_AUTO_DELETE_SINCE);
  if (aErr) throw new Error(aErr.message);
  let purged = 0, failed = 0;
  for (const r of rows) {
    if (!done?.some(a => a.user_id === r.user_id && a.curriculum_path === r.storage_path)) continue;
    if (await purgeAnalyzedCurriculum(admin, r.user_id, r.storage_path)) purged++; else failed++;
  }
  return { purged, failed };
}
