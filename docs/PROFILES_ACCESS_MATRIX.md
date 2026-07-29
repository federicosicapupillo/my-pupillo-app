# Profiles / Reviews / Announcements — Access Matrix (Fase 1)

Scope: tutte le occorrenze di `.from("profiles")` in `src/` (91 call site, 45 file).
Classificazione superficie futura: **OWN** = proprio profilo · **PUB** = vista `public_profiles` · **AUTH** = RPC autorizzata (post‑match) · **ADMIN** = solo admin/backend · **KEEP** = resta su `profiles` (server‑side, service role o middleware auth).

## Legenda ruoli
- W = worker autenticato · R = ristoratore autenticato · A = admin · SYS = server function (service role o auth middleware) · ANON = non autenticato.

## 1. Letture — proprio profilo (OWN)

| File:line | Ruolo | Colonne | Motivo | Superficie |
|---|---|---|---|---|
| routes/billing.tsx:146 | W/R | `credits` | Saldo crediti utente corrente | OWN (`get_my_profile`) |
| routes/messages.$id.tsx:1441 | R | `credits` | Check saldo prima di conferma | OWN |
| routes/announcements.$id.tsx:513 | R | `credits` | Check saldo prima conferma | OWN |
| routes/browse.tsx:540 | W | `id` | Solo esistenza profilo | OWN |
| lib/required-reviews.ts:295 | W/R | `review_blocked` | Gate proprio blocco recensioni | OWN |

## 2. Letture — profilo altrui, dati pubblici (PUB → `public_profiles`)

Tutte queste query oggi girano su `profiles` e ricevono `.select(...)` esplicito con solo colonne "vetrina". Devono migrare alla vista pubblica.

