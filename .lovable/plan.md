# Errori nei registri, ultime 24 ore (controllo del 07/10/2026 alle 09:51 UTC)

Solo un elenco. Non c'è niente da costruire e non ho modificato nulla.

**Limite:** i registri disponibili risalgono solo a circa un'ora fa (dalle 08:54 UTC). Prima di quell'ora non ci sono righe da controllare.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessuna risposta 4xx/5xx e nessun errore. Prova: 13 righe controllate, nessuna con errore.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 38 richieste controllate.
4. **Funzioni server**, l'unico errore trovato:
   - `POST pupillo.life/mcp` ha risposto 400 per 2 volte, l'ultima alle 09:50:26 UTC.
   - Causa: non è scritta nei registri. Ogni 400 arriva subito prima di una serie di risposte 200 con accesso valido. Probabilmente è la prima chiamata di apertura del collegamento, ma non è confermato.
   - Tutto il resto ha risposto 200: il lavoro automatico `expire-stale` (alle 09:00, 09:15, 09:30 e 09:45), `jarvis-kpi` (alle 09:50:47) e la homepage.
