# Audit Pupillo vs Flow Chart (Pupillo 2026-05-25)

> Documento di sola analisi. **Nessuna modifica** a codice, DB, routing, RLS, componenti o logiche è stata apportata.
> Fonte: flow chart Whimsical `pupillo-2026-05-25-2am2Nxh6CEzcqGXeG5FnYi` + codice attuale del repo (`src/routes`, `src/lib`, `src/components`, `supabase/migrations`, `docs/FEATURES_MAP.md`, `docs/USER_FLOWS.md`).

---

## 1. Sintesi generale

Pupillo è **parzialmente allineato** al flow chart.

- ✅ Tutta la spina dorsale prevista esiste: pubblico/landing → auth (email/Google + reset) → onboarding lavoratore / ristoratore → home role-based → annunci → candidature/proposte → chat → conferma turno → recensioni → reputazione/badge → notifiche → admin/back office.
- ⚠️ Alcuni rami del flow chart sono **implementati solo in parte**: redirect geografico per Paese (`pupillo.com/xx`), gate sui T&C aggiornati post-login, conferma WhatsApp del ristoratore come step obbligatorio, social login (Apple/X), timer di scadenza visibile lato UI, "offerta vincolata" con scelta esplicita di tariffa fissa vs. controfferta aperta a tutti.
- ❌ Alcune logiche secondarie sono **assenti**: scelta esplicita Paese all'ingresso, verifica P.IVA automatica con esito "back office controlla", flag "il lavoratore si dichiara verde sul luogo del servizio" sulla mappa pubblica, lettura forzata nuove condizioni d'utilizzo dopo aggiornamento.
- 🟢 Sono presenti alcune funzioni extra non visibili nel flow chart (referral, sistema crediti/abbonamenti Stripe, incidenti lavoratore, backup admin, ticket di supporto) che restano coerenti col prodotto e vanno solo documentate.

---

## 2. Flussi corretti