| File:line | Ruolo | Chi legge chi | Colonne richieste | Superficie |
|---|---|---|---|---|
| routes/workers_.$id.tsx:89 | R | ristoratore → worker | id, full_name, professional_profile, primary_role, secondary_roles, experience_years, experience_level, languages, spoken_languages, city, neighborhood, province, rating_avg, reviews_count, badge, reliability_pct, completed_shifts, hourly_rate, hourly_availability, weekly_availability, age, is_motorized, reputation_score, reputation_level, punctuality_pct, completion_pct, no_show_count, rehire_*, distinct_restaurants_count, avatar_url, phone_verified, profile_completed, is_deleted, service_area_city, service_area_district, selected_zones, all_zones **+ phone, email, id_document_path** ← PII da rimuovere | PUB (rimuovere phone/email/id_document_path; passare da RPC `get_worker_contact_for_confirmed` per contatti) |
| components/WorkerProfilePreviewDialog.tsx:107 | R | ristoratore → worker | id, full_name, primary_role, secondary_roles, city, neighborhood, province, service_area_city, service_area_district, selected_zones, all_zones, badge, rating_avg, reviews_count, reliability_pct, punctuality_pct, completion_pct, avg_professionalism, avg_competence, completed_shifts, hourly_rate, weekly_availability, hourly_availability, reputation_level, spoken_languages, languages, experience_level, experience_years, is_motorized | PUB |
| routes/mappa.tsx:560 | R | R → workers list | id, full_name, primary_role, secondary_roles, city, neighborhood, service_area_*, badge, rating_avg, reviews_count, reliability_pct, completed_shifts, hourly_rate, experience_level, weekly_availability, hourly_availability, available_now_until, work_area_mode, all_zones, selected_zones, business_name, punctuality_pct, avg_professionalism **+ account_status** ← campo amministrativo | PUB (rimuovere account_status; filtrare lato vista `WHERE account_status='active' AND NOT moderation_hidden AND NOT is_deleted`) |
| routes/mappa.tsx:566 | W | W → restaurants list | id, business_name, full_name, venue_type, venue_type_other, price_range, address, city, province, neighborhood, service_area_*, latitude, longitude, rating_avg **+ contact_person_first_name/last_name/role/phone/email, account_status, plan, credits** ← PII + admin | PUB per vetrina; contatti solo via RPC dopo assegnazione; rimuovere account_status/plan/credits |
| routes/mappa.tsx:656 | any | R/W | city, service_area_city, neighborhood, service_area_district | PUB |
| routes/browse.tsx:159 | W | W → restaurant | id, full_name, business_name, venue_type, city, neighborhood, rating_avg | PUB |
| routes/browse.tsx:215 | W | W → restaurants list | id, city, neighborhood, is_deleted | PUB |
| routes/announcements.$id.tsx:234 | W | W → restaurant di annuncio | id, full_name, business_name, venue_type, venue_type_other, address, city, neighborhood, price_range, rating_avg, reviews_count, opening_hours, employees_count **+ phone, email** ← PII da rimuovere | PUB (contatti via RPC `get_announcement_contact` esistente) |
| routes/announcements.$id.tsx:316 | R | R → candidati | id, full_name, first_name, last_name, age, city, professional_profile, primary_role, languages, rating_avg, reviews_count, badge, reliability_pct, experience_years, completed_shifts, phone_verified, profile_completed **+ id_document_path, phone_full, phone** ← PII da rimuovere | PUB per liste; contatti/documento via RPC dopo conferma |
| routes/announcements.$id.tsx:374 | R | R → worker assegnato | first_name, full_name | PUB |
| routes/announcements.tsx:517 | R | R → candidati | id, full_name, professional_profile, rating_avg, badge, avatar_url | PUB |
| routes/restaurants.$id.tsx:83 | any | qualsiasi → restaurant page | id, business_name, full_name, avatar_url, city, province, neighborhood, venue_type, venue_type_other, price_range, employees_count, opening_hours, busy_days, rating_avg, reviews_count, plan, badge, primary_role, default_* | PUB (rimuovere `plan`; valutare se `default_*` devono restare admin/owner‑only) |
| routes/ristoratore.collaboratori.tsx:95 | R | R → workers favoriti | id, full_name, avatar_url, badge, rating_avg, primary_role, spoken_languages, reliability_pct | PUB |
| routes/ristoratore.turni.$shiftId.tsx:227 | R | R → worker del turno | id, full_name, first_name, last_name, primary_role, professional_profile, badge, rating_avg, reviews_count, reliability_pct, completed_shifts, languages, spoken_languages, phone_verified, profile_completed **+ id_document_path, phone_full, phone** | PUB + RPC contatti (post‑assegnazione autorizzata) |
| routes/ristoratore.turni.$shiftId.tsx:230 | R | R → self restaurant name | id, business_name, full_name | OWN (è il restaurant.id = user.id) |
| routes/dashboard.tsx:168 | R | R → workers su annunci propri | id, full_name | PUB |
| routes/dashboard.tsx:1039 | R | R → workers preferiti | id, full_name, primary_role, rating_avg | PUB |
| routes/messages.tsx:188 | W/R | controparte lista chat | id, full_name, first_name, business_name | PUB |
| routes/messages.$id.tsx:624 | W/R | controparte chat | full_name, first_name, last_name, business_name, city, neighborhood, reputation_*, completed_shifts, punctuality_pct, completion_pct, rehire_*, distinct_restaurants_count, rating_avg, reviews_count, avatar_url, phone_verified, profile_completed, default_arrival_advance_minutes, primary_role, professional_profile, badge, is_deleted | PUB |
| routes/shifts.tsx:397 | W/R | controparte turni | id, full_name, business_name, city | PUB |
| routes/workers.tsx:764 | R | worker candidato | default_contact_person_name, contact_person_first_name, contact_person_last_name, default_arrival_advance_minutes, default_arrival_advance_reason | AUTH (contatti → RPC post‑conferma); campi di default arrivo → PUB o AUTH secondo prodotto |
| components/PreviousCandidatesSection.tsx:59 | R | R → workers precedenti | id, full_name, first_name, primary_role, reliability_pct, completed_shifts, rating_avg, is_deleted | PUB |
| components/WorkerMyReviews.tsx:90 | W | W → autori recensioni | id, business_name, full_name, city, is_deleted | PUB |
| components/RestaurantReceivedReviews.tsx:85 | R | R → workers autori | id, full_name, is_deleted | PUB |
| components/BlindReciprocalReviewDialog.tsx:130 | any | controparte review | full_name, first_name, last_name, is_deleted | PUB |
| components/AdminRequiredReviewsSection.tsx:41 | A | admin lista | id, full_name, business_name, review_blocked | ADMIN (resta su `profiles` via admin surface) |
| routes/jobs.tsx:358 | W | W → restaurants candidature | id, full_name, business_name, city, neighborhood, venue_type, venue_type_other **+ phone_full, email, address, street, street_number, contact_person_first_name/last_name/phone** | PUB + AUTH per contatti/indirizzo esatto (visibili solo dopo application `accepted`) |
| lib/required-reviews.ts:83 | W/R | controparte | business_name, full_name | PUB |
| lib/required-reviews.ts:131 / :228 | W/R | workers | id, full_name, primary_role | PUB |
| lib/announcement-reopen.ts:62 | SYS | annuncio owner | id, is_deleted | KEEP (server function con auth middleware) |
| lib/shift-proposal.ts:116 | W/R | controparte | business_name, full_name | PUB |
| lib/avatars.functions.ts:25 | SYS | batch avatar | id, avatar_url, full_name, business_name | KEEP (server fn, già middleware auth) |

