---
name: Regole globali Pupillo
description: Le 12 regole permanenti del progetto Pupillo — sicurezza RLS, ruoli, candidature, posizioni, crediti, privacy, notifiche, profilo, test obbligatori
type: constraint
---

# Regole globali progetto Pupillo

Da rispettare in ogni modifica futura. Non ignorare, sovrascrivere o aggirare salvo richiesta esplicita del proprietario.

## 1. Non rompere ciò che funziona
Prima di modificare, controlla la logica esistente. Non cambiare layout, colori, navigazione, nomi pagine, testi funzionanti, logiche corrette, schema DB, auth, gestione ruoli senza richiesta esplicita. Modifiche mirate solo al problema indicato.

## 2. Sicurezza Supabase / RLS
- Mai disattivare RLS.
- Mai usare service role key nel frontend.
- Mai aggirare policy con soluzioni insicure.
- Errori RLS si risolvono correggendo: policy, payload, relazione tra `auth.uid()`, `profiles.id`, `profiles.user_id`, e gli id usati nelle tabelle.
- Verifica sempre lo schema reale prima di creare/modificare policy. Non assumere che `auth.uid() = profiles.id`, `worker_id = auth.uid()`, `restaurant_id = auth.uid()`.

## 3. Ruoli utente
Ruoli: lavoratore, ristoratore, admin. Ogni utente vede/modifica solo i dati autorizzati. Il lavoratore non modifica dati del ristoratore e viceversa (salvo azioni consentite: conferma turno, recensione, messaggi, gestione candidatura). Admin solo da aree previste.

## 4. Candidature
- Lavoratore autenticato con profilo valido.
- Usare `worker_id` e `job_request_id` corretti.
- Salvare in `applications`, stato iniziale `pending`.
- Nessun credito scalato, nessun turno confermato, nessun dato non autorizzato del ristoratore.
- No doppia candidatura stesso annuncio → "Hai già inviato la candidatura per questo turno."

## 5. Annunci assegnati / posizioni aperte
- Candidature `pending` non chiudono mai l'annuncio.
- Annuncio completo solo quando lavoratori realmente confermati/assegnati = posizioni richieste.
- Stati assegnati: `confirmed`, `accepted`, `assigned` (o equivalenti).
- Non contare: `pending`, `rejected`, `cancelled`, proposta inviata, chat, view.
- `positionsRequired` null/0/undefined → trattare come 1.
- `isFull = assignedCount >= positionsRequired`. Bloccare nuove candidature solo se `isFull`.

## 6. Crediti
Scalare SOLO alla conferma reale del turno (`confirmed`/`accepted`/`assigned`). Mai su: candidatura inviata/ricevuta, chat aperta, profilo visto, proposta inviata/ricevuta, notifica.
- Una sola transazione per lavoratore confermato.
- Prima di scalare, verificare che non esista già una transazione collegata a stesso `restaurant_id` + `worker_id` + `job_request_id`/`shift_id` + `application_id`/`proposal_id` + tipo `conferma_turno`.
- Conferma turno e scarico credito ATOMICI.
- Crediti insufficienti → popup:
  - Titolo: "Crediti insufficienti"
  - Testo: "Per confermare questo turno devi avere crediti disponibili. Puoi attivare subito il piano Basic oppure visualizzare tutti i piani Pupillo."
  - Primario: "Attiva Basic" → checkout diretto Basic
  - Secondario: "Vedi tutti i piani" → pagina piani

## 7. Privacy lavoratore / ristoratore
Prima della conferma: solo info autorizzate. Nome completo lavoratore non visibile al ristoratore se la privacy prevede anonimato fino a conferma. Nome locale/dati sensibili ristoratore non visibili al lavoratore se previsto. Dati completi solo dopo relazione autorizzata.

## 8. Chat e notifiche
Notifiche portano sempre alla pagina corretta (chat/dettaglio/turno/messaggio). Nessuna notifica duplicata. Conferma candidatura → una sola notifica "Candidatura confermata" che apre la chat con istruzioni.

## 9. Profilo completo
Profilo < 100% → bloccare funzioni operative: candidature, conferme turno, chat operative, proposte, pubblicazione annunci, accettazione candidature, matching.
Mai bloccare: completamento profilo, impostazioni, assistenza, privacy, termini, logout.

## 10. Test obbligatori dopo ogni modifica
- Lavoratore: login, Trova offerte, dettaglio annuncio, invio candidatura, candidatura duplicata, annuncio completo, multi-posizione, chat, notifiche.
- Ristoratore: login, creazione annuncio, ricezione candidatura, accetta/rifiuta, conferma turno, credito insufficiente, credito scalato, annuncio assegnato, multi-posizione.
- DB: riga `applications` creata, status corretto, nessun credito scalato all'invio, credito scalato solo a conferma, no doppio addebito, RLS funzionanti, no errori console/Supabase.

## 11. Errori
Mai nascondere errori reali con popup generici. Es. `new row violates row-level security policy for table applications` → risolvere su policy, id utente, id profilo, payload insert, permessi tabella. Mai workaround grafici.

## 12. Output atteso dopo ogni intervento
Sempre indicare: file modificati, tabelle Supabase toccate, policy RLS create/modificate, logica cambiata, test eseguiti, rischi residui. Spiegare cosa e dove, non solo "ho corretto".

## How to apply
Applica automaticamente ad ogni modifica del progetto Pupillo. In caso di conflitto tra una richiesta puntuale e queste regole, segnalalo all'utente prima di procedere.