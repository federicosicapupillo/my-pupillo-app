# Report errori ultime 24 ore (sola lettura, 06/10/2026 06:51 UTC)

Nessuna modifica fatta. Questo è un report, non c'è niente da costruire.

## Limite importante
I registri accessibili coprono di fatto solo l'ultima ora circa (dalle 05:54 UTC). Nelle "24 ore" il database restituisce solo 101 righe in totale, tutte recenti. Per le ore precedenti non posso dire niente.

## Fatti verificati
1. Database (Postgres): 0 righe ERROR/FATAL, 0 "permission denied". Prova: query per gravità e testo, risultato vuoto.
2. Accessi (auth): 0 risposte 4xx/5xx o errori. Prova: query su status >= 400 e livello error/fatal, risultato vuoto (4 righe totali, tutte ok).
3. Richieste al backend (edge): 0 risposte 4xx/5xx su 15 richieste.
4. Funzioni server del sito:
   - `POST /mcp` -> 400: 2 volte, l'ultima alle 06:50:51 UTC. Causa probabile (non confermata): primo tentativo del client MCP prima dell'autenticazione; subito dopo seguono risposte 200 con login valido.
   - Strumento MCP `search_announcements` -> esito "tool_error": 1 volta, alle 06:04:53 UTC. Causa non visibile nei registri (manca il dettaglio).
   - Job `expire-stale`: 4 esecuzioni (06:00, 06:15, 06:30, 06:45), tutte 200, nessun errore.
   - Pagine `pupillo.life/`: tutte 200.
   - Nessuna chiamata a `jarvis-kpi` nel periodo.

## Ipotesi da verificare (non fatti)
- Il job crea "18 promemoria recensione" a ogni giro con gli stessi 18 turni. Potrebbe essere solo un conteggio dei candidati (con blocco dei doppioni a valle) oppure creare notifiche doppie. Da controllare sulle notifiche reali prima di concludere.
- Avviso innocuo nell'anteprima: due file di test in `src/routes/__tests__/` generano un warning "does not export a Route".