## 3. Letture — dati privati con autorizzazione (AUTH → RPC)

| File:line | Contesto | Colonne sensibili | RPC target |
|---|---|---|---|
| routes/workers_.$id.tsx:89 (phone, email, id_document_path) | R vede worker | contatti + documento | `get_worker_contact_after_hire(worker_id)` — solo se esiste shift confermato R↔W |
| routes/announcements.$id.tsx:234 (phone, email) | W vede restaurant | contatti restaurant | `get_announcement_contact(announcement_id)` (esiste già) |
| routes/announcements.$id.tsx:316 (id_document_path, phone_full, phone) | R vede candidato | documento + telefono | `get_candidate_contact(application_id)` — solo su application `accepted` |
| routes/ristoratore.turni.$shiftId.tsx:227 (id_document_path, phone_full, phone) | R vede worker turno | documento + telefono | come sopra, gated by shift row |
| routes/mappa.tsx:566 (contact_person_*, address) | W vede restaurant | contatti restaurant | riusare `get_announcement_contact` o RPC dedicata |
| routes/jobs.tsx:358 (phone_full, email, address, contact_person_*) | W vede restaurant di candidatura | contatti | RPC gated by application ownership + status |

> Nota: esiste già `get_counterparty_phone(other_user_id)` — usarlo dove pertinente ed estenderlo o affiancarlo con RPC email/documento con la stessa policy.

## 4. Letture — amministrative (ADMIN → mantenere `profiles`, via admin gate)

