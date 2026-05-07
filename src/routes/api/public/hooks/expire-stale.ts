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

        // Expire announcements past expires_at that are still active/draft
        const { data: expiredAnn, error: annErr } = await supabaseAdmin
          .from('announcements')
          .update({ status: 'expired' })
          .lt('expires_at', nowIso)
          .in('status', ['active', 'draft'])
          .select('id, restaurant_id')

        if (annErr) {
          console.error('expire announcements error', annErr)
          return new Response(JSON.stringify({ error: annErr.message }), { status: 500 })
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

        return new Response(
          JSON.stringify({
            success: true,
            announcements_expired: expiredAnn?.length || 0,
            applications_expired: expiredApps?.length || 0,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      },
    },
  },
})