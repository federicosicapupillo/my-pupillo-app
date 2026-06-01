# Pupillo — User Flows

Flussi end-to-end correnti. Ogni passo cita la route/file principale per facilitare la riprese in Antigravity.

## A. Registrazione & onboarding

1. Utente apre `/auth` → sceglie ruolo (worker o restaurant), signup email/password o Google (broker Lovable).
2. Email verification (Supabase Auth — auto-confirm **disattivato** per default).
3. Redirect a `/registration-success` → `/onboarding`.
4. **Onboarding ristoratore** (`onboarding.tsx` + helper `restaurant-onboarding-navigation.ts`): dati attività (P.IVA con verifica `vat.functions.ts`), sede, contatto, default annunci.
5. **Onboarding lavoratore:** dati anagrafici, documento identità (upload bucket privato, validazione date in `document-dates.ts`), ruoli, lingue, zone di lavoro, disponibilità settimanale, tariffa oraria.
6. **Verifica telefono OTP** (`/verify-phone`, `phone-verification.functions.ts`) — obbligatoria via `PhoneVerificationGate`.
7. `profiles.profile_completed = true` → accesso pieno; routing per ruolo (`/jobs` worker, `/dashboard` restaurant, `/admin` admin).

## B. Pubblicazione annuncio (Ristoratore)

1. Da `/announcements` → "Nuovo annuncio" (`/announcements/new`, alias `ristoratore.annunci.nuovo.tsx`).
2. Wizard: data/orario, durata (flag `is_long_shift` se >X ore), tariffa, indirizzo (geocode + dedup città `format-location.ts`), requisiti (lingue, dress code, tatuaggi/piercing, skill), default profilo come prefill.
3. Submit → insert `announcements` con `status='active'`, `expires_at = now() + 7 giorni`.
4. L'annuncio compare in `/browse` (worker) e nella mappa `/mappa`.

## C. Trova offerte (Lavoratore) — soft-match

1. `/browse` carica annunci attivi.
2. Calcolo compatibilità per annuncio (`computeCompatibility` su `weeklyAvailability` + `specialExceptions`).
3. Lista divisa in due sezioni: **"Offerte compatibili con la tua disponibilità"** e **"Altre offerte disponibili"**.
4. Badge per card: `Compatibile`, `Disponibilità parziale`, `Altra città`, `Fuori disponibilità`.
5. **Mai** filtrare via hard-filter: la disponibilità ordina e segnala, non esclude.

## D. Cerca lavoratori (Ristoratore) — soft-match

1. `/workers` carica profili lavoratori attivi via `worker-search.functions.ts`.
2. Filtri espliciti (ruolo, lingue, zona) + soft-match disponibilità per ordinamento.
3. Profili mostrati con privacy parziale (`worker-display.ts`, `candidate-display.ts`): nome di battesimo + iniziale cognome, no telefono/email fino a conferma turno.
4. Click → `/workers/:id` (preview) o invio proposta diretta.

## E. Proposta bilaterale

### Da Ristoratore a Lavoratore
1. Ristoratore invia proposta da `/workers/:id` o da annuncio: insert `applications` (`status='pending'`, `binding_offer=true`, `response_deadline = now()+24h`, `restaurant_id=auth.uid()`).
2. Lavoratore riceve notifica → vede su `/jobs` e `/messages`.
3. Lavoratore apre `/messages/:application_id` → bottone "Sono interessato" / "Invia disponibilità".
4. Click → insert `proposal_responses(status='interested')` + messaggio sistema.
5. **Ristoratore riceve UNA notifica chiara** "candidato interessato a una tua proposta".
   - ❌ NO crediti scalati.
   - ❌ NO dati personali sbloccati.
   - ❌ NO conferma automatica.
6. Ristoratore valuta → conferma finale (vedi flusso F).

### Da Lavoratore a Annuncio
1. Worker su `/announcements/:id` → "Mi candido": insert `applications` (`worker_id=auth.uid()`).
2. Restaurant riceve notifica → chat su `/messages/:application_id`.
3. Stesso flusso di accettazione.

## F. Conferma finale turno (scalata 7 crediti)

