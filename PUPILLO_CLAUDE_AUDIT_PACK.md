# Pupillo — Claude Audit Pack

> Documento di sintesi tecnico-funzionale generato per permettere a Claude di analizzare Pupillo dal punto di vista UX/UI, grafica, navigabilità, coerenza dei flussi, mobile experience, conversione e fiducia percepita.
>
> **Regola:** questo pacchetto non modifica alcuna logica di prodotto, database, policy, permessi, pagamenti o notifiche. È solo documentazione.

---

## 1. Sintesi del progetto

**Pupillo** è un marketplace che mette in contatto **lavoratori del settore Ho.Re.Ca.** (camerieri, cuochi, baristi, lavapiatti, runner, ecc.) con **ristoratori / locali** che cercano personale per turni singoli o ricorrenti.

- Il **lavoratore** pubblica la propria disponibilità (settimanale + eccezioni), cerca offerte, si candida, riceve proposte dirette, conferma turni e riceve/lascia recensioni.
- Il **ristoratore** pubblica annunci, cerca lavoratori sulla mappa, invita direttamente, gestisce candidature, conferma turni (scala crediti al momento della conferma) e lascia recensioni.
- La piattaforma protegge la privacy: nome completo del lavoratore, nome del locale, telefono ed email sono **nascosti fino alla conferma di un match**.

Stack tecnico: TanStack Start + React 19, Tailwind v4, Lovable Cloud (Supabase) con RLS, Stripe per i crediti.

---

## 2. Obiettivo dell'audit

Far analizzare a Claude:

- Qualità grafica e coerenza visiva.
- Navigabilità e chiarezza dei flussi.
- Mobile experience.
- Conversione (candidatura, pubblicazione annuncio, acquisto crediti).
- Fiducia percepita (privacy, recensioni, professionalità).
- Criticità UX/UI già rilevabili senza test utente.

---

## 3. Mappa generale dell'app

Route effettivamente presenti in `src/routes/`:

### Pubbliche / auth
- `/` — homepage marketing
- `/come-funziona` — pagina informativa
- `/auth` — login + registrazione (tabbed)
- `/reset-password` — reset password
- `/registration-success` — messaggio post-registrazione
- `/verify-phone` — verifica OTP telefono
- `/terms` — termini e privacy
- `/forbidden` — accesso negato
- `/account-error` — errore account (soft-delete, banned, ecc.)

### Lavoratore
- `/dashboard`, `/profile`, `/onboarding`, `/availability`
- `/browse`, `/mappa`, `/announcements/$id`
- `/jobs` (offerte ricevute/accettate/rifiutate)
- `/shifts` (confermati/completati/annullati/da recensire)
- `/messages`, `/messages/$id`, `/notifications`
- `/reviews/$id`, `/restaurants/$id`, `/ristoratori`

### Ristoratore
- `/dashboard`, `/profile`
- `/announcements`, `/announcements/new`, `/ristoratore/annunci/nuovo`
- `/announcements/$id`, `/ristoratore/turni/$shiftId`
- `/ristoratore/collaboratori`, `/ristoratore/recensioni`
- `/workers`, `/workers/$id`
- `/billing`, `/shifts`, `/messages`, `/notifications`, `/reviews/$id`

### Admin
- `/admin`, `/admin/backend`, `/admin/reset-test-db`

### API pubbliche
- `/api/public/hooks/expire-stale` — cron reminder recensioni + chiusura turni scaduti
- `/api/public/payments/webhook` — webhook Stripe

---

## 4. Flussi principali

### 4.1 Registrazione lavoratore
1. `/auth` → tab **Registrati** → email + password + ruolo *Lavoratore*.
2. Email di conferma → `/registration-success`.
3. Login → `PhoneVerificationGate` → `/verify-phone` (OTP SMS).
4. `/onboarding` — dati anagrafici, foto profilo, ruoli, città, documento identità, disponibilità base.
5. `ProfileGate` sblocca funzioni operative solo al 100% di completamento.
6. Redirect a `/dashboard`.

### 4.2 Registrazione ristoratore
1. `/auth` → **Registrati** → ruolo *Ristoratore*.
2. Verifica telefono.
3. `/onboarding` ristoratore — nome locale, indirizzo, tipo locale, P.IVA opzionale, referente.
4. `RestaurantProfileGate` — funzioni operative solo con profilo completo.
5. `/dashboard` → CTA *"Pubblica il tuo primo annuncio"* → `/announcements/new`.

### 4.3 Candidatura lavoratore
`/browse` → filtra offerte → `/announcements/$id` (nome locale nascosto) → *"Candidati"* → status `pending` → notifica al ristoratore → accettazione = chat sbloccata → conferma finale = crediti scalati al ristoratore, dati sbloccati per entrambi.