| Flow chart | Stato progetto | File / componenti | Note |
|---|---|---|---|
| Profilo anonimo → landing pubblica | ✅ corretto | `src/routes/index.tsx`, `come-funziona.tsx`, `mappa.tsx` | Landing pubblica con accesso a mappa & onboarding. |
| Lettura T&C + privacy in registrazione | ✅ corretto | `src/routes/auth.tsx`, `terms.tsx`, flag `profiles.terms_accepted` | Accettazione richiesta in signup. |
| Login / Registrazione (email + Google) + reset password | ✅ corretto | `src/routes/auth.tsx`, `reset-password.tsx`, `auth-context.tsx`, `supabase/configure_social_auth google` | Manca Apple/X (vedi §3). |
| OTP telefono prima delle azioni operative | ✅ corretto | `verify-phone.tsx`, `PhoneVerificationGate.tsx`, `phone-verification.functions.ts` | Gate prima di candidature/annunci. |
| Profilo lavoratore — Home "incompleto" vs "completo" | ✅ corretto | `jobs.tsx`, `profile.tsx`, `ProfileGate.tsx`, `OnboardingStatusCard.tsx`, `worker-profile.functions.ts` | Banner + blocchi operativi. |
| Profilo ristoratore — Home "incompleto" vs "completo" | ✅ corretto | `dashboard.tsx`, `RestaurantProfileGate.tsx`, `RestaurantRequirements.tsx`, `restaurant-onboarding-navigation.ts` | |
| Mappa pubblica con ristoratori e lavoratori | ✅ corretto | `mappa.tsx`, `WorkersMap*.tsx`, `AnnouncementMap*.tsx`, `WorkerServiceAreaMap*.tsx` | |
| Visualizzazione lavoratori MAPPA / ELENCO | ✅ corretto | `workers.tsx`, `WorkersMap.tsx`, `workers_.$id.tsx` | Toggle mappa/elenco presente. |
| Soft-match disponibilità (non filtro) | ✅ corretto | `worker-search.functions.ts`, `availability.ts`, `worker-availability-summary.ts`, `browse.tsx` | Ordina/segnala, non esclude. |
| Creazione offerta (data, durata, tariffa oraria/a servizio, luogo dal profilo o nuovo) | ✅ corretto | `ristoratore.annunci.nuovo.tsx`, `announcements.new.tsx`, `announcement-time.ts`, `pricing.ts`, `HourlyRateInput.tsx` | |
| Candidatura lavoratore + proposta ristoratore (chat bidirezionale) | ✅ corretto | `applications` + `messages` + `proposal_responses`, `messages.tsx`, `messages.$id.tsx`, `shift-proposal.ts`, `proposal-assign.functions.ts` | |
| Chat tra le parti con privacy masking | ✅ corretto | `messages.$id.tsx`, `candidate-display.ts`, `worker-display.ts`, `public-location.ts`, `format-location.ts` | Nome/indirizzo sbloccati solo dopo conferma. |
| Notifiche persistenti + bell | ✅ corretto | `notifications.tsx`, `NotificationBell.tsx`, `notification-link.ts`, tabella `notifications` | Link deep verso entità. |
| Conferma turno → scalo 7 crediti atomico | ✅ corretto | `shift-confirmation.ts`, `credits.ts`, `InsufficientCreditsDialog.tsx`, tabella `shifts` | Regola 6 rispettata. |
| Recensione reciproca obbligatoria | ✅ corretto | `reviews.$id.tsx`, `WorkerMyReviews.tsx`, `RequiredReviewsBanner.tsx`, `AdminRequiredReviewsSection.tsx`, tabelle `reviews` / `required_reviews` | |
| Badge / reputazione lavoratore | ✅ corretto | `WorkerReputationBadge.tsx`, `WorkerReputationCard.tsx`, `WorkerRatingSummary.tsx`, `reputation.ts`, `profiles.reputation_*` | |
| Annullo turno / no-show con guardia +15 min | ✅ corretto | `announcement-cancel.ts`, `WorkerIncidentDialogs.tsx`, `worker-incidents.ts`, `ristoratore.turni.$shiftId.tsx`, `routes/api/public/hooks/expire-stale.ts` | |
| Cambio password / disabilitazione profilo / conferma cancellazione | ✅ corretto | `profile.tsx`, `DeleteAccountDialog.tsx`, `account-deletion.functions.ts`, `RequireAuth.tsx` (logout immediato se anonimizzato) | |
| Back office / admin | ✅ corretto | `admin.tsx`, `admin.backend.tsx`, `AdminBackupsSection`, `AdminSupportTicketsSection`, `AdminRoleRepairSection`, `role-repair.functions.ts` | |

---

## 3. Flussi mancanti (previsti dal flow chart, NON presenti)

