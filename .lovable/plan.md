# Errori nei registri (controllo del 17/10/2026, ore 09:54 UTC)

Ecco solo l'elenco. Non ho modificato niente.

**Limite:** i registri disponibili non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: registri solo dalle 09:45 UTC circa.
- Funzioni del sito: registri solo dalle 09:32 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessun errore. Prova: 5 righe, tutte con risposta 200 e messaggio «request completed».
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 19 risposte 200 e 1 risposta 201 (una notifica creata).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) ha risposto 400 per 3 volte. L'ultima è alle 09:52:55 UTC.
     - **Causa:** non è scritta nei registri.
     - **Ipotesi non confermata:** subito dopo arrivano risposte 200/202 con accesso valido, quindi è probabilmente il primo tentativo di collegamento.
   - Hanno risposto tutti 200:
     - il lavoro automatico che chiude gli annunci scaduti (09:45);
     - `jarvis-kpi` (09:53);
     - la homepage.
