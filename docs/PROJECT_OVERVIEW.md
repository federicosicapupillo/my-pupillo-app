# Pupillo — Project Overview

Pupillo è un portale per la ristorazione che mette in contatto **ristoratori** e **lavoratori** (camerieri, cuochi, runner, ecc.) per turni extra e collaborazioni operative. Il progetto è già esistente e funzionante; questo documento serve a passarlo in un IDE esterno (es. Google Antigravity) mantenendo logica, dati e flussi correnti.

## Stack tecnico

- **Framework:** TanStack Start v1 (React 19 + Vite 7) — file-based routing in `src/routes/`, server functions tramite `createServerFn`. Target deploy: Cloudflare Worker (vedi `wrangler.jsonc`).
- **UI:** Tailwind CSS v4 (token in `src/styles.css` con `oklch`), shadcn/ui (`src/components/ui/*`), Radix UI primitives, `lucide-react`, mappe Leaflet/react-leaflet.
- **Stato dati:** TanStack Query (`@tanstack/react-query`).
- **Form:** react-hook-form + zod + `@hookform/resolvers`.
- **Auth & DB:** Supabase (Lovable Cloud) — auth email/password + Google OAuth via Lovable broker. Client browser in `src/integrations/supabase/client.ts`, admin (service role) in `client.server.ts`, middleware `requireSupabaseAuth` in `auth-middleware.ts`.
- **Pagamenti:** Stripe (`@stripe/stripe-js`, `stripe`) — checkout embedded + webhook in `src/routes/api/public/payments/webhook.ts`.
- **Test:** Vitest (unit + e2e config separati: `vitest.config.ts`, `vitest.e2e.config.ts`).
- **AI assistant:** integrazione Lovable AI Gateway (`src/lib/assistant.functions.ts`).

## Ruoli applicativi

Tre ruoli, gestiti tramite tabella `user_roles` + funzione `has_role()` (security definer) — **mai** ruoli memorizzati su `profiles` per evitare privilege escalation.

- **worker** (lavoratore) — cerca offerte, dichiara disponibilità, accetta proposte.
- **restaurant** (ristoratore) — pubblica annunci, contatta lavoratori, conferma turni, lascia recensioni.
- **admin** — backend interno, backup, gestione ticket, ripristini ruoli.

Routing post-login: `routeForRole()` in `src/lib/auth-context.tsx` → admin `/admin`, restaurant `/dashboard`, worker `/jobs`.

## Architettura cartelle

```
src/
  routes/                  # file-based routing TanStack
    api/public/            # webhook & cron pubblici (Stripe, expire-stale)
    __root.tsx             # shell HTML, providers
  components/              # UI condivisa + componenti dominio
    ui/                    # shadcn primitives (non modificare)
    assistant/             # AI assistant (FAB + panel)
  integrations/supabase/   # AUTO-GENERATI — non editare
    client.ts, client.server.ts, auth-middleware.ts,
    auth-attacher.ts, types.ts
  integrations/lovable/    # broker OAuth Google
  lib/                     # business logic, server fn, utils
  hooks/                   # hook condivisi
  styles.css               # design tokens (oklch)
  router.tsx, start.ts, server.ts
supabase/
  migrations/              # storico schema (read-only)
  config.toml              # solo project_id
docs/                      # questa documentazione
```

## Convenzioni di progetto

- **Server side:** usare **sempre** `createServerFn` (TanStack), **non** Supabase Edge Functions. Webhook esterni → server route sotto `src/routes/api/public/*`.
- **Design tokens semantici** (`--primary`, `--background`, ecc.): vietato hardcodare colori in componenti.
- **Microcopy in italiano** (utente finale italiano).
- **Privacy:** dati personali (nome completo, telefono) sbloccati solo dopo conferma finale del turno e scalata dei 7 crediti (Regola 6 — vedi `FEATURES_MAP.md`).
- **Soft-match disponibilità:** la disponibilità del lavoratore **ordina** e segnala compatibilità, **non filtra** mai in modo rigido.

## File preconfigurati — NON modificare

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/types.ts`
- `src/routeTree.gen.ts` (autogenerato)
- `.env`, `.env.development`
- `supabase/config.toml` (solo `project_id`)

## Variabili d'ambiente

Browser (`import.meta.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Server (`process.env`, **mai** nel bundle client):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `LOVABLE_API_KEY` (gestita)
- altre secret runtime (verificare con `fetch_secrets`)

## Stato sintetico

- ✅ Auth (email/password + Google), onboarding ristoratore/lavoratore, verifica telefono OTP.
- ✅ Pubblicazione annunci, ricerca lavoratori/offerte, proposte bilaterali.
- ✅ Sistema crediti, abbonamenti Stripe, webhook pagamenti.
- ✅ Chat tra parti con privacy masking, notifiche, recensioni reciproche.
- ✅ Reputazione, no-show con guardia +15 min, incidenti lavoratore.
- ✅ Admin: backup, ripristino ruoli, ticket supporto.
- ⚠️ Vedi `REFACTOR_NOTES.md` per fragilità e duplicazioni.

## URL progetto

- Preview: `https://id-preview--81341205-eede-4204-8584-66229ea985c7.lovable.app`
- Published: `https://my-pupillo-app.lovable.app`
- Custom: `https://www.pupillo.life`, `https://pupillo.life`