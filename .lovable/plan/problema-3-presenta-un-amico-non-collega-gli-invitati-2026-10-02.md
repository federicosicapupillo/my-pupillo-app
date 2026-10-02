# Problema 3 — «Presenta un amico» non collega gli invitati

## 1. Il flusso oggi (verificato)

1. **Link**: `ReferralCard` costruisce `https://<sito>/auth?role=worker&ref=<CODICE>` dal `referral_code` del profilo (generato dal trigger `profiles_set_referral_code` → `set_referral_code_on_insert`; 153 profili hanno un codice). Nota: il link forza sempre `role=worker`, anche se condiviso da un ristoratore.
2. **Cattura**: solo il parametro `?ref=` letto da `/auth` (`validateSearch`). Nessun salvataggio in localStorage, cookie o metadati utente: se l'utente naviga via, cambia scheda o ricarica senza parametro, il codice è perso.
3. **Registrazione email/password** (`auth.tsx` righe 269-276): subito dopo `signUp` il browser chiama `register_referral(_new_user, _code)`.
4. **Google/Apple** (`auth.tsx` righe 364 e 391): `register_referral` **non viene mai chiamata**; il codice non viene passato né salvato prima del redirect.
5. **`handle_new_user`**: non legge alcun codice invito (confermato).
6. **`register_referral`**: usa `auth.uid()` come invitato; esce senza fare nulla se non c'è sessione, se il codice non esiste, se è un auto-invito, oppure se il flag referral del ruolo **dell'invitante** è spento. Altrimenti scrive `profiles.referred_by_user_id` e una riga `referral_invites` con stato `registered`.
7. **Premio**: trigger `profiles_referral_award` (AFTER UPDATE su profiles) → `trigger_referral_award` → `award_referral_credits` quando, per la prima volta, `profile_completed` e `phone_verified` diventano entrambi veri. Ricontrolla auto-invito, il flag dell'invitante e `credits_awarded` (una sola volta), poi `grant_credits(+5)` e incrementa `referral_credits_earned`.

## 2. Dove si rompe (prove)

Conteggi dal database: profili con `referred_by_user_id` valorizzato **0**; righe `referral_invites` **0** (nessuna data, mai esistita); premi completati **0**; nuove iscrizioni reali negli ultimi 60 giorni 46.

Tre cause concomitanti, tutte attive oggi:
- **A — sessione assente**: con la conferma email obbligatoria, `signUp` non restituisce una sessione, quindi in `register_referral` `auth.uid()` è vuoto e la funzione esce subito senza errore (il `try/catch` non vede nulla). Da sola, questa causa rende il collegamento impossibile per tutte le iscrizioni via email.
- **B — OAuth**: Google/Apple non passano mai il codice.
- **C — flag**: con `worker_referral_enabled` e `restaurant_referral_enabled` spenti, `register_referral` scarta il collegamento anche se ci fosse una sessione.

Origine: non è una regressione recente di un singolo commit. La guardia «solo l'utente autenticato» (causa A) e il controllo del flag dentro `register_referral` (causa C) sono stati aggiunti in due migrazioni successive di hardening (luglio-agosto 2026); il flusso OAuth non ha mai gestito il codice. Dato che le righe sono sempre state 0, il flusso molto probabilmente non ha mai funzionato in produzione. Non indicherò un commit preciso come causa perché le prove non lo dimostrano.

## 3. Comportamento corretto proposto

**Collegamento (sempre, a prescindere dal flag)**
- Il codice viene salvato al primo arrivo su `/auth?ref=` (memoria del browser, insieme al ruolo scelto, come già succede per il ruolo in attesa) e passato:
  - nell'iscrizione email come metadato dell'utente (`options.data.referral_code`);
  - per Google/Apple, letto dalla memoria del browser dopo il ritorno, nello stesso punto in cui oggi viene assegnato il ruolo.
- Il collegamento viene scritto **lato database**:
  - in `handle_new_user`, leggendo `referral_code` dai metadati (copre le iscrizioni via email senza bisogno di sessione);
  - per OAuth, con `register_referral` chiamata dopo che la sessione esiste.
- `register_referral` non controlla più il flag (lo controlla solo il premio); resta valido solo per un profilo ancora senza invitante e creato da poco (es. ultime 24 ore), così non si può aggiungere un invitante a un account vecchio.
- Esclusi: auto-invito; stesso indirizzo email (normalizzato) o stesso telefono verificato dell'invitante; invitante eliminato o sospeso. Un invitato ha al massimo un invitante (già garantito dal vincolo unico su `referral_invites.referred_user_id`).

