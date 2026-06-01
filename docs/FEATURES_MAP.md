# Pupillo — Features Map

Mappa dettagliata di pagine, componenti e flussi attualmente implementati. Pensata per essere letta da uno sviluppatore che ricostruisce/migliora il progetto in Antigravity.

## 1. Pagine (route)

File-based routing TanStack: ogni file `src/routes/*.tsx` = una pagina. Convenzione punto `posts.$id.tsx` = `/posts/:id`.

### Pubbliche / marketing

| Route | File | Scopo | Stato |
| --- | --- | --- | --- |
| `/` | `index.tsx` | Landing pubblica | ✅ |
| `/come-funziona` | `come-funziona.tsx` | Spiegazione marketplace | ✅ |
| `/terms` | `terms.tsx` | Termini d'uso | ✅ |
| `/auth` | `auth.tsx` | Login + signup (email/password + Google) | ✅ |
| `/reset-password` | `reset-password.tsx` | Reset password | ✅ |
| `/registration-success` | `registration-success.tsx` | Post-signup | ✅ |
| `/verify-phone` | `verify-phone.tsx` | OTP telefono | ✅ |
| `/forbidden`, `/account-error` | omonimi | Errori auth | ✅ |

### Lavoratore

| Route | File | Scopo |
| --- | --- | --- |
| `/jobs` | `jobs.tsx` | Home lavoratore — proposte ricevute, turni in arrivo |
| `/browse` | `browse.tsx` | "Trova offerte" — feed annunci con soft-match disponibilità (gruppi *Compatibili* / *Altre offerte*) |
| `/availability` | `availability.tsx` | Gestione disponibilità settimanale + eccezioni speciali |
| `/mappa` | `mappa.tsx` | Vista mappa annunci |
| `/ristoratori` | `ristoratori.tsx` | Lista ristoratori |
| `/restaurants/:id` | `restaurants.$id.tsx` | Profilo ristoratore (pubblico parziale) |
| `/announcements/:id` | `announcements.$id.tsx` | Dettaglio annuncio |

### Ristoratore

| Route | File | Scopo |
| --- | --- | --- |
| `/dashboard` | `dashboard.tsx` | Home ristoratore |
| `/announcements` | `announcements.tsx` | "I miei annunci" |
| `/announcements/new` | `announcements.new.tsx` | Wizard nuovo annuncio (alias `ristoratore.annunci.nuovo.tsx`) |
| `/workers` | `workers.tsx` | "Cerca lavoratori" — soft-match |
| `/workers/:id` | `workers_.$id.tsx` | Profilo lavoratore (privacy masked) |
| `/shifts` | `shifts.tsx` | "I miei turni" (gestione no-show, annulla turno) |
| `/ristoratore/turni/:shiftId` | `ristoratore.turni.$shiftId.tsx` | Dettaglio turno |
| `/ristoratore/collaboratori` | `ristoratore.collaboratori.tsx` | Collaboratori storici (solo dopo turno chiuso) |
| `/billing` | `billing.tsx` | Crediti + abbonamenti Stripe |

### Comuni autenticati

| Route | File | Scopo |
| --- | --- | --- |
| `/onboarding` | `onboarding.tsx` | Onboarding multi-step per ruolo |
| `/profile` | `profile.tsx` | Profilo utente |
| `/messages` | `messages.tsx` | Inbox |
| `/messages/:id` | `messages.$id.tsx` | Thread di chat per `application_id` |
| `/notifications` | `notifications.tsx` | Centro notifiche |
| `/reviews/:id` | `reviews.$id.tsx` | Form recensione obbligatoria |

### Admin

| Route | File | Scopo |
| --- | --- | --- |
| `/admin` | `admin.tsx` | Dashboard admin (backup, ripristino ruoli, ticket, recensioni richieste) |
| `/admin/backend` | `admin.backend.tsx` | Debug backend |
| `/admin/reset-test-db` | `admin.reset-test-db.tsx` | Reset DB di test |

### API pubbliche (server routes)

