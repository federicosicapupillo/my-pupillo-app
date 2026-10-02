# Fix: job di scadenza annunci (expire-stale) che fallisce sempre

## Cosa cambia (in breve)
1. Il controllo sulle "etichette di test" scatta solo quando cambiano davvero i testi visibili. Non scatta più quando cambiano solo lo stato o le scadenze.
2. Il job salta gli annunci demo e porta avanti ogni fase in modo indipendente. Se qualcosa va storto, registra l'errore e continua.
3. Nessun dato esistente viene cancellato o modificato a mano. Le note «A0 bozza» restano come sono.

## 1. Migrazione: trigger `block_test_labels_in_visible_notes`
Verificato: la funzione oggi controlla `notes`, `job_location_notes` e `job_additional_directions` (oppure `operational_notes`, `worker_notes` e `description` su `job_requests`). Lo fa su OGNI INSERT/UPDATE delle righe fixture (`is_demo` oppure `seed_batch_id` valorizzato), quindi anche quando cambia solo `status`.

La correzione riscrive solo il corpo della funzione con `CREATE OR REPLACE`. Le firme e i trigger `trg_block_test_labels_announcements` / `_job_requests` restano invariati:
- su `INSERT` il controllo resta identico;
- su `UPDATE`, se nessuno dei 3 campi testo è cambiato (`IS NOT DISTINCT FROM OLD`), restituisce subito NEW;
- su `UPDATE`, se un campo testo cambia, controlla solo i campi cambiati, con lo stesso pattern.

Le note già esistenti con «A0 bozza» non bloccano più gli aggiornamenti di stato. Restano invece bloccate se qualcuno riscrive quelle note con un'etichetta di test.

**Attenzione: preview e produzione condividono lo stesso database.** La migrazione ha effetto immediato e reale appena viene applicata, senza bisogno di pubblicare. È un cambiamento che rende il controllo meno severo, e solo sugli aggiornamenti. Non tocca dati, permessi o flag.

## 2. Codice: `src/routes/api/public/hooks/expire-stale.ts`
- **Fase A (annunci):** aggiungo `.eq('is_demo', false)` alla selezione dei candidati e all'aggiornamento. L'aggiornamento avviene a blocchi; se un blocco fallisce, riprovo riga per riga e salvo gli id che non passano in `errors[]`, senza `return 500`.
- **Fase B (candidature scadute):** la metto in un try/catch separato. Se fallisce, registra l'errore e il job prosegue.
- **Fase C (notifiche annunci e candidature):** try/catch separato, registra l'errore.
- **Fase D (promemoria recensioni):** è già isolata e resta com'è.
- **Risposta:** sempre 200 con i conteggi di ogni fase e un elenco `errors: [{phase, id?, message}]`, più `console.error` con il tag `[PUPILLO_EXPIRE_STALE]`. La risposta 401 per chiave mancante resta. Restituisce 500 solo se TUTTE le fasi falliscono, così l'allarme rimane quando il sistema è davvero rotto.
- La fase B non filtra i dati demo: la richiesta parla di annunci demo e le candidature non hanno il problema del trigger. Va bene così?

Queste modifiche al codice vanno in produzione solo con la pubblicazione. In preview si vedono subito.

## 3. Rischi
- Appena la migrazione è applicata e il codice è pubblicato, la prima esecuzione recupera in un colpo solo l'arretrato: circa 30 annunci passano a «expired», 2 candidature scadono e partono i relativi promemoria. Arrivano quindi notifiche reali (con controllo anti-duplicati) ai ristoratori e ai lavoratori interessati, anche su annunci vecchi. È il comportamento voluto, ma va saputo.
- Gli annunci demo attivi e scaduti resteranno «active». È voluto: il job li esclude.
- Se applico la migrazione senza pubblicare, il job in produzione funziona già: il vecchio codice smette di fallire perché il trigger non blocca più. Però non esclude i demo, quindi farebbe scadere anche i 3 annunci di test attivi. Per evitarlo, conviene applicare la migrazione e pubblicare a breve distanza.
- I 16 turni «scheduled» già finiti: questo job non ne cambia lo stato, invia solo i promemoria per le recensioni. Se vanno chiusi, serve un intervento separato (fuori da questa richiesta).

## 4. Verifica
1. Prima della migrazione: conto gli annunci attivi già passati (demo e non demo), le candidature pending scadute e i turni da recensire.
2. Dopo la migrazione: rilancio la stessa query sulla funzione per confermare il nuovo corpo.
3. Chiamo l'endpoint della preview con la chiave corretta: mi aspetto 200, `errors` vuoto o solo righe isolate, e conteggi maggiori di 0.
4. Rifaccio le query: annunci non demo passati = 0, candidature pending scadute = 0, annunci demo invariati, note «A0 bozza» invariate.
5. Dopo la pubblicazione: controllo i log delle esecuzioni successive del cron `expire-stale-pupillo` per confermare che non ci sono più 500.

## Dettagli tecnici
- Un solo file di migrazione (`CREATE OR REPLACE FUNCTION public.block_test_labels_in_visible_notes()`), con lo stesso `search_path` e senza SECURITY DEFINER, come oggi.
- Un solo file di codice modificato: `expire-stale.ts`. Nessun cambiamento a interfaccia, flag, crediti, permessi o cron.
