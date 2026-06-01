# Pupillo — Database Overview

Database PostgreSQL gestito da Supabase (Lovable Cloud). Tutte le modifiche di schema passano da migrazioni in `supabase/migrations/` (read-only: si aggiungono solo nuove migrazioni timestamped).

## Principi

- **RLS abilitata su tutte le tabelle utente.**
- **Ruoli in tabella dedicata `user_roles`** + funzione `has_role(uuid, app_role)` SECURITY DEFINER. **MAI** ruoli su `profiles`.
- **GRANTS espliciti** su ogni tabella `public.*` (PostgREST non concede default).
- **Validazioni complesse** via trigger, non CHECK constraints (per gestire condizioni temporali).
- **Schemi riservati** (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`) non vanno mai modificati.

## Tabelle principali

### Identity & ruoli
- **`profiles`** — profilo unico (worker + restaurant + admin discriminati da `primary_role` e `user_roles`). Contiene PII (telefono, email, documento, indirizzo residenza/sede), reputazione (`reputation_score`, `reputation_level`, `avg_*`, `*_pct`), credito (`credits`, `plan`), penalità ricerca, soft-delete (`is_deleted`, `deleted_at`). Lettura PII via RPC `get_my_profile()` (SECURITY DEFINER).
- **`user_roles`** — `(user_id, role app_role)`, unique. Sorgente di verità ruoli.
- **`phone_verifications`** — OTP telefono (hash, expires_at, attempts).

### Marketplace
- **`announcements`** — annunci pubblicati dai ristoratori (data, orario, durata, tariffa, luogo, requisiti, dress code, status, expires_at, assigned_worker_id, cancellation fields).
- **`job_requests`** — bozze/richieste lavoro più dettagliate (campi sovrapposti ad announcements; vedi REFACTOR_NOTES).
- **`applications`** — candidature/proposte tra worker e restaurant (`status application_status`, `binding_offer`, `proposed_tariff`, `response_deadline`, `worker_response_at`, `last_message_*`).
- **`proposal_responses`** — log risposte a proposte (accepted/declined/counter) con riferimento al messaggio.
- **`shifts`** — turni assegnati (status `shift_status`: scheduled/confirmed/completed/cancelled/no_show, hours, amount, completed_at, reviewed_*).
- **`favorites`** — annunci preferiti del lavoratore.
- **`restaurant_worker_favorites`** — lavoratori preferiti del ristoratore.

### Chat & notifiche
- **`messages`** — messaggi 1:1 ancorati a `application_id`, con template e action_type.
- **`notifications`** — feed notifiche utente (title, body, link, metadata, read_at).

### Recensioni & reputazione
- **`reviews`** — recensioni reciproche worker↔restaurant: rating + sottometriche (`punctuality`, `professionalism`, `competence`, `reliability`, `teamwork`, `communication`, `staff_collaboration`, `appearance`), `would_rehire`, `positive_tags`/`negative_tags`.
- **`required_reviews`** — recensioni dovute con `due_date`, status, link al review creato.
- **`review_revision_requests`** — richieste di revisione recensione (con ticket supporto).

### Pagamenti & crediti
- **`credit_transactions`** — log immutabile movimenti crediti (`delta`, `balance_after`, `kind`, `reference_id`, `reason`).
- **`subscriptions`** — abbonamenti Stripe (stripe_subscription_id, status, period, environment).
- **`discount_codes`** + **`discount_redemptions`** — codici sconto.
- **`referral_invites`** — programma referral (referrer/referred, credits_amount, status).

### Supporto & ops
- **`support_tickets`** — ticket supporto (user_id, category, role).
- **`activity_logs`** — eventi azione (action, entity_type, entity_id, metadata).
- **`backup_logs`** — log backup (db/storage/github status).
- **`account_deletion_feedback`** — motivo cancellazione account.

## ENUM principali

- `app_role` — `admin | restaurant | worker`
- `application_status` — pending / accepted / declined / withdrawn / expired (verificare migrazioni)
- `shift_status` — scheduled / confirmed / completed / cancelled / no_show
- `announcement_status` — active / closed / cancelled / expired
- `service_speed`, `tariff_type`, `worker_badge`, `user_plan`, `account_status`, `experience_level`, `referral_status`, `discount_applies_to`, `discount_type`, `phone_verification_status`.

## Funzioni rilevanti

- `has_role(uuid, app_role) returns boolean` — controllo permessi.
- `resolve_current_user_role()` — RPC che restituisce ruolo + debug per il client.
- `get_my_profile()` — RPC SECURITY DEFINER per leggere PII proprie (SELECT diretto sui campi PII è revocato per `authenticated`).
- `can_read_application`, `can_update_application`, `can_worker_insert_application` — funzioni usate nelle policy RLS di `applications`.

## Trigger / regole di integrità

- Validazione date documenti (`document_dates_trigger.sql`).
- Aggiornamento `updated_at` su tabelle con la colonna.
- Aggiornamento contatori reputazione su insert/update reviews.
- Aggiornamento `credit_transactions.balance_after` su scalata crediti.

## Realtime

Pubblicazione `supabase_realtime` per `messages` e `notifications` (verificare in migrazioni). Subscription lato client in `src/lib/inbox-realtime.ts`.

## Storage (bucket Supabase)

- Avatar utenti.
- Documenti identità (privato).
- Allegati backup.

I path sono salvati su `profiles` (`avatar_url`, `id_document_path`, `id_document_back_path`).

## Accesso lato app

- **Browser:** `src/integrations/supabase/client.ts` (RLS attiva).
- **Server fn autenticate:** `requireSupabaseAuth` middleware → client scoped utente.
- **Server admin:** `client.server.ts` con SERVICE_ROLE_KEY (bypassa RLS, solo server).
- **MAI** importare `client.server.ts` da codice client.

## Migrazioni

Tutte sotto `supabase/migrations/`. Nome: `YYYYMMDDHHMMSS_<descrittivo>.sql`. Non modificare migrazioni esistenti — crearne di nuove timestamped.

## Note di stato

- ✅ Schema completo per i flussi attuali.
- ⚠️ Sovrapposizione `announcements` ↔ `job_requests` (molti campi duplicati): verificare quale è la sorgente di verità per nuovi sviluppi (vedi REFACTOR_NOTES).
- ⚠️ Colonne `is_demo` / `seed_batch_id` su quasi tutte le tabelle: utili per dev/seed, attenzione a non leakkare dati demo in produzione.
- ⚠️ Campo `representative_age` su `profiles` (legacy): verificare uso.