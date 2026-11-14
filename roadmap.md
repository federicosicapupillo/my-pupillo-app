# Roadmap

- [x] Cinque stelle ad almeno due lavori dichiarati o gestione attività/team, quattro agli inizi; punteggi reali e rubriche precedenti invariati. 49 test passati; PDF allegato analizzato nell’onboarding temporaneo: 86/100 e cinque stelle, persistenti dopo ricaricamento; account rimosso. Lettura su profilo completo non ripetuta per requisiti anagrafici mancanti nella prova; nessuna pubblicazione né modifica del risultato dell’utente.

- [x] Riconoscimento curriculum: quattro stelle di base per documenti leggibili, cinque da 85 punti senza dubbi; mansione «worker» sanificata e falso zero eliminato. 42 test passati; PDF reale nell’onboarding temporaneo: 83/100, quattro stelle persistenti dopo ricaricamento, consenso salvato; account di prova eliminati, nessun risultato storico riscritto. Lettura pubblica non verificata perché i profili di prova non completavano gli ulteriori requisiti; nessuna pubblicazione eseguita.

- [x] Cellulare bloccato dopo OTP email: controllo immediato nell’onboarding, blocco persistente anche cambiando email, salvataggi invariati. 8 test unitari e 22 controlli sui due ruoli passati; campo disabilitato verificato dopo ricaricamento con account temporaneo e conferma email predisposta. Ricezione/inserimento OTP reale non ripetuti.

- [x] Rientro Google su /auth anziché homepage; navigazione dopo caricamento ruolo/profilo, profili incompleti su onboarding. Verifica OAuth esterna completa richiede consenso Google dell'utente.

- [x] OTP di completamento profilo via Cloud Auth/email dell’account; eliminato codice simulato, cellulare non verificato, controlli profilo aggiornati. 88 test passati, salvataggio entrambi ruoli e rifiuto codice errato verificati; account di prova rimosso.
- [ ] Verifica ricezione email OTP brandizzata e inserimento codice reale: richiede pubblicazione dei modelli auth e codice ricevuto nella casella email; nessuna pubblicazione eseguita.

- [x] Ricerca lavoratori lato ristoratore: stelle curriculum Pupillo in lista e profilo, tutte le 19 date salvate accessibili con «Vedi tutte» e sul profilo; lettura indipendente dal vecchio flag senza modificarlo. Verifica autenticata sul risultato reale a 4 stelle, 42 test passati, build OK; nessun dato o punteggio modificato, non pubblicato.

- [x] Valutazione automatica al caricamento/sostituzione senza richiesta separata né scelta della mansione; consenso raccolto prima dell’upload. Verificato ricaricando lo stesso PDF reale: analisi completata a 73/100, 4 stelle, risultato persistente e visibile ai ristoratori; 39 test passati, build OK, mobile senza overflow. Non pubblicato.

- [x] Curriculum nel profilo: Revoca consenso rimosso, sostituzione disponibile, nuove analisi con consenso esplicito alla pubblicazione automatica da quattro stelle; messaggio sotto soglia verificato sul punteggio reale 29/100, curriculum non sovrascritto. 36 test passati, build OK, desktop/mobile verificati; nessuna pubblicazione retroattiva. Verifica integrale di una nuova valutazione idonea resta bloccata dall'assenza di un curriculum reale idoneo, come indicato sotto.

- [x] Grafica approvata applicata alle offerte ricevute, sfondo viola condiviso preservato; sette filtri e cinque ordinamenti verificati in sessione su desktop/mobile, nessun overflow o errore runtime, build OK. Nessuna offerta presente nell'account di verifica; azioni sulle offerte lasciate invariate.

- [x] Disponibilità per singola data con salvataggio atomico; copia esplicita su settimana o giorni omonimi futuri del mese selezionati. Verificati in sessione 7 novembre colazione / 14 pranzo persistenti, 21 invariato e copia selettiva senza il 14; 7 test passati, build OK, nessun overflow mobile. Disponibilità settimanali preesistenti preservate come base.

- [x] Calcolo diretto del curriculum con consenso, senza attesa di approvazione manuale; analisi reale completata a 29/100 e persistente nella dashboard, privata sotto soglia. Desktop/mobile verificati, 30 test passati e build OK; scelta pubblicazione da 4 stelle mantenuta.

- [x] Punteggio curriculum privato nella dashboard, criteri e scelta di visibilità ai ristoratori per valutazioni approvate da 4 stelle; 18 test passati, build OK, stato reale «Richiesta ricevuta» verificato in sessione e nessun overflow mobile. Nessuna analisi già completata disponibile per verificare il cambio visibilità integrale.

- [x] Mostrare la valutazione curriculum approvata nella sezione Reputation Score della dashboard, separata dalle recensioni, e chiarire la visibilità ai ristoratori nella richiesta e nel consenso.

- [x] Valutazione curriculum Pupillo: richiesta e consenso, analisi per mansione, approvazione admin, stelle separate sul profilo; 11 test passati, chiamata IA su PDF fittizio riuscita, richiesta/persistenza/revoca verificate nell'onboarding autenticato; PDF di prova rimosso.
- [x] Verifica stelle visibili ai ristoratori su profilo completo: risultato reale a 4 stelle verificato nella ricerca e nel profilo il 7 novembre 2026, senza alterare punteggi o consensi.

- [x] Curriculum facoltativo privato in Esperienza e preferenze: PDF max 5 MB, apertura, sostituzione, rimozione; 4 test e flusso verificato in sessione su desktop/mobile, file di prova rimosso.

- [x] Onboarding lavoratori: partenza Torino, quartieri e residenza regione/provincia/comune; area operativa allineata senza cancellazioni. 35 test superati; menu provati in sessione su desktop/mobile senza salvare un profilo.

- [x] Restyling homepage (solo presentazione, anteprima, nessuna pubblicazione) — baseline bce06cebb4d123475d0746762d29a3b730be9f7a
- [x] Video homepage lavoratori/ristoratori — file reali integrati e layout verificato
- [ ] Verifica riproduzione MP4 ristoratori in browser con codec H.264/AAC — browser di verifica privo dei codec necessari
