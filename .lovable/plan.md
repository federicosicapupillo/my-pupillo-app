## Analisi dell'implementazione attuale

**Route usata dalla chat**
- `/messages` (`src/routes/messages.tsx`, 946 righe) — lista conversazioni/inbox realtime.
- `/messages/$id` (`src/routes/messages.$id.tsx`, **4.593 righe**) — il thread vero e proprio. È qui che vive tutto.

**Componenti che visualizzano i messaggi**
Non esistono componenti chat separati: tutto è inline in `messages.$id.tsx` (bolle, avatar `UserAvatar`, composer `Textarea` + pulsante Invia, template picker). Componenti collegati (business, non chat): `ProposalCard`, `ConfirmationCard`, `ConfirmedWorkerCard`, `CounterofferDialog`, `ReviewDialog`/`ReviewBlock`, `BlindReciprocalReviewDialog`, `SaveToFavoritesPrompt`, `InsufficientCreditsDialog`, `BlockedContactDialog`, `WorkerIncidentDialogs`, `PayOnHireBox`, `FreeLaunchBanner`.

**Dati letti**
`applications` (riga completa), `announcements` (orari, tariffa, requisiti, dress code, indicazioni), `public_profiles` (controparte + reputazione), `messages`, `activity_logs` (timeline), `shifts`, `reviews`, `proposal_responses`, `notifications`, RPC `get_announcement_contact` (referente sbloccato), `canAssignShift`, feature flag pagamenti/controfferta.

**Azioni che oggi dipendono dalla chat**
Accetta/rifiuta proposta, candidatura, controfferta, conferma assegnazione (con consumo crediti), invio istruzioni operative (template `shift_confirmation`), conferma lettura istruzioni (`action_type=instructions_acknowledged`), completamento turno, annullamento, segnalazioni ritardo/no-show, recensioni cieche reciproche, chiusura chat. Tutte scrivono una riga in `messages` come "evento".

**La chat è usata per messaggi liberi?**
**No.** In produzione: 136 messaggi totali, **0 messaggi liberi** (`template_id IS NULL` e `message_type='user'`). Sono tutti template/system: `shift_proposal` (26), `shift_confirmation` (24), system (29), `review_submitted` (14), chiusure chat (15), ecc. Quindi la card "Comunicazioni registrate" oggi sarebbe sempre vuota, ma la implemento comunque come previsto.

**Rischi della sostituzione**
1. `messages` non è solo UI: è il **log di stato**. Molte logiche (gate anti-duplicato proposta, "istruzioni già inviate", "lettura confermata", chiusura chat, trigger DB `notify_new_message`) leggono/scrivono lì. Le insert devono restare identiche, cambia solo la resa grafica.
2. Il trigger DB `notify_new_message` genera le notifiche a partire da `template_id`: se smetto di inserire quelle righe, si perdono le notifiche.
3. Il badge "messaggi non letti" in `AppShell` e l'inbox realtime dipendono da `read_at` / `last_message_preview`.
4. Rischio regressione su privacy: nome locale/indirizzo/referente vanno mostrati solo dopo lo sblocco esistente (`get_announcement_contact` + stato accettato/confermato).
5. ~20 punti di navigazione puntano a `/messages/$id`: vanno tutti rediretti.

Nessuna modifica a DB, RLS, trigger o matching.

## Piano di implementazione

### Fase 1 — Nuova pagina di riepilogo
- Nuova route `src/routes/pratiche.$id.tsx` ("Dettagli proposta" / "Riepilogo candidatura" / "Dettagli turno" in base allo stato), che **riusa lo stesso data-loader** di `messages.$id.tsx` estratto in `src/lib/application-detail.ts` (query, derivazione stato, sblocco privacy, timeline da `activity_logs` + `messages`).
- Layout desktop 2 colonne (`max-w-6xl`), mobile impilato:
  - principale: Header con badge stato → Card 1 Riepilogo turno → Card 2 Locale e luogo → Card 3 Requisiti e mansioni → Card 4 Proposta e risposta → Card 5 Istruzioni operative (con stato lettura e data/ora) → Card 6 Comunicazioni registrate (solo se esistono).
  - laterale: riepilogo economico, CTA per stato+ruolo, referente (se sbloccato), mappa/"Apri in mappa", cronologia sintetica (Card 7 timeline verticale dai dati reali).
- Stati vuoti/errore in italiano: caricamento, errore, non trovata, non autorizzato, istruzioni non inviate, dati bloccati, nessuna comunicazione, turno annullato, proposta scaduta.

### Fase 2 — Azioni senza chat
- Le CTA riusano le funzioni esistenti (accetta/rifiuta/assegna/annulla/recensisci/segnala), spostate in `src/lib/application-actions.ts` senza cambiarne il comportamento (stesse insert su `messages`, stessi `template_id`, stessi update su `applications`).
- Invio istruzioni operative: **modulo strutturato** in dialog (referente, telefono, punto di accesso, orario arrivo, dress code, parcheggio, indicazioni, note) che produce lo stesso messaggio `shift_confirmation` di oggi → appare nella Card 5.
- Conferma lettura worker: pulsante "Ho letto le istruzioni" → stessa insert `action_type=instructions_acknowledged` (data/ora mostrata in Card 5).
- Rimosso: composer, pulsante Invia, template picker libero, bolle, avatar messaggio.

### Fase 3 — Navigazione
- `/messages/$id` diventa un redirect verso la nuova route (nessun deep-link rotto); aggiorno i ~20 link interni (dashboard, jobs, shifts, announcements, workers, mappa, collaboratori, turni ristoratore, `notification-link.ts`, `NotificationBell`, dialog vari).
- `/messages` (inbox) resta come elenco pratiche, ma le righe aprono la nuova pagina; rinomino la voce di menu in "Candidature/Turni" se confermi.

### Fase 4 — Verifica
Test 1-15 richiesti via Playwright con account worker e ristoratore autenticati, screenshot desktop e mobile.

### Dettagli tecnici
- Nessuna migration. Nessuna modifica a RLS, trigger, RPC, matching.
- Nessuna cancellazione di dati o tabelle: `messages` continua a essere scritta come log eventi.
- `messages.$id.tsx` resta nel repo solo come redirect; il codice riusabile viene estratto, non duplicato.

### Domande aperte
1. La voce di menu "Messaggi" va rinominata (es. "Candidature") o resta?
2. Il nome della nuova route: `/pratiche/$id` va bene o preferisci `/candidature/$id`?