### 4.4 Invito diretto ristoratore
`/workers` o `/mappa` → card lavoratore (nome anonimizzato) → `WorkerProfilePreviewDialog` → *"Invita"* → `CounterofferDialog` → notifica al lavoratore in `/jobs` → accetta/rifiuta/controproposta → conferma turno.

### 4.5 Privacy / sblocco dati
- **Prima della conferma:** al ristoratore compare solo *"Lavoratore"* + iniziali + rating; al lavoratore compare *"Nome locale visibile dopo conferma"*, città e distretto approssimati sulla mappa (arrotondamento a 2 decimali ~1.1 km).
- **Dopo conferma:** nome+cognome, telefono, email, nome locale, indirizzo esatto, referente diventano visibili.
- Accesso `worker_availability` solo via RPC sanitizzata (`search_worker_availability_public`) senza `notes` e con coordinate arrotondate.

### 4.6 Recensioni
- Al termine del turno il cron `expire-stale` crea una notifica reminder (dedupe su `user_id + dedupe_key`).
- **Blind reciprocal review:** entrambe le parti vedono la recensione dell'altro solo dopo aver lasciato la propria (o allo scadere della finestra).
- Se il ristoratore non recensisce entro la scadenza, `RequiredReviewsBanner` blocca nuovi contatti.

### 4.7 Notifiche
- Trigger: nuova candidatura, accettazione, conferma turno, cancellazione, nuovo messaggio, reminder recensione, credito basso.
- Consegna: `NotificationBell` in header + realtime + `/notifications`.
- Regola: **una sola notifica per evento** (dedupe key), link calcolato da `notification-link.ts`.

---

## 5. Schermate — Utente non registrato

### 5.1 Homepage `/`
- **Ruolo:** anonimo
- **Obiettivo:** presentare Pupillo, indirizzare Lavoratore vs Ristoratore, portare a `/auth`.
- **Elementi:** hero, dual-CTA (Lavoratore / Ristoratore), value prop, testimonial, footer.
- **Popup:** cookie/consenso, `SiteAccessGate` in staging.
- **Rischi UX:** deve chiarire in <5s il dual-role.

### 5.2 `/come-funziona`
- Funzionamento in 3 step per ciascun ruolo. Rischio sovraccarico testuale.

### 5.3 `/auth`
- Tab Login/Registrati, selettore ruolo, OAuth Google, link *"Password dimenticata?"*.
- Popup: errore credenziali, account eliminato.
- Stati: default, loading, errore, `?deleted=1`, `?redirect=…`.
- **Rischio:** la scelta ruolo deve essere inequivocabile (irreversibile senza admin).

### 5.4 `/reset-password`
- Form email → magic link → nuova password. Stati: invio, successo, token scaduto.

### 5.5 `/verify-phone`
- OTP 6 cifre, reinvio con countdown. Blocco navigazione se non verificato.

### 5.6 `/registration-success`, `/terms`, `/forbidden`, `/account-error`
- Pagine informative e di errore.

---

## 6. Schermate — Lavoratore

### 6.1 `/dashboard`
- Prossimi turni, candidature pendenti, recensioni da lasciare, banner profilo incompleto.
- Componenti: `OnboardingStatusCard`, `ProfileStatusBanner`, `WorkerMyReviews`.
- Popup `GuidedTour` primo accesso.
- **Rischi:** sovraffollamento se banner + tour + card contemporanei.

### 6.2 `/profile`
- Avatar, dati anagrafici, ruoli, città, esperienza, lingue, documento, badge affidabilità.
- Stati: completamento %, verifica documento pending/approved/rejected.

### 6.3 `/onboarding`
- Wizard multistep con progress bar. Nessuna bozza intermedia → rischio perdita dati.

### 6.4 `/availability`
- Griglia settimanale + eccezioni + zone (mappa `WorkerServiceAreaMap`).
- **Rischi:** grid pesante su mobile.

### 6.5 `/browse`
- Filtri (ruolo, città, data, tariffa), card annuncio con locale anonimizzato, badge distanza.
- Popup `AlreadyInContactDialog` se già candidato.
- Stati: empty, loading skeleton, con dati.
- **Rischi:** distinguere annunci già candidati vs nuovi.

### 6.6 `/mappa`
- Marker annunci (worker) / worker (ristoratore) con posizione approssimata.

### 6.7 `/announcements/$id`
- Data, orario, ruolo, tariffa `10 €/ora`, requisiti, mappa approssimata.
- Azioni: *"Candidati"*, *"Salva nei preferiti"*.
- Popup: conferma candidatura, `AlreadyInContactDialog`, annuncio pieno.

### 6.8 `/jobs`
- Tab **Ricevute / Accettate / Rifiutate**.
- Card con tariffa, data `GG/MM/AAAA HH:mm`, locale nascosto o svelato.
- **Nota:** in Rifiutate non compare più "Nome locale visibile dopo conferma" (fix recente).

