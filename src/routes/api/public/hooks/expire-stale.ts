import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/hooks/expire-stale')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get('apikey') || request.headers.get('x-api-key')
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response('Unauthorized', { status: 401 })
        }

        const nowIso = new Date().toISOString()
        const now = new Date()
        const errors: { phase: string; id?: string; message: string }[] = []
        const failedPhases = new Set<string>()
        const logErr = (phase: string, message: string, id?: string, fatal = true) => {
          errors.push({ phase, id, message })
          if (fatal) failedPhases.add(phase)
          console.error('[PUPILLO_EXPIRE_STALE]', { phase, id, message })
        }

        // FASE A — scadenza annunci (esclusi demo). Scadenza = inizio turno (Europa/Roma).
        let expiredAnn: { id: string; restaurant_id: string }[] = []
        try {
          const { data: candidates, error: candErr } = await supabaseAdmin
            .from('announcements')
            .select('id, restaurant_id, service_date, service_time, end_date, end_time, shift_duration_hours, duration_hours, expires_at')
            .in('status', ['active', 'draft'])
            .eq('is_demo', false)
          if (candErr) throw candErr

          const { getShiftStartDate } = await import('@/lib/announcement-time')
          const ids = (candidates ?? [])
            .filter((a: any) => {
              const start = getShiftStartDate(a)
              return start ? start.getTime() <= now.getTime() : false
            })
            .map((a: any) => a.id as string)

          const CHUNK = 100
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK)
            const { data, error } = await supabaseAdmin
              .from('announcements')
              .update({ status: 'expired' })
              .in('id', chunk)
              .in('status', ['active', 'draft'])
              .eq('is_demo', false)
              .select('id, restaurant_id')
            if (!error) {
              expiredAnn.push(...((data ?? []) as any))
              continue
            }
            // Fallback riga per riga: una riga rifiutata non blocca le altre.
            for (const id of chunk) {
              const { data: one, error: oneErr } = await supabaseAdmin
                .from('announcements')
                .update({ status: 'expired' })
                .eq('id', id)
                .in('status', ['active', 'draft'])
                .eq('is_demo', false)
                .select('id, restaurant_id')
              if (oneErr) logErr('announcements', oneErr.message, id, false)
              else expiredAnn.push(...((one ?? []) as any))
            }
          }
        } catch (e: any) {
          logErr('announcements', e?.message ?? String(e))
        }

        // FASE B — scadenza candidature oltre response_deadline
        let expiredApps: { id: string; worker_id: string; restaurant_id: string }[] = []
        try {
          const { data, error: appErr } = await supabaseAdmin
            .from('applications')
            .update({ status: 'expired' })
            .lt('response_deadline', nowIso)
            .in('status', ['pending', 'counter_offer', 'interested'])
            .select('id, worker_id, restaurant_id')
          if (appErr) throw appErr
          expiredApps = (data ?? []) as any
        } catch (e: any) {
          logErr('applications', e?.message ?? String(e))
        }

        // FASE C1 — notifiche annunci scaduti (quelli senza candidature hanno
        // la notifica dedicata dal trigger trg_notify_announcement_expired_no_applications).
        try {
          if (expiredAnn.length > 0) {
            const expiredIds = expiredAnn.map((a) => a.id)
            const { data: appsForExpired, error } = await supabaseAdmin
              .from('applications')
              .select('announcement_id')
              .in('announcement_id', expiredIds)
            if (error) throw error
            const withApplications = new Set(
              ((appsForExpired ?? []) as any[]).map((r) => r.announcement_id as string),
            )
            const genericTargets = expiredAnn.filter((a) => withApplications.has(a.id))
            if (genericTargets.length > 0) {
              const { error: nErr } = await (supabaseAdmin.from('notifications') as any).upsert(
                genericTargets.map((a) => ({
                  user_id: a.restaurant_id,
                  title: 'Annuncio scaduto',
                  body: 'Il tuo annuncio è scaduto senza essere assegnato.',
                  link: '/announcements/' + a.id,
                  metadata: { kind: 'announcement_expired', announcement_id: a.id },
                  dedupe_key: `announcement_expired:${a.id}:${a.restaurant_id}`,
                })),
                { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }
              )
              if (nErr) throw nErr
            }
          }
        } catch (e: any) {
          logErr('announcement_notifications', e?.message ?? String(e))
        }

        // FASE C2 — notifiche candidature scadute
        try {
          if (expiredApps.length > 0) {
            const notifs = expiredApps.flatMap((a) => [
              {
                user_id: a.worker_id,
                title: 'Candidatura scaduta',
                body: 'Non hai risposto entro 24h. La candidatura è scaduta.',
                link: '/messages/' + a.id,
                metadata: { kind: 'application_expired', application_id: a.id },
                dedupe_key: `application_expired:${a.id}:${a.worker_id}`,
              },
              {
                user_id: a.restaurant_id,
                title: 'Candidatura scaduta',
                body: 'Il lavoratore non ha risposto in tempo.',
                link: '/messages/' + a.id,
                metadata: { kind: 'application_expired', application_id: a.id },
                dedupe_key: `application_expired:${a.id}:${a.restaurant_id}`,
              },
            ])
            const { error } = await (supabaseAdmin.from('notifications') as any).upsert(notifs, {
              onConflict: 'user_id,dedupe_key', ignoreDuplicates: true,
            })
            if (error) throw error
          }
        } catch (e: any) {
          logErr('application_notifications', e?.message ?? String(e))
        }

        // ---------------------------------------------------------------
        // Review reminder per il RISTORATORE quando un turno è terminato.
        // Regole:
        //   - turno assegnato a un lavoratore (worker_id NOT NULL);
        //   - end_datetime (computato da announcement) <= ora;
        //   - il ristoratore non ha ancora recensito quel turno;
        //   - non esiste già una notifica reminder per quel turno
        //     (dedup via metadata.kind = 'review_reminder_shift_end').
        // ---------------------------------------------------------------
        let reviewReminderInserted = 0
        try {
          const { data: openShifts, error: shiftsErr } = await supabaseAdmin
            .from('shifts')
            .select('id, restaurant_id, worker_id, announcement_id, shift_date, status')
            .in('status', ['scheduled', 'completed'])
            .not('worker_id', 'is', null)

          if (shiftsErr) {
            console.error('[PUPILLO_REVIEW_REMINDER_LOAD_SHIFTS_ERROR]', shiftsErr)
          } else if (openShifts && openShifts.length > 0) {
            const annIds = Array.from(
              new Set((openShifts as any[]).map((s) => s.announcement_id).filter(Boolean)),
            ) as string[]

            const { data: anns } = annIds.length
              ? await supabaseAdmin
                  .from('announcements')
                  .select('id, service_date, service_time, end_time, end_date, duration_hours, shift_duration_hours')
                  .in('id', annIds)
              : { data: [] as any[] }
            const annMap = new Map<string, any>()
            ;(anns ?? []).forEach((a: any) => annMap.set(a.id, a))

            // Filtra a quelli effettivamente terminati
            const { getShiftEndDate } = await import('@/lib/announcement-time')
            const ended = (openShifts as any[]).filter((s) => {
              const ann = s.announcement_id ? annMap.get(s.announcement_id) : null
              const end = ann
                ? getShiftEndDate(ann)
                : (() => {
                    const d = new Date(`${s.shift_date}T23:59:00`)
                    return isNaN(d.getTime()) ? null : d
                  })()
              return end ? end.getTime() <= now.getTime() : false
            })

            if (ended.length > 0) {
              const shiftIds = ended.map((s) => s.id)
              const workerIds = Array.from(new Set(ended.map((s) => s.worker_id))) as string[]

              const [{ data: existingReviews }, { data: workerProfs }, { data: appsForShifts }] = await Promise.all([
                supabaseAdmin
                  .from('reviews')
                  .select('shift_id, author_id')
                  .in('shift_id', shiftIds),
                workerIds.length
                  ? supabaseAdmin
                      .from('profiles')
                      .select('id, full_name, first_name, last_name')
                      .in('id', workerIds)
                  : Promise.resolve({ data: [] as any[] }),
                supabaseAdmin
                  .from('applications')
                  .select('id, announcement_id, worker_id, restaurant_id, created_at')
                  .in('announcement_id', Array.from(new Set(ended.map((s) => s.announcement_id).filter(Boolean))) as string[]),
              ])

              // Set of "shift_id|author_id" già recensiti
              const reviewedKey = new Set<string>()
              ;((existingReviews ?? []) as any[]).forEach((r) =>
                reviewedKey.add(`${r.shift_id}|${r.author_id}`),
              )

              const profMap = new Map<string, any>()
              ;((workerProfs ?? []) as any[]).forEach((p) => profMap.set(p.id, p))

              // application_id più recente per (announcement_id, worker_id, restaurant_id)
              const appKey = (a: { announcement_id: string; worker_id: string; restaurant_id: string }) =>
                `${a.announcement_id}|${a.worker_id}|${a.restaurant_id}`
              const appMap = new Map<string, string>()
              ;((appsForShifts ?? []) as any[])
                .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
                .forEach((a) => { const k = appKey(a); if (!appMap.has(k)) appMap.set(k, a.id) })

              const toInsert: any[] = []
              for (const s of ended) {
                if (reviewedKey.has(`${s.id}|${s.restaurant_id}`)) continue
                // Notifica unica combinata, allineata al trigger DB e a jobs.tsx,
                // così le 3 sorgenti collassano sulla stessa dedupe_key.
                void profMap.get(s.worker_id)
                const appId = appMap.get(appKey({
                  announcement_id: s.announcement_id,
                  worker_id: s.worker_id,
                  restaurant_id: s.restaurant_id,
                })) ?? null
                const link = appId
                  ? `/messages/${appId}?action=review`
                  : `/shifts?tab=to-review&shift=${s.id}`
                toInsert.push({
                  user_id: s.restaurant_id,
                  title: 'Turno completato — lascia una recensione',
                  body: 'Il turno è stato completato. Hai 3 giorni per lasciare una recensione.',
                  link,
                  metadata: {
                    kind: 'shift_completed_review',
                    shift_id: s.id,
                    worker_id: s.worker_id,
                    announcement_id: s.announcement_id,
                    application_id: appId,
                    action: 'review',
                  },
                  dedupe_key: `shift_completed_review:${s.id}:${s.restaurant_id}`,
                })
              }

              if (toInsert.length > 0) {
                const { error: insErr } = await (supabaseAdmin.from('notifications') as any)
                  .upsert(toInsert, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
                if (insErr) {
                  console.error('[PUPILLO_REVIEW_REMINDER_INSERT_ERROR]', insErr)
                } else {
                  reviewReminderInserted = toInsert.length
                  console.info('[PUPILLO_REVIEW_REMINDER_CREATED]', {
                    count: toInsert.length,
                    shift_ids: toInsert.map((n) => n.metadata?.shift_id),
                  })
                }
              }
            }
          }
        } catch (e: any) {
          console.error('[PUPILLO_REVIEW_REMINDER_UNEXPECTED]', e)
          logErr('review_reminders', e?.message ?? String(e))
        }

        const ALL_PHASES = 5
        const allFailed = failedPhases.size >= ALL_PHASES
        return new Response(
          JSON.stringify({
            success: !allFailed,
            announcements_expired: expiredAnn.length,
            applications_expired: expiredApps.length,
            review_reminders_created: reviewReminderInserted,
            errors,
          }),
          { status: allFailed ? 500 : 200, headers: { 'Content-Type': 'application/json' } }
        )
      },
    },
  },
})