| File:line | Query | Colonne |
|---|---|---|
| routes/admin.tsx:73 | count(*) | — |
| routes/admin.tsx:82 | dashboard stats | badge, plan, city, primary_role |
| routes/admin.tsx:105 | admin workers list | id, full_name, email, badge, completed_shifts, profile_completed, reputation_level, account_status, moderation_hidden |
| routes/admin.tsx:117 | admin restaurants list | id, full_name, business_name, vat_*, venue_type*, city, province, province_code, price_range, default_*, email, credits, account_status, moderation_hidden |
| routes/admin.tsx:161/182/201 | lookup by id | id, business_name, full_name |
| lib/role-repair.functions.ts:59/167/188 | admin repair (via `supabaseAdmin`) | id, primary_role |
| lib/cleanup-test-profiles.functions.ts:107 | SYS cleanup | id, primary_role |
| lib/populate-test-users.functions.ts:17 | SYS seed | count(*) |
| lib/demo-seed.server.ts:* | SYS seed (`supabaseAdmin`) | seed_batch_id / * |
| lib/backup-restore.functions.ts:435/441 | SYS backup delete | — |
| lib/account-deletion.server.ts:49/165 | SYS delete/anonymize | `PROFILE_SELECT` completo | KEEP (service role) |
| lib/vat.functions.ts:42/59/94 | SYS VAT | id / vat_number / vat_status | KEEP (server fn) |
| lib/phone-verification.functions.ts:* | SYS OTP | phone_*, email, is_deleted, is_demo, whatsapp_*, email_summary_* | KEEP (server fn, middleware auth o admin) |
| utils/payments.functions.ts:53/219 | SYS Stripe | stripe_customer_id, email | KEEP (server fn) |
| routes/api/public/payments/webhook.ts:30 | SYS webhook | stripe_customer_id | KEEP |
| routes/api/public/hooks/expire-stale.ts:162 | SYS cron | id, full_name, first_name, last_name | KEEP |

## 5. Scritture (`update`/`insert`/`delete`)

### Auto‑scritture utente (da restringere via trigger difensivo + RPC allowlisted)

| File:line | Ruolo | Campi scritti | Rischio |
|---|---|---|---|
| routes/onboarding.tsx:1666 | W/R | tutti i campi anagrafici + di default | Update generico: campo per campo va filtrato |
| routes/profile.tsx:305 | W/R | `patch as any` (dinamico) | Rischio scrittura arbitraria — allowlist necessaria |
| routes/profile.tsx:347 | W/R | `avatar_url` | OK (campo pubblico) |
| routes/availability.tsx:645 | W | `available_now_until` | OK |
| routes/ristoratore.annunci.nuovo.tsx:767 | R | default annunci (`update as any`) | Filtrare allowlist |

### Scritture admin (KEEP, ma via gate `has_role`)
| File:line | Ruolo | Campi |
|---|---|---|
| routes/admin.tsx:235 | A | `account_status` |
| routes/admin.tsx:481 | A | `vat_status`, `vat_verified_at` |

### Scritture SYS (server fn / service role — nessun cambiamento)
`vat.functions.ts`, `phone-verification.functions.ts`, `account-deletion.server.ts`, `role-repair.functions.ts`, `demo-seed.server.ts`, `backup-restore.functions.ts`, `payments/webhook.ts`, `utils/payments.functions.ts`.

---

## 6. Classificazione colonne di `profiles`

### 6.1 PUBBLICHE — esporre via `public.public_profiles`

`id`, `full_name`, `first_name`, `last_name`, `business_name`, `avatar_url`,
`primary_role`, `secondary_roles`, `venue_type`, `venue_type_other`,
`professional_profile`,
`city`, `neighborhood`, `province`, `province_code`,
`service_area_city`, `service_area_district`, `service_area_radius_m`,
`selected_zones`, `all_zones`, `work_area_mode`,
`languages`, `spoken_languages`, `experience_years`, `experience_level`,
`is_motorized`, `hourly_rate`, `weekly_availability`, `hourly_availability`,
`price_range`, `employees_count`, `opening_hours`, `busy_days`,
`badge`, `rating_avg`, `reviews_count`,
`reputation_score`, `reputation_level`,
`reliability_pct`, `punctuality_pct`, `completion_pct`,
`completed_shifts`, `no_show_count`,
`avg_punctuality`, `avg_professionalism`, `avg_competence`, `avg_reliability`, `avg_teamwork`,
`rehire_restaurants_count`, `rehire_yes_count`, `rehire_total_answers`,
`distinct_restaurants_count`,
`age`, `available_now_until`, `phone_verified`, `profile_completed`,
`default_arrival_advance_minutes`, `default_arrival_advance_reason`,
`is_deleted`

La vista deve filtrare: `WHERE is_deleted = false AND moderation_hidden = false AND account_status = 'active'`.

