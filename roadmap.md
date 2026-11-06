# Roadmap

- [x] Valutazione automatica al caricamento/sostituzione senza richiesta separata né scelta della mansione; consenso raccolto prima dell’upload. Verificato ricaricando lo stesso PDF reale: analisi completata a 73/100, 4 stelle, risultato persistente e visibile ai ristoratori; 39 test passati, build OK, mobile senza overflow. Non pubblicato.

- [x] Curriculum nel profilo: Revoca consenso rimosso, sostituzione disponibile, nuove analisi con consenso esplicito alla pubblicazione automatica da quattro stelle; messaggio sotto soglia verificato sul punteggio reale 29/100, curriculum non sovrascritto. 36 test passati, build OK, desktop/mobile verificati; nessuna pubblicazione retroattiva. Verifica integrale di una nuova valutazione idonea resta bloccata dall'assenza di un curriculum reale idoneo, come indicato sotto.

- [x] Grafica approvata applicata alle offerte ricevute, sfondo viola condiviso preservato; sette filtri e cinque ordinamenti verificati in sessione su desktop/mobile, nessun overflow o errore runtime, build OK. Nessuna offerta presente nell'account di verifica; azioni sulle offerte lasciate invariate.

- [x] Disponibilità per singola data con salvataggio atomico; copia esplicita su settimana o giorni omonimi futuri del mese selezionati. Verificati in sessione 7 novembre colazione / 14 pranzo persistenti, 21 invariato e copia selettiva senza il 14; 7 test passati, build OK, nessun overflow mobile. Disponibilità settimanali preesistenti preservate come base.

- [x] Calcolo diretto del curriculum con consenso, senza attesa di approvazione manuale; analisi reale completata a 29/100 e persistente nella dashboard, privata sotto soglia. Desktop/mobile verificati, 30 test passati e build OK; scelta pubblicazione da 4 stelle mantenuta.

- [x] Punteggio curriculum privato nella dashboard, criteri e scelta di visibilità ai ristoratori per valutazioni approvate da 4 stelle; 18 test passati, build OK, stato reale «Richiesta ricevuta» verificato in sessione e nessun overflow mobile. Nessuna analisi già completata disponibile per verificare il cambio visibilità integrale.

- [x] Mostrare la valutazione curriculum approvata nella sezione Reputation Score della dashboard, separata dalle recensioni, e chiarire la visibilità ai ristoratori nella richiesta e nel consenso.

- [x] Valutazione curriculum Pupillo: richiesta e consenso, analisi per mansione, approvazione admin, stelle separate sul profilo; 11 test passati, chiamata IA su PDF fittizio riuscita, richiesta/persistenza/revoca verificate nell'onboarding autenticato; PDF di prova rimosso.
- [ ] Verifica integrale scelta lavoratore → stelle visibili su profilo completo — approvazione manuale superata dal calcolo diretto; il curriculum disponibile è sotto soglia (29/100), serve un profilo completo con valutazione idonea per provare la pubblicazione senza alterare punteggi reali.

- [x] Curriculum facoltativo privato in Esperienza e preferenze: PDF max 5 MB, apertura, sostituzione, rimozione; 4 test e flusso verificato in sessione su desktop/mobile, file di prova rimosso.

- [x] Onboarding lavoratori: partenza Torino, quartieri e residenza regione/provincia/comune; area operativa allineata senza cancellazioni. 35 test superati; menu provati in sessione su desktop/mobile senza salvare un profilo.

- [x] Restyling homepage (solo presentazione, anteprima, nessuna pubblicazione) — baseline bce06cebb4d123475d0746762d29a3b730be9f7a
- [x] Video homepage lavoratori/ristoratori — file reali integrati e layout verificato
- [ ] Verifica riproduzione MP4 ristoratori in browser con codec H.264/AAC — browser di verifica privo dei codec necessari
