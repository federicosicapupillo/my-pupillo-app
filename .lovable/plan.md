
# Audit e correzione flusso RISTORATORE

Questa è un'attività ampia: tocca DB, routing, UI e logiche di stato. Voglio condividere il piano prima di iniziare per concordare le priorità (ed evitare di rifare a vuoto parti che vuoi tenere come sono).

## 1. Fase di analisi (lettura, niente modifiche)

- Mappare tutte le route attuali sotto `src/routes/` lato ristoratore: dashboard, onboarding, profilo locale, creazione annuncio, lista annunci, dettaglio annuncio, candidature, messaggi, turni, recensioni, crediti, billing, notifiche.
- Confrontare ogni nodo del diagramma con le schermate reali e produrre una matrice "nodo diagramma → route/componente → stato (OK / parziale / mancante)".
- Rileggere tabelle (`announcements`, `applications`, `shifts`, `reviews`, `notifications`, `profiles`, `credit_transactions`, `subscriptions`, `activity_logs`) e confrontarle con gli stati richiesti.

## 2. Aree che mi aspetto di toccare nel DB

Sulla base dello schema attuale e del diagramma:

- **`announcements.status`**: oggi ha `active`. Il diagramma chiede stati: bozza, pubblicata, in attesa candidati, candidature ricevute, lavoratore selezionato, confermata, completata, annullata. Aggiungerei almeno `draft`, `assigned`, `completed`, `cancelled` (gli intermedi "in attesa / candidature ricevute" sono derivabili dal conteggio `applications`, evito stati ridondanti).
- **`applications`**: aggiungere campo `seen_at` (stato "vista") + trigger che aggiorna `announcements.status` quando viene accettata una candidatura (→ `assigned`) o quando il turno è completato (→ `completed`).
- **`shifts`**: aggiungere transizione `in_progress` quando `now() >= shift_date+ora` e stato non finale (calcolo lato client va bene, oppure colonna derivata).
- **Verifica notifiche**: i trigger esistono già (`notify_application_insert`, `notify_application_status`, `notify_shift_status`). Controllo che coprano i passaggi chiave del diagramma; se manca "annullamento richiesta" o "richiesta scaduta", aggiungo trigger.
- **`activity_logs`**: aggiungo log per pubblicazione/annullamento richiesta e per recensione.

Niente tabelle nuove (`matches` esiste già concettualmente come `applications` accettata + `shifts`, evito di duplicare).

## 3. Aree UI da sistemare lato ristoratore

In ordine di priorità, dopo l'audit:

1. **Onboarding ristoratore** — verificare che dopo signup venga forzata la compilazione di: business_name, vat_number, venue_type, address, price_range, opening_hours. Redirect a `/onboarding` se `profile_completed=false`.
2. **Dashboard ristoratore** — KPI: annunci attivi, candidature da rivedere, prossimi turni, crediti, piano. CTA grandi: "Nuova richiesta", "Vedi candidature".
3. **Creazione richiesta** — wizard a step (ruolo → data/ora → luogo → tariffa → note → riepilogo+pubblica). Salvataggio bozza (`status='draft'`).
4. **Lista annunci** — filtri per stato (bozza / pubblicata / assegnata / completata / annullata) con conteggio candidature.
5. **Dettaglio annuncio + candidature** — lista candidati con rating, badge, affidabilità, esperienza; pulsanti "Accetta" / "Rifiuta" / "Controproposta"; quando si accetta uno, gli altri passano a `rejected` automaticamente.
6. **Match confermato** — banner di conferma con dati turno; collegamento alla chat e ai turni.
7. **Turni** — segna completato, segna no-show, annulla; CTA "Lascia recensione" dopo `completed`.
8. **Recensioni** — form già esistente, verifico collegamento da turno completato.
9. **Storico** — tab "Completati" + "Annullati" su annunci e turni.
10. **Crediti & piano** — pagina già presente (`/billing`), aggiungere widget compatto in dashboard.
11. **Notifiche** — già completate nelle iterazioni precedenti, solo verifica collegamenti.

## 4. Test finale

Script manuale che simulo via lettura del codice + console del preview:
- signup ristoratore demo → onboarding → creazione annuncio → pubblicazione → (con un worker demo) candidatura → accettazione → turno → completamento → recensione → storico → crediti.

## 5. Output finale

Report strutturato con i 9 punti che hai chiesto.

---

## Domanda prima di partire

Questa attività è grande (potenzialmente 3–6 migrazioni e 10+ file UI modificati, costo crediti significativo). **Vuoi che proceda così come descritto sopra**, oppure preferisci che io spezzi il lavoro in 2–3 iterazioni più piccole, per esempio:

- **Iterazione A**: solo audit + report scritto, senza modifiche, così decidi tu cosa correggere.
- **Iterazione B**: solo DB + stati + onboarding obbligatorio.
- **Iterazione C**: solo UI dashboard + wizard creazione richiesta + gestione candidature.

Indicami quale strada preferisci e procedo.
