# Pupillo — Refactor Notes

**Nessun file è stato cancellato.** Questo documento elenca punti potenzialmente fragili, duplicazioni, e opportunità di pulizia per una futura ricostruzione MVP in Antigravity. Validare ciascun punto con il proprietario prima di intervenire.

## 1. Route alias / naming misto IT-EN

Convivono nomi inglesi e italiani che possono sovrapporsi:

| EN (canonico) | IT (alias/dominio ristoratore) |
| --- | --- |
| `announcements.new.tsx` | `ristoratore.annunci.nuovo.tsx` |
| `workers.tsx` / `workers_.$id.tsx` | — |
| `shifts.tsx` | `ristoratore.turni.$shiftId.tsx` |
| — | `ristoratore.collaboratori.tsx` |
| `restaurants.$id.tsx` | `ristoratori.tsx` |

**Rischio:** confusione, link rotti, doppio mantenimento. **Azione consigliata:** scegliere una convenzione unica (suggerito IT per coerenza con utenti) e rendere le altre redirect.

## 2. `announcements` vs `job_requests` (schema)

Le due tabelle hanno molti campi sovrapposti (indirizzo, requisiti, dress code, contact_person, ecc.). Non è chiaro quale sia la sorgente di verità per nuove feature.

**Azione consigliata:** documentare il purpose di ciascuna (es. `job_requests` = bozza, `announcements` = pubblicato) e valutare merge/foreign key.

**Stato confermato (utente):** entrambe sono in uso attivo nel codice
(`job_requests` referenziata in `admin.backend.tsx`, `dashboard.tsx`,
`ristoratore.annunci.nuovo.tsx`, `ristoratore.turni.$shiftId.tsx`,
`messages.$id.tsx`, `announcements.$id.tsx`, e nelle funzioni
`backup-system`, `backup-restore`, `cleanup-test-profiles`,
`announcement-positions`). Nessuna delle due è da deprecare oggi: il
merge va valutato in una fase di refactor dedicata, non in export.

## 2bis. GitHub CI workflow

`.github/workflows/ci.yml` è già configurato (lint + test + coverage su
Bun, push/PR su `main`). Per Antigravity non servono modifiche: importare
il repo conserva il workflow. Verificare solo che i secrets necessari
(`SUPABASE_*`, `STRIPE_*`, `LOVABLE_API_KEY`) siano replicati in
GitHub → Settings → Secrets se si vogliono eseguire test E2E in CI.

## 2ter. `.env.example`

Creato `.env.example` alla root con i nomi (senza valori) di tutte le
variabili attese: Supabase client/server, Stripe sandbox/live, Lovable AI,
e placeholder commentati per Twilio / Mapbox. Usarlo come riferimento
quando si importa il progetto in Antigravity o altro ambiente.

## 3. File seed / demo / utility alla root

File alla radice del progetto utili in dev ma fuori posto:

- `.finish.mjs`
- `.seed-d.mjs`
- `src/lib/demo-seed-data.ts`, `demo-seed.functions.ts`, `demo-seed.server.ts`, `demo-seed-guard.server.ts`
- `src/lib/populate-test-users.functions.ts`
- `src/lib/cleanup-test-profiles.functions.ts`
- `src/routes/admin.reset-test-db.tsx`

**Azione consigliata:** spostare script standalone sotto `scripts/`, e gate-are tutte le funzioni demo dietro `process.env.NODE_ENV !== 'production'` o ruolo admin verificato. Verificare flag `is_demo` / `seed_batch_id` in DB per impedire leak in production.

## 4. Colonne `is_demo` / `seed_batch_id` ovunque

Presenti su quasi tutte le tabelle (announcements, applications, shifts, messages, notifications, reviews, profiles, favorites, ecc.).

**Rischio:** se in produzione vengono filtrati male, dati demo visibili a utenti reali. **Azione consigliata:** policy RLS o view che escludono `is_demo=true` per utenti non-admin, oppure rimozione completa colonne quando il dataset di prod è pulito.

## 5. Helper privacy duplicati

- `src/lib/candidate-display.ts`
- `src/lib/worker-display.ts`
- `src/lib/already-in-contact.ts`
- `src/lib/known-restaurants-cache.ts`

Logica di masking nome/contatti distribuita. **Azione consigliata:** consolidare in un singolo modulo `privacy-display.ts` con API coerente.

## 6. Localizzazione luogo

- `src/lib/format-location.ts` (dedup città — recente)
- `src/lib/italian-locations.ts`, `italian-city-coords.ts`, `worker-location-summary.ts`, `public-location.ts`, `worker-cities.ts`, `geocode.ts`

**Azione consigliata:** unificare in modulo `geo/` con sotto-file chiari (`format.ts`, `geocode.ts`, `cities.ts`, `coords.ts`).