| Route | File | Scopo |
| --- | --- | --- |
| `POST /api/public/payments/webhook` | `api/public/payments/webhook.ts` | Webhook Stripe (verifica signature) |
| `POST /api/public/hooks/expire-stale` | `api/public/hooks/expire-stale.ts` | Cron expire annunci/applicazioni |

## 2. Componenti principali (`src/components/`)

### Layout & guard
- `AppShell.tsx` — chrome dell'app autenticata (nav, header).
- `RequireAuth.tsx`, `RequireRole.tsx` — gate route (vedi `auth-context.tsx`).
- `ProfileGate.tsx`, `RestaurantProfileGate.tsx`, `PhoneVerificationGate.tsx` — obblighi pre-uso.
- `SiteAccessGate.tsx` — gate accesso pubblico (es. soft launch).
- `StalePreviewOverlay.tsx` — overlay preview stale.

### Dominio
- `NotificationBell.tsx`, `WorkerIncidentDialogs.tsx`, `RequiredReviewsBanner.tsx`, `AdminRequiredReviewsSection.tsx`.
- Recensioni: `RequestReviewRevisionDialog.tsx`, `ReviewLabelsPicker.tsx`, `WouldRehirePicker.tsx`, `WorkerMyReviews.tsx`, `WorkerRatingSummary.tsx`, `WorkerReputationBadge.tsx`, `WorkerReputationCard.tsx`.
- Annunci/turni: `AnnouncementMap*`, `ApproximateAreaMap*`, `ConfirmedWorkerCard.tsx`, `CounterofferDialog.tsx`, `WorkerProfilePreviewDialog.tsx`, `AlreadyInContactDialog.tsx`, `BlockedContactDialog.tsx`, `InsufficientCreditsDialog.tsx`, `SaveToFavoritesPrompt.tsx`.
- Form profilo: `AvatarUpload.tsx`, `BirthDateSelect.tsx`, `CapField.tsx`, `DateField.tsx`, `DistrictField.tsx`, `HourlyRateInput.tsx`, `IdDocumentDropzone.tsx`, `PhoneInput.tsx`, `SearchableSelect.tsx`, `SpokenLanguages.tsx`, `WorkerRolesMultiSelect.tsx`, `WorkerServiceAreaMap*`, `ZonesMultiSelect.tsx`, `UseCurrentLocationButton.tsx`.
- Admin: `AdminBackupRestoreSection.tsx`, `AdminBackupSystemSection.tsx`, `AdminBackupsSection.tsx`, `AdminRoleRepairSection.tsx`, `AdminSupportTicketsSection.tsx`.
- Pagamenti: `StripeEmbeddedCheckout.tsx`, `PaymentTestModeBanner.tsx`, `PayOnHireInfo.tsx`.
- Assistant AI: `assistant/AssistantFab.tsx`, `assistant/AssistantPanel.tsx`, `assistant/ReportProblemDialog.tsx`.
- Icone branded: `PupilloIcons.tsx`.
- shadcn primitives in `components/ui/*` (non modificare).

## 3. Business logic & server functions (`src/lib/`)

File `*.functions.ts` = server functions chiamate dal client. File `*.server.ts` = helper server-only (mai importare da client). Esempi chiave:

