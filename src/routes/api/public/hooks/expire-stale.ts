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

        // Scadenza annuncio = inizio turno (service_date + service_time, Europa/Roma).
        // Selezioniamo i candidati e filtriamo lato JS confrontando l'inizio turno
        // con "adesso" nel fuso operativo, così non dipendiamo dal valore legacy
        // della colonna `expires_at`.
        const { data: candidates, error: candErr } = await supabaseAdmin
          .from('announcements')
          .select('id, restaurant_id, service_date, service_time, end_date, end_time, shift_duration_hours, duration_hours, expires_at')
          .in('status', ['active', 'draft'])

        if (candErr) {
          console.error('load announcement candidates error', candErr)
          return new Response(JSON.stringify({ error: candErr.message }), { status: 500 })
        }

        const { getShiftStartDate } = await import('@/lib/announcement-time')
        const now = new Date()
        const toExpire = (candidates ?? []).filter((a: any) => {
          const start = getShiftStartDate(a)
          return start ? start.getTime() <= now.getTime() : false
        })

        let expiredAnn: { id: string; restaurant_id: string }[] = []
        if (toExpire.length > 0) {
          const ids = toExpire.map((a: any) => a.id)
          const { data, error: annErr } = await supabaseAdmin
            .from('announcements')
            .update({ status: 'expired' })
            .in('id', ids)
            .in('status', ['active', 'draft'])
            .select('id, restaurant_id')
          if (annErr) {
            console.error('expire announcements error', annErr)
            return new Response(JSON.stringify({ error: annErr.message }), { status: 500 })
          }
          expiredAnn = (data ?? []) as any
        }

        // Expire applications past response_deadline still pending/counter_offer/interested
        const { data: expiredApps, error: appErr } = await supabaseAdmin
          .from('applications')
          .update({ status: 'expired' })
          .lt('response_deadline', nowIso)
          .in('status', ['pending', 'counter_offer', 'interested'])
          .select('id, worker_id, restaurant_id')

        if (appErr) {
          console.error('expire applications error', appErr)
          return new Response(JSON.stringify({ error: appErr.message }), { status: 500 })
        }

        // Notify restaurants of expired announcements
        if (expiredAnn && expiredAnn.length > 0) {
          await supabaseAdmin.from('notifications').insert(
            expiredAnn.map((a: any) => ({
              user_id: a.restaurant_id,
              title: 'Annuncio scaduto',
              body: 'Il tuo annuncio è scaduto senza essere assegnato.',
              link: '/announcements',
            }))
          )
        }

        // Notify both parties of expired applications
        if (expiredApps && expiredApps.length > 0) {
          const notifs = expiredApps.flatMap((a: any) => [
            {
              user_id: a.worker_id,
              title: 'Candidatura scaduta',
              body: 'Non hai risposto entro 24h. La candidatura è scaduta.',
              link: '/messages/' + a.id,
            },
            {
              user_id: a.restaurant_id,
              title: 'Candidatura scaduta',
              body: 'Il lavoratore non ha risposto in tempo.',
              link: '/messages/' + a.id,
            },
          ])
          await supabaseAdmin.from('notifications').insert(notifs)
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

              const [{ data: existingReviews }, { data: workerProfs }] = await Promise.all([
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
              ])

              // Set of "shift_id|author_id" già recensiti
              const reviewedKey = new Set<string>()
              ;((existingReviews ?? []) as any[]).forEach((r) =>
                reviewedKey.add(`${r.shift_id}|${r.author_id}`),
              )

              // Dedup notifiche già esistenti per (user_id, shift_id)
              const { data: existingNotifs } = await supabaseAdmin
                .from('notifications')
                .select('user_id, metadata')
                .contains('metadata', { kind: 'review_reminder_shift_end' })
                .in(
                  'user_id',
                  Array.from(new Set(ended.map((s) => s.restaurant_id))) as string[],
                )
              const notifiedKey = new Set<string>()
              ;((existingNotifs ?? []) as any[]).forEach((n) => {
                const sid = n?.metadata?.shift_id
                if (sid) notifiedKey.add(`${n.user_id}|${sid}`)
              })

              const profMap = new Map<string, any>()
              ;((workerProfs ?? []) as any[]).forEach((p) => profMap.set(p.id, p))

              const toInsert: any[] = []
              for (const s of ended) {
                if (reviewedKey.has(`${s.id}|${s.restaurant_id}`)) continue
                if (notifiedKey.has(`${s.restaurant_id}|${s.id}`)) continue
                const p = profMap.get(s.worker_id)
                const workerName =
                  (p?.full_name as string | null) ||
                  [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
                  'il lavoratore'
                toInsert.push({
                  user_id: s.restaurant_id,
                  title: 'Turno concluso: lascia una recensione',
                  body: `Il turno con ${workerName} è terminato. Lascia una recensione per completare la valutazione e contribuire alla reputazione su Pupillo.`,
                  link: `/shifts?tab=to-review&shift=${s.id}&review=${s.id}`,
                  metadata: {
                    kind: 'review_reminder_shift_end',
                    shift_id: s.id,
                    worker_id: s.worker_id,
                    announcement_id: s.announcement_id,
                  },
                })
              }

              if (toInsert.length > 0) {
                const { error: insErr } = await supabaseAdmin
                  .from('notifications')
                  .insert(toInsert)
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
        } catch (e) {
          console.error('[PUPILLO_REVIEW_REMINDER_UNEXPECTED]', e)
        }

        return new Response(
          JSON.stringify({
            success: true,
            announcements_expired: expiredAnn?.length || 0,
            applications_expired: expiredApps?.length || 0,
            review_reminders_created: reviewReminderInserted,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      },
    },
  },
})