| Funzione prevista | Stato attuale | Impatto | Dove andrebbe |
|---|---|---|---|
| **Scelta Paese all'ingresso** (`pupillo.com/xx`) — diamante "L'utente desidera essere reindirizzato al servizio del paese?" | Non presente. App mono-Paese (Italia). | Medio: il flow chart prevede architettura multi-country; oggi non c'è né selettore né segmentazione dati per Paese. | `src/routes/index.tsx` + un nuovo `country-context` + colonna `country` su `profiles`/`announcements` (già esiste `country` come testo libero, default `Italia`). |
| **Gate "nuove condizioni d'utilizzo da accettare"** post-login | Non presente. T&C accettati solo a signup, non c'è ri-prompt su versioning. | Medio (compliance): aggiornamenti privacy/T&C non vengono ribattuti agli utenti già registrati. | `auth-context.tsx` + nuova tabella `terms_versions` + colonna `profiles.terms_version_accepted`. |
| **Conferma WhatsApp del ristoratore come step obbligatorio** (diamante "Verifica WhatsApp riuscita?") | Schema c'è (`profiles.whatsapp_connected`, `whatsapp_confirmation_*`) ma il **gate operativo** non è enforced; oggi è gated solo OTP telefono. | Medio: il flow chart richiede WhatsApp riuscito prima di pubblicare/operare. | `RestaurantProfileGate.tsx`, `restaurant-onboarding-navigation.ts`. |
| **Verifica P.IVA automatica con stato "back office controlla / azienda non risponde"** | Solo campi `vat_number`, `vat_status`, `vat_company_name`, `vat_verified_at` + `lib/vat.functions.ts`, ma manca lo step UI "in verifica" col rimando al back office come da diagramma. | Medio: oggi il flusso accetta P.IVA senza pendenza chiara. | `ristoratore` onboarding + admin queue. |
| **Social login Apple e X (Twitter)** — il flow chart elenca Apple/Google/X | Solo Google + email. | Basso: feature di acquisizione. | `supabase--configure_social_auth` + `auth.tsx`. |
| **Distinzione visiva mappa: lavoratori VERDI (si dichiarano disponibili sul luogo del servizio) vs GRIGI (tutti gli altri, max 100)** | `WorkersMap` mostra i lavoratori ma **non differenzia per "si dichiara sul luogo"**. Limite "100 sulla mappa" non confermato. | Basso/Medio (UX rilevante per il ristoratore). | `WorkersMapInner.tsx`, `worker-search.functions.ts`. |
| **Offerta "vincolata" vs "aperta a controproposta a tutti"** — diamante "Voglio offrire il lavoro a tutti correndo alle condizioni stabilite?" | Esistono proposte e controproposte (`CounterofferDialog`, `proposal_responses`) ma non c'è una **flag esplicita "binding offer / open to all"** nel form di pubblicazione (anche se la colonna `applications.binding_offer` esiste e non è esposta). | Medio: business rule del diagramma non esposta. | `ristoratore.annunci.nuovo.tsx`, `application-card.ts`. |
| **Timer di scadenza dell'iscrizione / risposta lavoratore visibile in UI** (trapezi rossi: "Timer di risposta del lavoratore", "Timer di scadenza inscrizione", "Timer di scadenza dell'offerta") | Backend OK (`applications.response_deadline`, hook `expire-stale`) ma in UI **non viene mostrato un countdown** uniforme alle parti. | Medio (UX): l'utente non vede chiaramente i tempi residui. | `application-card.ts`, `messages.$id.tsx`, badge nei thread. |
| **Bottone esplicito "Annulla scelta" del metodo di pagamento** dentro lo step pagamento | Pagamento è solo a livello abbonamento (`billing.tsx`, Stripe), non è uno step inline dell'annuncio come da flow chart. Coerente col modello "crediti" attuale ma divergente dal diagramma. | Basso: divergenza di modello (vedi §4). | — |

---

## 4. Flussi diversi (esistono ma divergono)

| Come dovrebbe (flow chart) | Come funziona oggi | Differenza | Rischio |
|---|---|---|---|
| Pagamento del turno scelto al momento (metodo di pagamento + conferma OK/KO) | Modello **crediti prepagati + abbonamenti Stripe**: 7 crediti scalati alla conferma turno; nessun checkout per singolo turno. | Modello economico differente, già concordato e produttivo. | Basso: il flow chart è obsoleto su questo punto, non Pupillo. **Conferma utente prima di toccare nulla.** |
| Diagramma mostra `Login → Registrazione → Reset password → Supporto clienti` come 4 azioni parallele | In `auth.tsx` Login/Registrazione/Reset sono nella stessa pagina; "Supporto clienti" è un FAB AI globale (`AssistantFab.tsx`, `ReportProblemDialog`). | Layout/UX diverso ma funzionalità coperta. | Nessuno. |
| "Visualizzazione su mappa di tutti i ristoratori e lavoratori" prima del login | `/mappa` esiste e mostra annunci + worker service areas, ma alcuni dati richiedono login (es. profilo lavoratore completo). | Quasi allineato; differenza più di privacy che di flusso. | Basso. |
| Profilo lavoratore "incompleto" mostra subset funzioni esplicito (vedi riquadro grande nel diagramma) | Coperto da `ProfileGate` con blocchi mirati su singole azioni, non da una "home incompleta" dedicata. | Granularità diversa ma esito equivalente. | Basso. |
| "L'indirizzo è già in anagrafica? → Registrazione al back office" per ristoratore | Oggi indirizzo viene geocodificato (`geocode.ts`) e salvato; non c'è step "già esiste → assegnato al back office" come prevenzione duplicati. | Manca dedup di ristoratori sullo stesso indirizzo. | Medio (qualità dati). |
| Notifica al lavoratore: "Notifica in piattaforma" + "Notifica via WhatsApp" | In-app + email summary presenti, **WhatsApp outbound non integrato** (esistono solo i campi di stato `whatsapp_confirmation_*` ed `email_summary_*`). | Canale WhatsApp non attivo. | Medio (engagement). |

