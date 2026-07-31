# Test fallito preesistente — `shift-proposal.e2e.test.ts`

**Test**: “updates the parent application so the realtime inbox preview and unread counter refresh”
**Stato**: fallisce, **non correlato al catalogo ruoli** (stessa asserzione e stesso codice sorgente negli ultimi 5 commit).

## Causa
Il test si aspetta `applications.last_message_preview === "Nuova proposta di lavoro"`.
Il codice attuale (`src/lib/shift-proposal.ts`, `buildProposalPreview`) scrive invece
un'anteprima **specifica**: `"Proposta: Cameriere · 12/06 · 19:00 - 23:00"`.

Il comportamento attuale è **voluto e documentato** nella JSDoc della funzione: due
candidature diverse dello stesso lavoratore verso lo stesso ristorante devono essere
distinguibili nella lista messaggi. La stringa generica è rimasta solo come fallback
quando l'annuncio non ha né ruolo né data né orario.

## Privacy
L'anteprima contiene **solo ruolo + data + orario**: nessun nome locale, nessun
indirizzo. Il vincolo di anonimato pre-conferma resta rispettato.

## Decisione
Il test è **obsoleto**, non il codice. Va aggiornato all'anteprima specifica
(oppure il prodotto deve decidere di tornare all'etichetta generica, perdendo la
distinguibilità in inbox). Non modificato in questo intervento perché fuori scope:
richiede una conferma di prodotto.