- **Auth & ruoli:** `auth-context.tsx`, `role-repair.functions.ts`, `server-fn-auth.ts`.
- **Onboarding:** `onboarding-date-guard.ts`, `restaurant-onboarding-navigation.ts`, `restaurant-defaults.ts`.
- **Annunci/proposte:** `announcement-cancel.ts`, `announcement-positions.ts`, `announcement-requirements.ts`, `announcement-time.ts`, `application-card.ts`, `proposal-status.ts`, `proposal-assign.functions.ts`, `shift-proposal.ts`, `shift-confirmation.ts`, `last-announcement.ts`.
- **Disponibilità & matching:** `availability.ts`, `availability-summary.ts`, `worker-availability-summary.ts`, `worker-special-availability.ts`, `worker-search.functions.ts`, `worker-cities.ts`, `worker-location-summary.ts`.
- **Recensioni & reputazione:** `reputation.ts`, `required-reviews.ts`, `review-labels.ts`, `worker-incidents.ts`.
- **Credito & pagamenti:** `credits.ts`, `pricing.ts`, `stripe.ts`, `stripe.server.ts`, `utils/payments.functions.ts`.
- **Chat & notifiche:** `inbox-realtime.ts`, `messages-grouping.ts`, `notification-link.ts`, `toast-dedup.ts`.
- **Verifica identità:** `phone-verification.functions.ts`, `phone-verification-gate.ts`, `id-document-*`, `document-dates.ts`, `vat.functions.ts`.
- **Geo & city:** `geocode.ts`, `italian-city-coords.ts`, `italian-locations.ts`, `public-location.ts`, `map-preview.ts`, `format-location.ts` (dedup città).
- **Privacy:** `candidate-display.ts`, `worker-display.ts`, `already-in-contact.ts`, `known-restaurants-cache.ts`.
- **Admin/sistema:** `admin-backups.functions.ts`, `backup-system.functions.ts`, `backup-restore.functions.ts`, `cleanup-test-profiles.functions.ts`, `populate-test-users.functions.ts`, `demo-seed.functions.ts`, `account-deletion.functions.ts`, `site-access.functions.ts`.
- **Assistant AI:** `assistant.functions.ts`, `assistant-kb.ts`.

## 4. Flussi utente

Vedi `USER_FLOWS.md` per la descrizione passo-passo (signup, pubblicazione annuncio, proposta, conferma, no-show, recensione).

## 5. Regole di business chiave (estratto)

- **Regola crediti:** la conferma finale del turno da parte del ristoratore scala **7 crediti** e sblocca dati personali del lavoratore (nome completo, telefono). Non scalare prima.
- **Regola no-show:** il pulsante "No show" è abilitato **solo dopo 15 minuti** dall'inizio del turno, **solo su turni confermati e non chiusi**, e richiede popup di conferma esplicito.
- **Regola "Già collaboratore":** la label appare **solo dopo almeno un turno chiuso/completato** tra le parti. Proposta accettata ≠ collaborazione.
- **Regola annullamento:** pulsante "Annulla turno" stile destructive con conferma; logica DB invariata.
- **Regola luogo:** la UI formatta `formatShiftLocation()` per evitare città ripetute (es. "Torino, Torino" → "Torino"); non modificare i dati salvati.
- **Regola visibilità:** disponibilità lavoratore = ordinamento e badge, **mai** filtro escludente. Annunci/lavoratori non scompaiono per mismatch città.
- **Regola notifica interesse:** quando un lavoratore mostra interesse a una proposta del ristoratore, il ristoratore riceve UNA notifica chiara ("candidato interessato"); crediti non scalati, dati non sbloccati.
- **Regola privacy chat:** nomi mascherati finché conferma finale non avvenuta.

## 6. Dipendenze esterne importanti

- Supabase (Lovable Cloud) — ref progetto interno `loxgasjxsjyskyapmxke` (no segreti pubblicati).
- Stripe (test + live) — checkout embedded.
- Lovable AI Gateway — modelli Gemini/GPT senza API key utente.
- Leaflet (mappe, no API key).
- Provider OAuth: Google (via Lovable broker — `src/integrations/lovable`).

## 7. Test

- Unit: `src/lib/__tests__/*` e `src/components/__tests__/*` (Vitest).
- E2E: `src/routes/__tests__/*` con `vitest.e2e.config.ts`.
- Test SQL: `supabase/tests/document_dates_trigger.sql`.

## 8. Cosa è incompleto / fragile

Dettagli in `REFACTOR_NOTES.md`. Sintesi:
- Alias di route ristoratore (`ristoratore.*` vs `announcements/workers/shifts`) potenzialmente duplicati.
- File "seed/demo" (`demo-seed*`, `populate-test-users*`, `.seed-d.mjs`) — utili in dev, da escludere in build di produzione.
- `cleanup-test-profiles.functions.ts` — operazione distruttiva, gate admin verificato ma da rivedere.
- File `.finish.mjs`, `.seed-d.mjs` alla root — script utility, valutare spostamento in `scripts/`.