1. Ristoratore in chat / dashboard preme "Conferma turno" (`shift-confirmation.ts`).
2. Check crediti: se < 7 → `InsufficientCreditsDialog` → redirect `/billing`.
3. Transazione: scala 7 crediti (`credit_transactions` insert con `kind='shift_confirm'`), insert `shifts` (`status='scheduled'` o `'confirmed'`), update `applications.status='accepted'`, update `announcements.assigned_worker_id`.
4. Sblocca PII lavoratore lato ristoratore (nome completo, telefono via `phone_full`).
5. Notifica lavoratore "Turno confermato".

## G. Gestione "I miei turni" (Ristoratore)

`/shifts` mostra turni passati/in corso/futuri.

### Annulla turno
- Pulsante **"Annulla turno"** stile destructive + popup conferma. Logica DB invariata (update `shifts.status='cancelled'`, eventuale rimborso crediti per cancellazioni con preavviso secondo regole).

### No-show
- Pulsante disponibile **solo** se: turno `confirmed`, **passati ≥15 min** dall'inizio, non già chiuso/cancellato.
- Click → popup conferma → update `shifts.status='no_show'`, incremento `profiles.no_show_count`, notifica lavoratore, aggiornamento reputazione + penalità.

### Chiusura
- A turno terminato (orario passato) → "Completa turno": update `shifts.status='completed'`, `completed_at=now()`, crea `required_reviews` per entrambe le parti.

## H. Collaboratori (Ristoratore)

- `/ristoratore/collaboratori` mostra lavoratori con cui c'è **almeno un turno chiuso/completato**.
- Label "Già collaboratore" su lavoratore in `/announcements` solo se questa condizione è vera (vedi `candidate-display.ts`).

## I. Recensioni

1. Dopo `completed_at`, creazione `required_reviews` (worker e restaurant).
2. Banner `RequiredReviewsBanner` + notifica.
3. Form su `/reviews/:required_review_id` (rating + sottometriche + tags + would_rehire opzionale).
4. Submit → insert `reviews`, update `required_reviews.completed_at`, ricalcolo `profiles.rating_avg`, `reputation_score`, ecc.
5. Eventuale richiesta revisione (`review_revision_requests`) → ticket admin.

## J. Notifiche & chat realtime

- Subscription Supabase realtime su `messages` (per `application_id` corrente) e `notifications` (per `user_id`).
- `NotificationBell` mostra unread count.
- `toast-dedup.ts` evita toast duplicati.

## K. Pagamenti & crediti

- `/billing` mostra saldo crediti, piano attivo, storico transazioni.
- Acquisto pacchetto crediti / abbonamento → `StripeEmbeddedCheckout` (server fn in `stripe.server.ts`).
- Webhook Stripe → `src/routes/api/public/payments/webhook.ts` (verifica signature → insert/update `subscriptions` + `credit_transactions` via `supabaseAdmin`).

## L. Admin

- `/admin` raggruppa sezioni: Backup (`AdminBackupsSection`, `AdminBackupSystemSection`, `AdminBackupRestoreSection`), Ripristino ruoli (`AdminRoleRepairSection`), Ticket supporto (`AdminSupportTicketsSection`), Recensioni dovute (`AdminRequiredReviewsSection`).
- `/admin/reset-test-db` — reset dati di test (gate admin obbligatorio).
- `/admin/backend` — debug.

## M. Eliminazione account

1. Da `/profile` → "Elimina account" (`DeleteAccountDialog`).
2. Inserimento motivo opzionale → `account-deletion.functions.ts` → soft-delete `profiles.is_deleted=true`, `deleted_at=now()`, anonimizzazione PII, log `account_deletion_feedback`.
3. Logout forzato, redirect `/auth?deleted=1`.
4. `RequireAuth` blocca rientro con messaggio.

## N. Assistant AI

- FAB globale `AssistantFab` → `AssistantPanel` con knowledge base in `assistant-kb.ts`.
- Backend: `assistant.functions.ts` chiama Lovable AI Gateway (modello Gemini/GPT) senza API key utente.
- Pulsante "Segnala problema" apre `ReportProblemDialog` → crea `support_tickets`.