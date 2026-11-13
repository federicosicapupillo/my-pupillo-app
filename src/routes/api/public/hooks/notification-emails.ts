import { createFileRoute } from '@tanstack/react-router'

// Chiamato dal cron ogni minuto: invia un'email per le notifiche importanti nuove.
// Idempotente: ogni notifica viene marcata (email_status) e la chiave evita doppioni.
export const Route = createFileRoute('/api/public/hooks/notification-emails')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get('apikey') || request.headers.get('x-api-key')
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response('Unauthorized', { status: 401 })
        }
        const { runNotificationEmailSweep } = await import('@/lib/notification-email-sweep.server')
        try {
          return Response.json({ ok: true, ...(await runNotificationEmailSweep()) })
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message }, { status: 500 })
        }
      },
    },
  },
})
