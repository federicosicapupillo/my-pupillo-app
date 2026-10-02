# Problema 2 — Controfferte esistenti con flag `counteroffer_enabled` spento

## Cosa risulta oggi (verificato sul database reale)
- Flag: `counteroffer_enabled = false`, `payments_enabled = false`.
- **Controfferte esistenti: 0.** Nessuna riga in `counter_offer`, né reale né demo. Non c'è nulla da sbloccare e non serve toccare dati.
- **Il controllo sul flag (`enforce_counteroffer_flag`) è già corretto.** Blocca solo la creazione di una nuova controfferta e l'inserimento o la modifica di una tariffa proposta. Accettare, rifiutare, annullare, far scadere o azzerare la tariffa sono già permessi.
- **La conferma (`accept_application_atomic`) è già un'unica operazione con annullamento garantito.** Addebito, cambio di stato e assegnazione avvengono nello stesso blocco: se un passaggio fallisce, anche l'addebito viene annullato. Il testo all'utente dice già "Nessun credito è stato scalato".
- **Con pagamenti spenti non viene scalato nulla.** `consume_credits` scrive solo una riga di registro a 0 crediti, che serve a evitare doppi addebiti.

Il sintomo segnalato quindi non si può riprodurre con lo stato attuale. È probabilmente un avviso nato prima delle correzioni precedenti. Restano però alcuni buchi reali, elencati sotto.

## Buchi reali da chiudere
1. **Il lavoratore non può annullare una controfferta in corso.** `cancelApplication` in `messages.$id.tsx` accetta solo lo stato `pending`. La correzione permette anche `counter_offer`, con lo stesso testo e la stessa notifica.
2. **Errori tecnici mostrati così come sono.** `toast.error(error.message)` compare all'annullamento della candidatura (riga 1852) e al salvataggio della recensione (riga 2199). Li sostituisco con testi chiari in italiano, lasciando i dettagli solo nella console.
3. **Tariffa applicata quando si accetta una controfferta: da verificare.** La conferma non legge `proposed_tariff`. Il primo passo è controllare se il turno creato (`create_shift_on_accept`) usa la tariffa proposta o quella dell'annuncio.
   - Se usa già la tariffa proposta: nessuna modifica.
   - Altrimenti: una piccola migrazione su `create_shift_on_accept` usa `COALESCE(proposed_tariff, tariff_amount)`. Non cambia la logica dei crediti né il resto.
4. **"Riaprire" una controfferta** (cioè riportare una candidatura a `counter_offer` dopo averla chiusa) con il flag spento resta bloccato, come previsto. Equivale a crearne una nuova. Se intendi altro con "riaprire", dimmelo.

## Cosa NON cambio
Non tocco flag, prezzi, permessi o `consume_credits`, né il controllo sul flag e la conferma, che sono già corretti. Il pulsante e la finestra per creare controfferte restano nascosti finché il flag è spento.

## Migrazioni e pubblicazione
- Una migrazione serve solo se il punto 3 conferma il problema. Avrebbe effetto immediato sul database reale, perché preview e produzione lo condividono. Non danneggia l'app pubblicata, perché tocca solo la tariffa del turno creato.
- I punti 1 e 2 sono modifiche all'app: in preview si vedono subito, in produzione solo dopo la pubblicazione.

## Rischi
- Rischi bassi: oggi non esistono controfferte, quindi nessun utente reale è coinvolto in questo momento.
- Se in futuro il flag viene riacceso e poi rispento, le controfferte rimaste aperte saranno gestibili, compreso l'annullamento da parte del lavoratore.

## Verifica
1. Rileggo `create_shift_on_accept` e confermo o escludo il punto 3.
2. Test sul database dentro una transazione annullata alla fine, così nessun dato resta modificato:
   - creo una controfferta di prova con il flag acceso temporaneamente solo in quella transazione;
   - spengo il flag e controllo che accettare, rifiutare, annullare e tornare alla tariffa originale passino;
   - controllo che creare una nuova controfferta sia bloccato;
   - forzo un fallimento della conferma e controllo che non resti nessuna riga di addebito.
3. Test automatici esistenti (`proposal-status`, `proposal-decision`) e controllo dei tipi.
4. Riepilogo: conteggio dei crediti prima e dopo invariato, nessun messaggio tecnico visibile.