**Premio (invariato nella sostanza)**
- Scatta solo quando il profilo dell'invitato diventa completo con telefono verificato, una sola volta (`credits_awarded`), solo se in quel momento il flag dell'invitante è acceso.
- Aggiunta: nessun premio se il telefono verificato dell'invitato coincide con quello dell'invitante (account doppi).
- Se il flag è spento al momento del completamento, il collegamento resta registrato ma **nessun credito** viene dato, né allora né dopo (niente premi retroattivi quando il flag si accende).

**Con `payments_enabled = false`**: `grant_credits` non legge quel flag, quindi un premio, se il flag referral fosse acceso, aggiungerebbe comunque 5 crediti al saldo, che oggi non vengono consumati perché le conferme costano 0. Con i flag referral spenti (oggi) non viene dato nessun credito. Lascio questo comportamento invariato; dimmi se preferisci che i premi non vengano accreditati finché i pagamenti sono spenti.

## 4. Come evitare che si rompa di nuovo

- **Test automatico** (vitest, contro il database di test): iscrizione simulata con codice nei metadati → controllo di `referred_by_user_id` e della riga `registered`; auto-invito e stesso telefono → nessun collegamento; completamento del profilo con flag acceso/spento → 5 crediti una volta sola / nessun credito. Gira all'interno di una transazione annullata, senza lasciare dati.
- **Controllo in produzione**: aggiungere al feed Jarvis KPI un solo numero aggregato: «iscrizioni con codice invito negli ultimi 30 giorni» e «di cui collegate». Se arrivano iscrizioni con codice ma i collegati restano a 0, lo si nota subito. Il codice d'invito ricevuto viene salvato solo come indicatore nei metadati, nessun dato personale.
- `register_referral` restituirà un motivo (`ok`, `no_session`, `invalid_code`, `self`, `already_linked`) scritto nella console, invece di uscire in silenzio.

## Dettagli tecnici

File:
- `src/lib/signup-role.ts` (o un nuovo `src/lib/referral-capture.ts`): salva/legge/cancella il codice in sessionStorage.
- `src/routes/auth.tsx`: salva il codice all'arrivo; lo inserisce in `options.data.referral_code` in `signUp`; rimuove la chiamata RPC post-signUp inutile; nessuna modifica visiva.
- Punto in cui oggi viene completato il ruolo dopo OAuth (`claim_signup_role` / pagina di ritorno): chiama `register_referral` se c'è un codice salvato, poi lo cancella.
- `src/routes/api/public/jarvis-kpi.ts`: due conteggi aggregati in più.
- Test in `src/lib/__tests__/referral.test.ts`.

Migrazione unica (`referral_capture_fix`):
- `handle_new_user`: dopo l'inserimento del profilo, se `raw_user_meta_data->>'referral_code'` è presente chiama una funzione interna `_link_referral(new_user, code)` (nessun controllo del flag; auto-invito/doppioni esclusi). Un errore qui viene ignorato e non blocca mai l'iscrizione.
- `register_referral`: usa `_link_referral`, senza controllo flag, limitata ai profili creati da meno di 24 ore; restituisce un motivo testuale (cambio del tipo di ritorno → richiede drop+create con gli stessi permessi).
- `award_referral_credits`: aggiunto il controllo del telefono uguale; il resto invariato.
- Nessuna modifica a flag, prezzi, `grant_credits`, permessi o dati esistenti; nessun premio retroattivo (il trigger scatta solo sulle transizioni future).

## Rischi e pubblicazione

- **La migrazione ha effetto immediato sul database reale** (preview e produzione lo condividono). Da sola è sicura: con il sito attuale nessuno invia `referral_code` nei metadati, quindi `handle_new_user` si comporta come oggi; `register_referral` non è più chiamata con successo da nessuno.
- Il collegamento inizia a funzionare in produzione solo **dopo la pubblicazione** del sito aggiornato: serve pubblicare subito dopo.
- `handle_new_user` è critica per tutte le iscrizioni: la parte referral sarà isolata in un blocco che ignora gli errori; verifico con un'iscrizione di prova in preview (email e Google) prima di chiudere.
- Il link resta `role=worker`: non lo cambio (sarebbe un cambio di comportamento visibile); segnalo solo che i ristoratori invitati arrivano con il ruolo lavoratore preselezionato.

## Verifica

1. Dopo la migrazione: conteggi invariati (0 collegamenti, 0 inviti, nessun credito modificato).
2. In preview: iscrizione email con `?ref=` → profilo collegato e riga `registered`; stesso con Google; auto-invito → nessun collegamento.
3. Completamento del profilo con flag spento → nessun credito (non accendo il flag; il ramo «flag acceso» si verifica solo nel test in transazione annullata).
4. Test automatico verde; feed Jarvis mostra i nuovi conteggi.
5. Gli account di prova creati in preview restano nel database condiviso: ti chiedo prima se crearli o usare solo il test in transazione annullata.