> Nota `age`: derivato — se il prodotto preferisce nasconderlo, spostare in privata. Attualmente esposto in molte card.
> Nota `default_*` restaurant: mostrati oggi sulla pagina pubblica del ristorante; ok in PUB.
> Nota `is_deleted`: utile per rendere "Utente eliminato" — mantenere come flag (senza dati).

### 6.2 PRIVATE — esposte solo tramite RPC autorizzata al proprietario o dopo match

`email`, `phone`, `phone_full`, `phone_country_code`, `phone_number`,
`birth_date`, `birth_place`, `nationality`, `tax_code`,
`residence_address`, `residence_city`, `residence_postal_code`, `residence_province`, `residence_street`, `residence_number`,
`address`, `street`, `street_number`, `postal_code`, `country`,
`latitude`, `longitude`, `service_area_lat`, `service_area_lng`,
`access_restrictions`, `additional_directions`, `location_notes`,
`vat_number`, `vat_status`, `vat_company_name`, `vat_verified_at`,
`company_tax_code`, `registered_office_*`, `business_status`,
`pec_email`, `sdi_code`,
`id_document_path`, `id_document_back_path`, `id_document_type`, `id_document_number`,
`id_document_issued_at`, `id_document_expires_at`, `id_document_issuer`,
`contact_person_first_name`, `contact_person_last_name`, `contact_person_role`, `contact_person_role_other`,
`contact_person_phone`, `contact_person_email`,
`default_contact_person_name`, `default_license_requirement`, `default_language_requirements`,
`default_tattoos_allowed`, `default_piercings_allowed`, `default_beard_allowed`,
`default_required_skills`, `default_dress_code_items`, `default_dress_code_notes`,
`short_bio`, `notes`, `terms_accepted`

> Le coordinate GPS del ristorante e l'indirizzo civico esatto vanno esposti in mappa solo con **precisione ridotta** (jitter/round) oppure via RPC dopo accettazione — oggi `mappa.tsx` legge `latitude/longitude/service_area_lat/service_area_lng` direttamente.

### 6.3 AMMINISTRATIVE / INTERNE — mai al client ordinario

`credits`, `plan`, `stripe_customer_id`,
`account_status`, `age_verified`, `age_verified_at`, `representative_age`,
`moderation_hidden`, `moderation_hidden_at`, `moderation_hidden_by`, `moderation_reason`,
`search_penalty_active`, `search_penalty_reason`, `search_penalty_started_at`, `search_penalty_until`,
`delay_count`, `cancellation_count`, `clean_shifts_after_penalty`,
`review_blocked`, `review_blocked_at`, `overdue_reviews_count`, `last_review_reminder_at`, `last_review_at`,
`is_demo`, `seed_batch_id`,
`is_deleted` (flag ok pubblico), `deleted_at`, `deletion_reason`,
`referral_code`, `referred_by_user_id`, `referral_credits_earned`,
`whatsapp_connected`, `whatsapp_confirmation_sent_at`, `whatsapp_confirmation_status`,
`email_summary_sent_at`, `email_summary_status`,
`vat_verified_at` (già in privati per fatturazione), `default_settings_updated_at`,
`last_active_at`, `created_at`, `updated_at`,
`phone_verified_at`.

> `credits`/`plan`/`stripe_customer_id`/`account_status`/`moderation_*`/`search_penalty_*`/`is_demo`/`seed_batch_id`/`deletion_reason`/verifiche → questi sono i campi da BLOCCARE nel trigger difensivo di Fase 5 anche quando la riga aggiornata è la propria.

---

## 7. Regressioni note da chiudere durante il refactor

