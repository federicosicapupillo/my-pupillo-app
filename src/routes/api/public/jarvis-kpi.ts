import { createFileRoute } from '@tanstack/react-router'
import { createHash, timingSafeEqual } from 'crypto'

// Read-only aggregated KPIs for the internal Jarvis dashboard.
// Returns ONLY counts/sums/averages — never ids, names or free text.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Jarvis-Key, Content-Type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function keyOk(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

type Row = Record<string, any>

async function fetchAll(db: any, table: string, cols: string, demoFilter = true): Promise<Row[]> {
  const out: Row[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    let q = db.from(table).select(cols).range(from, from + size - 1)
    if (demoFilter) q = q.eq('is_demo', false)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return out
}

const countBy = (rows: Row[], key: (r: Row) => string) =>
  rows.reduce<Record<string, number>>((acc, r) => {
    const k = key(r)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

const avg = (vals: (number | null | undefined)[]) => {
  const v = vals.filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

function weekStart(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (x.getUTCDay() + 6) % 7 // Monday = 0
  x.setUTCDate(x.getUTCDate() - day)
  return x.toISOString().slice(0, 10)
}

export const Route = createFileRoute('/api/public/jarvis-kpi')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () => json({ error: 'method_not_allowed' }, 405),
      PUT: async () => json({ error: 'method_not_allowed' }, 405),
      PATCH: async () => json({ error: 'method_not_allowed' }, 405),
      DELETE: async () => json({ error: 'method_not_allowed' }, 405),
      GET: async ({ request }) => {
        if (!keyOk(request.headers.get('x-jarvis-key'), process.env['JARVIS_KPI_KEY'])) {
          return json({ error: 'unauthorized' }, 401)
        }
        try {
          const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server')

          const [profiles, roles, anns, apps, shifts, reviews, incidents, credits] = await Promise.all([
            fetchAll(db, 'profiles', 'id, created_at, is_deleted'),
            fetchAll(db, 'user_roles', 'user_id, role', false),
            fetchAll(db, 'announcements', 'status, created_at'),
            fetchAll(db, 'applications', 'status, created_at'),
            fetchAll(db, 'shifts', 'status, hours, amount, created_at, completed_at'),
            fetchAll(db, 'reviews', 'rating, punctuality, professionalism, competence, reliability, teamwork'),
            fetchAll(db, 'worker_incidents', 'incident_type, kind, created_at'),
            fetchAll(db, 'credit_transactions', 'user_id, delta, kind', false),
          ])

          const now = Date.now()
          const DAY = 86400000
          const since = (iso: string | null | undefined, days: number) =>
            !!iso && new Date(iso).getTime() >= now - days * DAY

          const live = profiles.filter((p) => !p.is_deleted)
          const liveIds = new Set(live.map((p) => p.id))
          const liveRoles = roles.filter((r) => liveIds.has(r.user_id))
          const restIds = new Set(liveRoles.filter((r) => r.role === 'restaurant').map((r) => r.user_id))
          const workIds = new Set(liveRoles.filter((r) => r.role === 'worker').map((r) => r.user_id))
          const users = live.filter((p) => restIds.has(p.id) || workIds.has(p.id))

          const acceptedStatuses = new Set(['accepted', 'assigned', 'confirmed'])
          const acceptedApps = apps.filter((a) => acceptedStatuses.has(a.status)).length

          const completed = shifts.filter((s) => s.status === 'completed')

          const liveCredits = credits.filter((c) => liveIds.has(c.user_id))
          const perKind: Record<string, { movimenti: number; somma_delta: number }> = {}
          for (const c of liveCredits) {
            const k = c.kind ?? 'non_specificato'
            perKind[k] ??= { movimenti: 0, somma_delta: 0 }
            perKind[k].movimenti++
            perKind[k].somma_delta += Number(c.delta) || 0
          }

          // Weekly series (last 12 ISO weeks, Monday start, UTC)
          const weeks: string[] = []
          const cur = new Date(weekStart(new Date()))
          for (let i = 11; i >= 0; i--) {
            const d = new Date(cur)
            d.setUTCDate(d.getUTCDate() - i * 7)
            weeks.push(d.toISOString().slice(0, 10))
          }
          const bucket = (rows: Row[], field: string) => {
            const m: Record<string, number> = {}
            for (const r of rows) if (r[field]) {
              const w = weekStart(new Date(r[field]))
              m[w] = (m[w] ?? 0) + 1
            }
            return m
          }
          const wu = bucket(users, 'created_at')
          const wa = bucket(anns, 'created_at')
          const wc = bucket(apps, 'created_at')
          const ws = bucket(completed, 'completed_at')

          return json({
            generato_il: new Date().toISOString(),
            utenti: {
              totali: users.length,
              ristoranti: restIds.size,
              lavoratori: workIds.size,
              nuovi_7g: users.filter((u) => since(u.created_at, 7)).length,
              nuovi_30g: users.filter((u) => since(u.created_at, 30)).length,
            },
            annunci: {
              totali: anns.length,
              per_stato: countBy(anns, (a) => a.status ?? 'non_specificato'),
              ultimi_30g: anns.filter((a) => since(a.created_at, 30)).length,
            },
            candidature: {
              totali: apps.length,
              per_stato: countBy(apps, (a) => a.status ?? 'non_specificato'),
              ultimi_30g: apps.filter((a) => since(a.created_at, 30)).length,
              perc_accettate: apps.length ? round2((acceptedApps / apps.length) * 100) : 0,
            },
            turni: {
              totali: shifts.length,
              per_stato: countBy(shifts, (s) => s.status ?? 'non_specificato'),
              completati: completed.length,
              ore_totali: round2(shifts.reduce((s, x) => s + (Number(x.hours) || 0), 0)),
              importo_totale: round2(shifts.reduce((s, x) => s + (Number(x.amount) || 0), 0)),
              ultimi_30g: shifts.filter((s) => since(s.created_at, 30)).length,
            },
            recensioni: {
              totali: reviews.length,
              media_rating: avg(reviews.map((r) => r.rating)),
              medie: {
                punctuality: avg(reviews.map((r) => r.punctuality)),
                professionalism: avg(reviews.map((r) => r.professionalism)),
                competence: avg(reviews.map((r) => r.competence)),
                reliability: avg(reviews.map((r) => r.reliability)),
                teamwork: avg(reviews.map((r) => r.teamwork)),
              },
            },
            incidenti: {
              totali: incidents.length,
              per_tipo: countBy(incidents, (i) => i.incident_type ?? i.kind ?? 'non_specificato'),
              ultimi_30g: incidents.filter((i) => since(i.created_at, 30)).length,
            },
            crediti: {
              movimenti: liveCredits.length,
              somma_positivi: liveCredits.reduce((s, c) => s + Math.max(0, Number(c.delta) || 0), 0),
              somma_negativi: liveCredits.reduce((s, c) => s + Math.min(0, Number(c.delta) || 0), 0),
              per_kind: perKind,
            },
            serie_settimanale: weeks.map((w) => ({
              settimana: w,
              nuovi_utenti: wu[w] ?? 0,
              annunci: wa[w] ?? 0,
              candidature: wc[w] ?? 0,
              turni_completati: ws[w] ?? 0,
            })),
          })
        } catch (e) {
          console.error('[jarvis-kpi]', e)
          return json({ error: 'internal_error' }, 500)
        }
      },
    },
  },
})