## 7. Componenti mappa duplicati

- `AnnouncementMap.tsx` + `AnnouncementMapInner.tsx`
- `ApproximateAreaMap.tsx` + `ApproximateAreaMapInner.tsx`
- `WorkerServiceAreaMap.tsx` + `WorkerServiceAreaMapInner.tsx`
- `WorkersMap.tsx` + `WorkersMapInner.tsx`
- `MapViewInner.tsx`

Il pattern wrapper+Inner è dovuto a SSR/`react-leaflet`, ma c'è ridondanza tra i quattro wrapper. **Azione consigliata:** creare un `LeafletMap` base parametrizzato (markers, popup renderer, controls) ed eliminare doppioni.

## 8. Onboarding lavoratore complesso in un solo file

`src/routes/onboarding.tsx` gestisce sia worker che restaurant con molti step. **Azione consigliata:** spezzare in route layout `_onboarding/$step` o componenti separati per ruolo.

## 9. `profiles` come god-table

`profiles` contiene PII, dati attività ristorante, dati lavoratore (rating, badge, reputazione, zone), penalità, referral. ~120+ colonne.

**Azione consigliata (MVP rebuild):** valutare split in `profiles_user` (base), `worker_profile`, `restaurant_profile`, `worker_reputation`, `worker_penalty` — mantenendo lookup via `id` condiviso. Migrazione delicata: documentare e fare a tappe.

## 10. Server fn dichiarate accanto a helper non-server

Convenzione: `*.functions.ts` = server fn, `*.server.ts` = helper server-only. La maggior parte è rispettata, ma verificare che file `*.functions.ts` non esportino anche utility client (rischio leak `client.server` nel bundle browser — vedi `tanstack-supabase-import-graph`).

## 11. Test coverage

- Buona copertura su utility (`lib/__tests__`) e proposal flow e2e.
- **Gap:** test su soft-match disponibilità, no-show 15min guard, scalata 7 crediti, dedup città. **Azione consigliata:** aggiungere test prima di rifattorizzare.

## 12. File preconfigurati / generati

Da NON toccare (lista in `PROJECT_OVERVIEW.md`). Antigravity deve trattarli come read-only.

## 13. Documentazione duplicata

Esiste già `PUPILLO_FULL_REBUILD_DOCUMENTATION.md` alla root (generato in sessione precedente). **Azione consigliata:** mantenere `docs/` come fonte unica e linkarci dal vecchio file, oppure spostarlo in `docs/legacy/`.

## 14. Cron / scheduler

`src/routes/api/public/hooks/expire-stale.ts` è chiamato da scheduler esterno (pg_cron o cron URL stabile). Verificare che la chiamata sia configurata e protetta da signature / secret header.

## 15. Sincronizzazione GitHub

- CI in `.github/workflows/ci.yml` — verificare che esegua `vite build` + `vitest run` + `vitest run --config vitest.e2e.config.ts`.
- Lovable gestisce push automatici al repo collegato. **Azione manuale:** prima dell'export, controllare in Lovable → GitHub che il branch sia aggiornato e che non ci siano commit locali pendenti.
- Verificare che `.gitignore` escluda `.env`, `.env.development`, build artifacts (`dist/`, `.tanstack/`, `node_modules/`).

## 16. Configurazione Supabase centralizzata

✅ Già centralizzata:
- `supabase/config.toml` (solo `project_id`).
- `.env` / `.env.development` (autogenerati) con `VITE_SUPABASE_*` e `VITE_SUPABASE_PROJECT_ID`.
- Client unificati in `src/integrations/supabase/`.

⚠️ Verificare in Antigravity di **non** committare `.env` reali e di ricreare le secret server-side (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `LOVABLE_API_KEY`) nel nuovo ambiente.

## 17. Cosa NON rifattorizzare

- Design system in `src/styles.css` (token oklch).
- Routing TanStack (`src/router.tsx`, `__root.tsx`).
- Client Supabase generati.
- Logica privacy/crediti/no-show (è già coerente con le regole utente).
- Microcopy italiana visibile all'utente.

## Checklist export verso Antigravity

- [ ] Lovable → GitHub sync OK, branch `main` allineato.
- [ ] Clone locale, `bun install` (o `npm install`), `bun run build` verde.
- [ ] Copia `.env.example` con tutte le chiavi necessarie (creare se manca, **senza** valori).
- [ ] Verifica Supabase project access (URL + anon key + service role key in vault Antigravity).
- [ ] Stripe keys (test) configurate.
- [ ] `docs/` letto interamente prima di iniziare.
- [ ] Test suite eseguita: `bun run test` + `bun run test:e2e`.
- [ ] Confermare con il product owner le regole di business della sezione 5 di `FEATURES_MAP.md` prima di modificarle.