### 6.9 `/shifts`
- Tab **Prossimi / Completati / Annullati / Da recensire**.
- Componenti: `WorkerContactCard`, `CancelShiftDialog`, `WorkerSelfCancelledDialog`, `BlindReciprocalReviewDialog`.

### 6.10 `/messages` + `/messages/$id`
- Inbox realtime raggruppato per contatto, badge unread.
- Blocco se profilo incompleto o recensione scaduta.

### 6.11 `/notifications`
- Lista notifiche, mark-as-read, deep-link.

### 6.12 Recensioni (`WorkerMyReviews`, `/reviews/$id`)
- Tab **Ricevute / Da lasciare**. Stati blind gestiti.

### 6.13 Impostazioni account (in `/profile`)
- Cambio password/email, eliminazione account (`DeleteAccountDialog`), tema.

---

## 7. Schermate — Ristoratore

### 7.1 `/dashboard`
- Annunci attivi, candidature nuove, turni in arrivo, crediti residui, `RequiredReviewsBanner`, `RestaurantReputationCard`.

### 7.2 `/profile` (locale)
- Nome locale, indirizzo, tipo, P.IVA, referente, foto locale.

### 7.3 `/announcements/new`
- Wizard: data, orario, ruolo, tariffa `10 €/ora`, `positionsRequired`, requisiti, note.
- Popup `InsufficientCreditsDialog` alla conferma turno.

### 7.4 `/announcements`
- Lista annunci con badge stato (aperto/completo/scaduto), contatore candidature.

### 7.5 `/announcements/$id` (ristoratore)
- Candidature per stato, `PreviousCandidatesSection`, Accetta/Rifiuta, chat.
- Popup: `InsufficientCreditsDialog`, `AlreadyInContactDialog`, `RequestReviewRevisionDialog`.

### 7.6 `/workers`
- Ricerca con filtri, `WorkerReputationBadge`.
- `WorkerProfilePreviewDialog` con CTA *"Invita"*.

### 7.7 `/workers/$id`
- Profilo pubblico worker (anonimizzato fino a match).

### 7.8 `/ristoratore/turni/$shiftId`
- `ConfirmedWorkerCard`, `CancelShiftDialog`, `WorkerIncidentDialogs`.

### 7.9 `/ristoratore/collaboratori`
- Storico lavoratori, quick re-invite.

### 7.10 `/ristoratore/recensioni`
- Ricevute + da lasciare, `RestaurantReceivedReviews`.

### 7.11 `/billing`
- Piani, crediti, storico, `StripeEmbeddedCheckout`, `PaymentTestModeBanner`.

---

## 8. Popup, modali e componenti comuni

| Componente | Scopo |
|---|---|
| `GuidedTour` | Tour guidato primo login per ruolo |
| `InsufficientCreditsDialog` | "Crediti insufficienti" → Attiva Basic / Vedi piani |
| `CancelShiftDialog` | Conferma annullamento turno |
| `WorkerSelfCancelledDialog` | Avviso auto-annullamento |
| `WorkerIncidentDialogs` | Segnalazione no-show / problema |
| `BlindReciprocalReviewDialog` | Recensione reciproca cieca |
| `RequestReviewRevisionDialog` | Richiesta revisione recensione |
| `AlreadyInContactDialog` | Blocca doppia candidatura/invito |
| `BlockedContactDialog` | Contatto bloccato per recensioni scadute |
| `CounterofferDialog` | Controproposta tariffa/data |
| `DeleteAccountDialog` | Eliminazione account |
| `WorkerProfilePreviewDialog` | Profilo worker in modale (no navigazione) |
| `SaveToFavoritesPrompt` | Salva annuncio |
| `RequiredReviewsBanner` | Recensioni obbligatorie |
| `ProfileStatusBanner` / `OnboardingStatusCard` | Profilo incompleto |
| `NotificationBell` | Badge notifiche + dropdown |
| `StalePreviewOverlay` | Overlay build vecchia |
| `PaymentTestModeBanner` | Stripe test mode |
| `WorkerContactCard` / `WorkerReputationBadge` / `WorkerRatingSummary` | Card lavoratore |
| `ConfirmedWorkerCard` | Card turno confermato |
| `RestaurantReputationCard` / `RestaurantRequirements` | Card ristoratore |
| `AppShell` | Layout con header, bottom nav mobile, menu desktop |

Toast: `sonner`. Bottoni/Badge: shadcn variants.

---

## 9. Stati vuoti, errori, loading