1. **PII in liste**: `workers_.$id.tsx`, `announcements.$id.tsx` (candidati), `mappa.tsx` (restaurants) leggono `phone/email/id_document_path/contact_person_*` in una `.select()` unica insieme ai campi pubblici — vanno separati in due chiamate (PUB + RPC autorizzata) prima di ristringere la policy globale.
2. **`account_status` in query worker**: `mappa.tsx:560` e `worker-search.functions.ts:238` leggono `account_status` per filtrare — sostituire con filtro nella vista `public_profiles` (`WHERE account_status='active'`) e rimuovere dalla proiezione.
3. **`plan`/`credits` in query restaurant**: `mappa.tsx:566` e `restaurants.$id.tsx:83` leggono `plan` (`restaurants.$id.tsx` anche in vetrina pubblica). Serve strip.
4. **`profile.tsx:305` update dinamico `patch as any`**: rischio di scrittura arbitraria di colonne amministrative — necessaria allowlist client + trigger difensivo server (Fase 5 ibrido).
5. **`admin.tsx:73` `select("*")`**: solo `count` (`head:true`), non legge colonne — OK, ma passare a `select("id", { count: 'exact', head: true })` per pulizia.
6. **`demo-seed.server.ts:568` `select("*")`**: girato tramite `supabaseAdmin`, KEEP.
7. **`worker-search.functions.ts`** legge `email` — è un server fn ma restituisce dati al client: verificare che non ritorni email nella response al ruolo restaurant.

---

## 8. Prossimi passi (bloccati, non applicati)

- **Fase 3**: creare la vista `public.public_profiles` (security_barrier, non updatable, `GRANT SELECT TO authenticated`), filtri `is_deleted=false AND moderation_hidden=false AND account_status='active'`. Nessuna revoca ancora.
- **Fase 3.bis (in parallelo, richiesto dall'utente)**: introdurre subito il **trigger difensivo BEFORE UPDATE su `profiles`** che blocca la scrittura ai campi amministrativi elencati in §6.3 quando `NOT has_role(auth.uid(), 'admin')`. Chiude oggi il rischio di privilege escalation senza aspettare il refactor client.
- **Fase 4**: refactor incrementale per gruppo funzionale (ordine proposto: candidatura → ricerca lavoratori → card lavoratore → mappa → chat → turni → recensioni → dashboard → notifiche → admin).
- **Fase 5**: restringere policy SELECT su `profiles` a `id = auth.uid() OR has_role(...,'admin')`.
- **Fase 6**: RPC `update_own_review_content` + `mark_review_seen` + revoca UPDATE diretto su `reviews`.
- **Fase 7**: vista `public.announcements_public` (esiste già in `restaurants.$id.tsx:91` — verificare copertura colonne e revocare `SELECT` anon sulla tabella base).

Nessuna modifica al DB o al codice applicata in questa fase.
---

## 9. Fase 4 — avanzamento (batch 1 applicato)

Migrate a `public.public_profiles` (solo letture controparte, tutte le colonne già presenti nella vista):
`ristoratore.collaboratori.tsx:95`, `WorkerProfilePreviewDialog.tsx:107`, `dashboard.tsx:168,1039`,
`announcements.tsx:517`, `shifts.tsx:397`, `messages.tsx:188`, `shift-proposal.ts:116`,
`browse.tsx:159,215`, `BlindReciprocalReviewDialog.tsx:130`, `required-reviews.ts:131,228`,
`RestaurantReceivedReviews.tsx:85`, `PreviousCandidatesSection.tsx:59`, `WorkerMyReviews.tsx:90`.

Restano su `profiles` (letture del proprio profilo o admin): `required-reviews.ts:83,295`, `browse.tsx:540`, `AdminRequiredReviewsSection.tsx:41`.

Batch successivi (richiedono estensione vista e/o RPC contatti): `mappa.tsx`, `workers_.$id.tsx`,
`announcements.$id.tsx`, `ristoratore.turni.$shiftId.tsx`, `jobs.tsx`, `restaurants.$id.tsx`,
`messages.$id.tsx`, `workers.tsx` — la vista non espone `latitude/longitude`, `service_area_lat/lng`,
`address`, `default_*`, quindi vanno aggiunte colonne pubbliche o RPC autorizzate prima dello swap.