---

## 5. Flussi incompleti o rotti

| Area | Problema | Causa probabile | File coinvolti | Priorità |
|---|---|---|---|---|
| Duplicazione modello annuncio | Coesistono `announcements` e `job_requests` con campi sovrapposti (vedi `docs/REFACTOR_NOTES.md`). Rischio drift dati. | Iterazione storica non consolidata. | `announcements.tsx`, `ristoratore.annunci.nuovo.tsx`, schema DB. | Alta (debt, non blocking). |
| Conferma WhatsApp ristoratore | Colonne presenti ma nessun trigger reale che invii/verifichi il messaggio. | Provider WhatsApp non collegato. | `profiles.whatsapp_*`, manca server fn. | Media. |
| Verifica P.IVA | `vat.functions.ts` esegue lookup ma manca UI di stato "in attesa back office" e ricaduta sul gate ristoratore. | Step non collegato all'onboarding visivo. | `vat.functions.ts`, onboarding ristoratore. | Media. |
| Timer visibile in UI per scadenze candidatura/offerta | Dati presenti (`response_deadline`, `expires_at`), ma niente countdown nei thread/annunci. | Solo backend cleanup (`expire-stale.ts`). | `application-card.ts`, `messages.$id.tsx`, `announcements.$id.tsx`. | Media. |
| Naming routes IT/EN misto | `ristoratore.*` vs `workers.tsx` / `jobs.tsx` / `shifts.tsx`. | Storica. Già flaggato in `REFACTOR_NOTES.md`. | `src/routes/*`. | Bassa. |
| Demo/seed data attivi anche in prod-like? | Esistono `demo-seed.functions.ts`, `populate-test-users.functions.ts`, `cleanup-test-profiles.functions.ts`, `admin.reset-test-db.tsx`. Da verificare che siano gated `is_admin`. | Tooling sviluppo. | `demo-seed-guard.server.ts`. | Media (sicurezza). |
| Differenza Verde/Grigio sui marker mappa lavoratori | Non implementato il colore in base alla disponibilità dichiarata. | UI map non legge `worker-availability-summary` per il colore. | `WorkersMapInner.tsx`. | Bassa. |

---

## 6. Funzioni extra non previste dal flow chart

