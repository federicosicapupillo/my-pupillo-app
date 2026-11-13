// Invio email per le notifiche importanti nuove. Idempotente.
export async function runNotificationEmailSweep() {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const { planNotificationEmail, absoluteLink, starLink } = await import('@/lib/notification-email')
    const BASE = 'https://pupillo.life'

    const since = new Date(Date.now() - 6 * 3600_000).toISOString()
    const { data: pending, error } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id, title, body, link, read, created_at')
      .is('email_status', null)
      .eq('is_demo', false)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50)
    if (error) throw error

    const mark = (id: string, status: string, sent = false) =>
      supabaseAdmin.from('notifications')
        .update({ email_status: status, ...(sent ? { email_sent_at: new Date().toISOString() } : {}) } as any)
        .eq('id', id).is('email_status', null)

    const stats: Record<string, number> = {}
    const bump = (k: string) => { stats[k] = (stats[k] ?? 0) + 1 }

    for (const n of pending ?? []) {
      try {
        const plan = planNotificationEmail(n.title, n.link)
        if (!plan) { await mark(n.id, 'not_important'); bump('not_important'); continue }
        if (n.read) { await mark(n.id, 'already_read'); bump('already_read'); continue }

        const { data: prof } = await supabaseAdmin.from('profiles')
          .select('email, is_deleted, account_status').eq('id', n.user_id).maybeSingle()
        if (!prof?.email || prof.is_deleted) { await mark(n.id, 'no_recipient'); bump('no_recipient'); continue }

        const { data: prefs } = await supabaseAdmin.from('notification_email_preferences')
          .select('*').eq('user_id', n.user_id).maybeSingle()
        if (prefs && (prefs as any)[plan.category] === false) { await mark(n.id, 'opted_out'); bump('opted_out'); continue }

        // Messaggi: una sola email per conversazione finché non viene letta.
        if (plan.category === 'messages' && n.link) {
          const { count } = await supabaseAdmin.from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', n.user_id).eq('link', n.link).eq('email_status', 'sent')
            .eq('read', false).neq('id', n.id)
          if ((count ?? 0) > 0) { await mark(n.id, 'grouped'); bump('grouped'); continue }
        }

        const url = absoluteLink(BASE, n.link)
        const res = await sendTemplateEmail('notification', prof.email, {
          idempotencyKey: `notification-${n.id}`,
          templateData: {
            title: n.title, body: n.body ?? '', ctaLabel: plan.cta, ctaUrl: url,
            starUrls: plan.stars ? [1, 2, 3, 4, 5].map((r) => starLink(url, r)) : undefined,
          },
        })
        await mark(n.id, res.sent ? 'sent' : 'suppressed', res.sent)
        bump(res.sent ? 'sent' : 'suppressed')
      } catch (e: any) {
        console.error('[PUPILLO_NOTIFICATION_EMAIL]', n.id, e?.code ?? '', e?.message)
        bump('error')
        // Riprova al giro successivo, finché la notifica rientra nelle 6 ore.
      }
    }
    return { processed: pending?.length ?? 0, stats }
}
