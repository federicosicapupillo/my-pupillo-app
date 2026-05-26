# Project Memory — Pupillo

## Core
Non rompere ciò che funziona: modifiche mirate solo al problema indicato. Non toccare layout, colori, navigazione, nomi pagine, schema DB, auth, ruoli senza richiesta esplicita.
RLS sempre attiva. Mai service role key nel frontend. Errori RLS si risolvono correggendo policy/payload/relazioni id, mai con workaround.
Ruoli: lavoratore, ristoratore, admin. Ognuno vede/modifica solo i propri dati autorizzati.
Candidature: worker autenticato + profilo valido, status iniziale `pending`, nessun credito scalato, no doppia candidatura stesso annuncio ("Hai già inviato la candidatura per questo turno.").
Annuncio completo SOLO se assignedCount (confirmed/accepted/assigned) >= positionsRequired (min 1, null/0/undefined = 1). Pending non chiude mai.
Crediti scalati SOLO alla conferma reale del turno, una sola volta per lavoratore, atomico con la conferma. Mai su candidatura/chat/proposta/notifica/view.
Crediti insufficienti → popup "Crediti insufficienti" con "Attiva Basic" (checkout diretto) + "Vedi tutti i piani".
Privacy: nome lavoratore e dati locale visibili solo dopo conferma/autorizzazione del flusso.
Notifiche: portano sempre alla pagina corretta, nessun duplicato. Conferma candidatura → una sola notifica "Candidatura confermata" che apre la chat.
Profilo non completo al 100% → bloccare funzioni operative (candidature, conferme, chat operative, proposte, pubblicazione annunci, accettazione). Non bloccare mai: completamento profilo, impostazioni, assistenza, privacy, termini, logout.
Errori reali mai nascosti con popup generici: messaggio chiaro + fix della causa.
Dopo ogni modifica riportare: file modificati, tabelle toccate, policy RLS create/modificate, logica cambiata, test eseguiti, rischi residui.

## Memories
- [Regole globali progetto](mem://rules/global) — Versione estesa delle 12 regole Pupillo (sicurezza, candidature, crediti, privacy, test obbligatori).