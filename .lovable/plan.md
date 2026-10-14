# Errori nei registri (controllo del 14/10/2026, ore 06:52 UTC)

Ecco solo l'elenco: non ho modificato niente.

**Limite:** i registri non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: registri solo dalle 06:45 UTC circa.
- Funzioni del sito: registri solo dalle 06:00 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessuna risposta 4xx/5xx. Prova: 4 righe, tutte con risposta 200.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 13 risposte 200 e 1 risposta 201 (una notifica creata).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) → 400, 2 volte. L'ultima è alle 06:51:15 UTC.
     - **Causa:** non è scritta nei registri.
     - **Ipotesi non confermata:** subito dopo arrivano risposte 200/202 con accesso valido. Quindi probabilmente è il primo tentativo di collegamento.
   - `GET pupillo.life/robots.txt` → 404, 1 volta alle 06:27:59 UTC.
     - **Causa:** il sito non ha il file `robots.txt`, quello che leggono i motori di ricerca.
     - Non blocca gli utenti.
   - Hanno risposto tutti 200:
     - il lavoro automatico che chiude gli annunci scaduti (06:00, 06:15, 06:30, 06:45);
     - `jarvis-kpi` (06:51);
     - la homepage.
