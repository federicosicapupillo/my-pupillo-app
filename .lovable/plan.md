# jarvis-kpi — endpoint KPI aggregati (sola lettura)

## Risposte preliminari

**a) URL**
Questo progetto non usa le Edge Functions classiche: il backend gira dentro l'app stessa. Il percorso equivalente, protetto solo dalla tua chiave, è:
- Produzione: `https://pupillo.life/api/public/jarvis-kpi` (anche `https://my-pupillo-app.lovable.app/api/public/jarvis-kpi`)
- Preview: `https://project--81341205-eede-4204-8584-66229ea985c7-dev.lovable.app/api/public/jarvis-kpi`

Il comportamento è identico a quello di una Edge Function (GET, header `X-Jarvis-Key`, risposta JSON). In produzione diventa attivo solo dopo la pubblicazione.

**b) Secret `JARVIS_KPI_KEY`**
Vai in Project Settings → Secrets → Aggiungi, nome `JARVIS_KPI_KEY`, e incolla un valore casuale lungo (es. `openssl rand -hex 32` sul Mac). Usa lo stesso valore in Jarvis. Io non genero la chiave e non la scrivo nel codice.

**c) Campi mancanti o con nome diverso**
- `user_roles` non ha `created_at` né `is_demo`/`is_deleted`: lo collego a `profiles` (id = user_id) per le date e per escludere demo e profili cancellati. I ruoli sono `restaurant` / `worker` (`admin` escluso dai totali).
- `credit_transactions` non ha `is_demo`: escludo i movimenti di utenti demo o cancellati tramite `profiles`.
- `worker_incidents.incident_type` può essere vuoto nei record più vecchi: in quel caso uso `kind` come ripiego (valore "non_specificato" se mancano entrambi).
- `reviews`: le colonne `rating`, `punctuality`, `professionalism`, `competence`, `reliability`, `teamwork` esistono. Le medie ignorano i valori vuoti.
- `shifts`: `hours`, `amount`, `status` e `completed_at` esistono. Per "turni completati per settimana" uso `completed_at`.
- Tutti gli altri campi richiesti esistono con il nome indicato.

## Cosa costruisco
Un solo file nuovo: `src/routes/api/public/jarvis-kpi.ts`.
- `OPTIONS` → risposta CORS (header permessi: `X-Jarvis-Key`), `GET` → KPI, tutti gli altri metodi → 405.
- Se manca il secret, manca l'header o la chiave non corrisponde: 401 con `{"error":"unauthorized"}`. Il confronto usa `timingSafeEqual` sugli hash SHA-256 di entrambi i valori, così la lunghezza è sempre la stessa.
- Nessun parametro letto da query string o body.
- Le letture usano il client privilegiato lato server (serve per sommare dati di tutti gli utenti), caricato solo dopo il controllo della chiave. Solo `select`, nessuna scrittura.
- Selezioni limitate alle colonne necessarie (status, date, numeri, flag). L'aggregazione avviene in memoria e la risposta contiene solo conteggi, somme, medie e date di inizio settimana. Nessun id e nessun testo.
- Lettura paginata (blocchi da 1000 righe) per non troncare i totali.
- Header `Cache-Control: no-store`.

## Forma JSON
```text
{ generato_il,
  utenti: { totali, ristoranti, lavoratori, nuovi_7g, nuovi_30g },
  annunci: { totali, per_stato{}, ultimi_30g },
  candidature: { totali, per_stato{}, ultimi_30g, perc_accettate },
  turni: { totali, per_stato{}, completati, ore_totali, importo_totale, ultimi_30g },
  recensioni: { totali, media_rating, medie{punctuality,...,teamwork} },
  incidenti: { totali, per_tipo{}, ultimi_30g },
  crediti: { movimenti, somma_positivi, somma_negativi, per_kind{} },
  serie_settimanale: [ { settimana, nuovi_utenti, annunci, candidature, turni_completati } x12 ] }
```
`perc_accettate` conta come accettate le candidature con stato accepted o equivalente "assegnato".

## Cosa non tocco
Nessuna modifica a interfaccia, database, migrazioni, RLS o altri file. Aggiungo una riga in AGENTS.md per registrare questo endpoint.

## Verifica
Chiamo l'endpoint senza header (atteso 401), con chiave errata (atteso 401) e, quando avrai impostato il secret, con la chiave giusta (atteso JSON senza dati personali).