- **Loading:** skeleton nelle liste, *Caricamento…* in `RequireAuth`/`RequireRole`.
- **Empty:** illustrazioni + CTA nelle dashboard/tab (uniformità da verificare).
- **Errore:** `errorComponent` TanStack + toast; `/account-error` per errori auth.
- **404:** `notFoundComponent` root.
- **Non autorizzato:** `/forbidden`.
- **Privacy bloccata/sbloccata:** vedi §10.
- **Prima/dopo conferma:** card mostrano placeholder o dati completi.
- **Recensione:** *da lasciare / lasciata / ricevuta in blind*.

---

## 10. Privacy e sblocco dati

| Dato | Prima conferma | Dopo conferma |
|---|---|---|
| Nome lavoratore | "Lavoratore" + iniziali | Nome + cognome |
| Telefono lavoratore | Nascosto | Visibile in `WorkerContactCard` |
| Email lavoratore | Nascosta | Visibile |
| Foto lavoratore | Visibile (opzionale) | Visibile |
| Nome locale | "Visibile dopo conferma" | Nome completo |
| Indirizzo esatto | Area approssimata (~1.1 km) | Indirizzo completo |
| Referente locale | Nascosto | Nome + telefono |
| Chat | Solo dopo accettazione | Attiva |

`worker_availability` accessibile solo via RPC sanitizzata (esclude `notes`, arrotonda coordinate).

**Punti critici:** coerenza placeholder tra card/chat/mappa; garantire che un rifiuto non sblocchi mai dati.

---

## 11. Notifiche e messaggi

| Evento | Destinazione |
|---|---|
| Nuova candidatura | `/announcements/$id` |
| Candidatura accettata | `/messages/$id` (una sola notifica) |
| Turno confermato | `/shifts` |
| Reminder recensione | `/shifts?tab=to-review` |
| Nuovo messaggio | `/messages/$id` |
| Crediti bassi | `/billing` |

Dedupe: unique constraint su `notifications(user_id, dedupe_key)`.

---

## 12. Incoerenze / criticità già rilevabili

1. **Densità dashboard lavoratore** — banner + tour + card multiple sovraccaricano il primo accesso mobile.
2. **Alias route ristoratore** — coesistono `/announcements/new` e `/ristoratore/annunci/nuovo`; verificare breadcrumb.
3. **Empty states non uniformi** — alcuni tab hanno illustrazione+CTA, altri solo testo grigio.
4. **Formato date/valuta** — uniformato a `GG/MM/AAAA HH:mm` e `10 €` postfisso; da verificare ovunque.
5. **Naming misto IT/EN nelle route** (`/workers`, `/ristoratore/collaboratori`, `/browse`, `/mappa`) — incoerente in URL condivisi.
6. **Wizard nuovo annuncio** — verificare progress e back senza perdere dati.
7. **Popup crediti insufficienti** — CTA "Attiva Basic" deve essere visibile senza scroll su mobile.
8. **Chat** — manca *sta scrivendo* / *letto* (opzionale).
9. **Onboarding** — nessuna bozza intermedia; uscita = perdita stato.
10. **Mobile bottom nav** — verificare contrasto tab attivo in `AppShell`.
11. **Notifiche** — dedupe attivo; monitorare cron `expire-stale`.
12. **Documento identità** — flusso poco esplicito rispetto al blocco funzionale.
13. **`WorkerProfilePreviewDialog`** — su mobile può risultare troppo alta.
14. **Toast sonner** — evitare "qualcosa è andato storto" generico per errori RLS.
15. **Fiducia** — mancano loghi/testimonial su `/` e sui punti di conversione.

---

## 13. Checklist per Claude

- [ ] Il prodotto è graficamente professionale?
- [ ] L'esperienza mobile è chiara?
- [ ] Il lavoratore capisce subito cosa fare?
- [ ] Il ristoratore capisce subito come trovare personale?
- [ ] Il flusso di candidatura è semplice?
- [ ] Il flusso di invito diretto è semplice?
- [ ] La dashboard è utile o solo un contenitore?
- [ ] I bottoni principali sono evidenti?
- [ ] Le schermate trasmettono fiducia?
- [ ] Ci sono passaggi troppo lunghi?
- [ ] Ci sono testi da riscrivere?
- [ ] Ci sono elementi amatoriali?
- [ ] Ci sono incongruenze visive?
- [ ] Ci sono problemi di navigazione?
- [ ] Ci sono funzionalità premature?
- [ ] Quali schermate vanno rifatte prima del lancio?
- [ ] Quali sono già accettabili?
- [ ] Quali modifiche hanno priorità alta?

---

## 14. Allegati / screenshot

La pagina interna **`/design-audit`** (accessibile agli admin autenticati) presenta in modo ordinato:

- griglia iframe di tutte le schermate pubbliche;
- elenco componenti/popup con anteprima statica;
- link diretto a ciascuna route per screenshot manuali.

> Per screenshot completi: eseguire Playwright sulle route del §3 con viewport 390×844 (mobile) e 1280×800 (desktop).

---

_Fine documento._
