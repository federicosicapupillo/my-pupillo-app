# Errori nei registri (controllo del 15/10/2026, ore 12:39 UTC)

Ecco solo l'elenco: non ho modificato niente.

**Limite:** i registri non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: registri solo dalle 12:30 UTC circa.
- Funzioni del sito: registri solo dalle 11:45 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessun errore e nessuna risposta 4xx/5xx. Prova: 9 righe in tutto.
   - 7 righe hanno risposta 200.
   - 2 righe non hanno un codice di risposta. Sono di livello «info», con il messaggio «Login» e senza errore.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 27 risposte 200 e 1 risposta 201 (una notifica creata).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp`, il collegamento con gli assistenti esterni, ha risposto 400 per 2 volte. L'ultima è alle 12:38:24 UTC.
     - **Causa:** nei registri non c'è scritta.
     - **Ipotesi non confermata:** subito dopo arrivano risposte 200/202 con accesso valido. Quindi è probabilmente il primo tentativo di collegamento.
   - Hanno risposto tutti 200:
     - il lavoro automatico che chiude gli annunci scaduti (11:45, 12:00, 12:15, 12:30);
     - `jarvis-kpi` (12:38);
     - la homepage.
