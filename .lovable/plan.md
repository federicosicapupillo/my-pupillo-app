## Reputation Score system for workers

A large, cross-cutting feature touching DB, server logic, worker profile UI, restaurant-facing worker cards, and the review form. I'll plan the work in phases so you can approve the scope before I touch code.

### Phase 1 — Data layer

**New columns on `profiles`** (worker-side, all nullable / default 0):
- `reputation_score` int (0–100, cached)
- `reputation_level` text (`new` | `new_verified` | `basic` | `pro` | `elite`)
- `reputation_updated_at` timestamptz
- `punctuality_pct` int, `completion_pct` int, `no_show_count` int
- `late_cancel_count` int, `avg_response_minutes` int
- `rehire_count` int (distinct restaurants who reused them)
- `rehire_yes_count` int, `rehire_total_answers` int (for "% richiamerei")

**New column on `reviews`**:
- `would_rehire` text (`yes` | `maybe` | `no`)
- `recommunication` smallint (1–5)  ← "Comunicazione" criterion
- `staff_collaboration` smallint (1–5)
- `appearance` smallint (1–5)

**New table `worker_incidents`** (segnalazioni gravi, kept separate from reviews):
- `worker_id`, `restaurant_id`, `shift_id`, `kind` (no_show | abandoned | misconduct | offensive | client_issue | other), `description`, `status` (pending | verified | dismissed), `created_at`. RLS: restaurant inserts own, worker reads own, admin manages.

**New table `worker_badges`** (assigned badges):
- `worker_id`, `badge` (puntuale, affidabile, ricontattato, comunicazione_rapida, profilo_verificato, zero_no_show, molto_richiesto, top_servizio, recensioni_eccellenti), `awarded_at`. Recomputed by the score function.

**DB function `public.recompute_worker_reputation(_worker uuid)`** — SECURITY DEFINER, computes all sub-scores from `shifts` / `reviews` / `applications` / `worker_incidents` / profile completeness using the weights in the brief (40/25/15/10/10), updates `profiles.*` and `worker_badges`. Called from triggers on `reviews` insert, `shifts` status change, and `worker_incidents` insert.

### Phase 2 — Scoring logic (pure TS mirror)

`src/lib/reputation.ts` — pure functions used by UI:
- `computeReputation(input)` returning `{ score, level, breakdown, badges, isNew }`
- Sub-score formulas matching the DB function
- "New worker" rule: if `completed_shifts < 3`, hide numeric score, return `level: 'new' | 'new_verified'` based on profile completeness + phone/doc verified
- Unit tests for the formula in `src/lib/__tests__/reputation.test.ts`

### Phase 3 — Restaurant-facing UI

- `src/components/WorkerReputationBadge.tsx` — compact badge + score chip for worker cards
- `src/components/WorkerReputationCard.tsx` — full breakdown (used in `workers_.$id.tsx`)
- Wire into `src/routes/workers.tsx` (lists), `src/routes/workers_.$id.tsx` (detail), and worker preview inside `messages.$id.tsx` if present

### Phase 4 — Worker-facing UI

- New section "La mia reputazione" on `src/routes/profile.tsx` (worker view) with score, level, badges, sub-metrics, "Come migliorare il tuo punteggio" tips
- For new workers: show "Nuovo verificato" state instead of low score

### Phase 5 — Review form rework

- `src/routes/ristoratore.turni.$shiftId.tsx` (review section): expand the form to the 7 criteri + tag positivi/negativi + "Lo richiameresti?" (sì/forse/no) + optional comment + separate "Segnala un problema" block that writes to `worker_incidents`, not to `reviews`
- Confirmation dialog before submit; success state hides the card from "Da recensire"
- "Lavoratori da recensire" section already exists via `required_reviews` — verify it lists the shifts and links to the new form

### Phase 6 — Privacy & safety guardrails

- Never use age/gender/nationality in the score (none of those fields are read by the formula)
- Single bad review can lower but not destroy the score (cap negative impact of any single review)
- Incidents only impact the score when `status = 'verified'`
- Refusing an offer does NOT decrement reputation (only accept-then-fail does)

---

### Scope check before I start

This is roughly 6–8 hours of work across ~12 files plus a migration. Before I write the migration and code, two quick confirmations:

1. **Where should the badge appear on the restaurant side?** The brief says "schede lavoratore viste dal ristoratore" — I'll put it on the worker list, worker detail, and the worker preview in the chat thread. OK?
2. **Incidents verification**: who marks an incident as `verified`? I'll default to admin-only (via existing `has_role(..., 'admin')`) so a single unverified report can't destroy a worker's score. OK?

If both are fine, reply "ok procedi" and I'll start with the migration.
