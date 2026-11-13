import { SHIFT_REMINDER_TITLE, shiftReminderBody, tomorrowInRome } from './shift-reminder'

// Crea (una sola volta per turno) la notifica-promemoria per il lavoratore;
// l'email parte poi dalla sweep delle notifiche importanti.
export async function createTomorrowShiftReminders(supabaseAdmin: any) {
  const day = tomorrowInRome()
  const { data: shifts, error } = await supabaseAdmin.from('shifts')
    .select('id, worker_id, shift_date, announcement_id')
    .eq('status', 'scheduled').eq('is_demo', false).eq('shift_date', day).limit(500)
  if (error) throw error
  if (!shifts?.length) return { created: 0 }
  const annIds = [...new Set(shifts.map((s: any) => s.announcement_id).filter(Boolean))]
  const titles = new Map<string, string>()
  if (annIds.length) {
    const { data: anns } = await supabaseAdmin.from('announcements').select('id, title').in('id', annIds)
    for (const a of anns ?? []) titles.set(a.id, a.title)
  }
  const rows = shifts.map((s: any) => ({
    user_id: s.worker_id,
    title: SHIFT_REMINDER_TITLE,
    body: shiftReminderBody(s.shift_date, titles.get(s.announcement_id)),
    link: `/shifts?shift=${s.id}`,
    metadata: { kind: 'shift_reminder_day_before', shift_id: s.id },
    dedupe_key: `shift_reminder_day_before:${s.id}`,
  }))
  const { error: insErr } = await supabaseAdmin.from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
  if (insErr) throw insErr
  return { created: rows.length }
}
