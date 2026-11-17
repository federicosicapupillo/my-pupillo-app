import { createFileRoute } from '@tanstack/react-router'
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth'

// Chiamato dal cron ogni minuto: invia un'email per le notifiche importanti nuove.
// Idempotente: ogni notifica viene marcata (email_status) e la chiave evita doppioni.
export const Route = createFileRoute('/api/public/hooks/notification-emails')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Solo il pianificatore gestito: la chiave pubblica non basta più.
        const authFailure = await authenticateCronRequest(request)
        if (authFailure) return authFailure
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
