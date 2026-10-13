# Errori nei registri (controllo del 13/10/2026, ore 14:22 UTC)

Ecco solo l'elenco: non ho modificato né codice né dati.

**Limite:** i registri non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: ci sono registri solo dalle 14:15 UTC circa.
- Funzioni del sito: ci sono registri solo dalle 13:53 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessuna risposta 4xx/5xx. Prova: 4 righe, tutte con risposta 200.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 20 risposte 200 e 1 risposta 201 (una notifica creata).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) → 400, 2 volte, l'ultima alle 14:21:10 UTC.
     - **Causa:** non è scritta nei registri.
     - **Ipotesi non confermata:** subito dopo arrivano risposte 200/202 con accesso valido, quindi probabilmente è il primo tentativo di collegamento.
   - `GET pupillo.life/favicon.ico` → 404, 1 volta alle 14:05:47 UTC.
     - **Causa:** il sito non ha un file `favicon.ico`, ma solo `favicon.png`. Alcuni browser cercano comunque il file `.ico` (l'icona nella scheda del browser).
     - Non blocca gli utenti.
   - Hanno risposto tutti 200:
     - il lavoro automatico che chiude gli annunci scaduti (14:00 e 14:15);
     - `jarvis-kpi` (14:21);
     - la homepage.