| Funzione | Dove si trova | Azione consigliata | Motivazione |
|---|---|---|---|
| Sistema crediti + abbonamenti Stripe | `billing.tsx`, `pricing.ts`, `credits.ts`, `subscriptions`, `credit_transactions`, `payments/webhook.ts` | **Tenere** (sostituisce il "pagamento per turno" del diagramma) | Cuore del modello di monetizzazione. |
| Programma referral | `ReferralCard.tsx`, tabella `referral_invites`, colonne `profiles.referral_*` | **Tenere** | Acquisition. Aggiungere nodo nel flow chart. |
| Sistema incidenti lavoratore (ritardi, no-show, late cancel) | `WorkerIncidentDialogs.tsx`, `worker-incidents.ts`, `profiles.delay_count/cancellation_count/clean_shifts_after_penalty/search_penalty_*` | **Tenere** | Qualità marketplace. |
| Penalty di ricerca temporanea | `profiles.search_penalty_*`, integrato in `worker-search.functions.ts` | **Tenere** | Conseguenze automatiche degli incidenti. |
| Ticket di supporto + revisione recensioni | `AdminSupportTicketsSection`, `RequestReviewRevisionDialog`, `review_revision_requests`, `support_tickets` | **Tenere** | Operatività admin. |
| Backup / restore admin | `AdminBackupsSection`, `AdminBackupRestoreSection`, `backup-system.functions.ts`, `backup-logs` | **Tenere** | Governance. |
| Assistente AI in-app | `assistant/AssistantFab.tsx`, `AssistantPanel.tsx`, `assistant.functions.ts`, `assistant-kb.ts` | **Tenere** | Sostituisce in parte "Supporto clienti" del diagramma. |
| Aree di disponibilità extra del lavoratore (zone multiple) | `availability.tsx`, `WorkerServiceAreaMap.tsx`, `availability.ts`, `selected_zones`, `all_zones` | **Tenere** | Più flessibile del flow chart, ma rispetta la regola soft-match. |
| Codici sconto | `discount_codes`, `discount_redemptions` | **Tenere** (gestione admin) | Acquisizione/promo. |
| Verifica documento d'identità | `IdDocumentDropzone.tsx`, `id-document-upload.functions.ts`, colonne `id_document_*` su `profiles` | **Tenere** | Compliance KYC, non nel diagramma. |
| Banner SiteAccess / DevLoopMonitor / StalePreviewOverlay | `SiteAccessGate.tsx`, `dev-loop-monitor.tsx`, `StalePreviewOverlay.tsx` | **Tenere** (dev/preview) | Solo strumenti interni. |

---

## 7. Piano consigliato di correzione (in ordine logico, NON applicato)

1. **Decidere il modello target** — confermare che il pagamento per turno del flow chart è superato dal modello crediti/abbonamenti (oppure recuperare il pay-per-shift). Senza questa decisione non ha senso riallineare il resto.
2. **Allineare il flow chart sulle funzioni extra** (referral, crediti, incidenti, penalty, KYC, assistant, ticket): meglio aggiornare il diagramma che togliere funzioni produttive.
3. **Compliance T&C versioning** — introdurre `terms_versions` + re-prompt post-login (rischio legale basso ma reale).
4. **WhatsApp ristoratore** — integrare provider e attivare il gate "Verifica WhatsApp riuscita" come da diagramma; sostituire i campi `whatsapp_confirmation_*` con uno stato reale.
5. **Verifica P.IVA con stato "in revisione back office"** — UI pendenza + queue admin.
6. **Timer visibili in UI** — countdown su candidature, offerte e iscrizioni; sfrutta `response_deadline` / `expires_at` già presenti.
7. **Flag "offerta vincolata vs aperta a controproposta"** nel form annuncio — esporre `applications.binding_offer` o equivalente sull'annuncio.
8. **Mappa lavoratori: marker verde vs grigio** + limite 100 esplicito come da flow chart.
9. **Geo redirect per Paese** (opzionale; solo se si conferma il piano multi-country del diagramma).
10. **Refactor annunci** — consolidare `announcements` ↔ `job_requests` (vedi `docs/REFACTOR_NOTES.md`); abilita molte semplificazioni a valle.
11. **Naming routes IT/EN** — uniformare progressivamente, con redirect per non rompere bookmark.
12. **Hardening demo-seed** — verificare che tutte le funzioni di seed/reset siano gated `is_admin` + `is_demo` server-side (controllo manuale di sicurezza).

---

## Note metodologiche

- Il flow chart contiene ~140 nodi: alcuni testi sono illeggibili anche a zoom max della PDF; l'audit si basa sui nodi e sui rami leggibili e sulla struttura macro. Per i punti dubbi (es. esatta semantica di alcuni diamanti del centro-pagina), è consigliabile aprire il file Whimsical originale (link in calce alla PDF) prima di pianificare cambi profondi.
- Tutte le valutazioni sopra sono **statiche** (analisi codice/docs); non sono state eseguite navigazioni in preview né query DB per questo audit.

---

**Ho completato il confronto tra Pupillo e il flow chart. Non ho modificato nulla. Qui sopra trovi il report delle differenze e il piano consigliato di correzione.**
