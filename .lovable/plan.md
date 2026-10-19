# Errori nei registri (controllo del 19/10/2026, ore 09:46 UTC)

Ecco solo l'elenco. Non ho modificato niente.

**Limite:** i registri disponibili non coprono tutte le 24 ore.
- Database e richieste al backend: registri solo dalle 09:45 UTC circa.
- Accessi: nessuna riga nel periodo disponibile.
- Funzioni del sito: registri solo dell'ultima ora circa.

1. **Database:** 1 ERROR, alle 09:45:57 UTC: `relation "job_posts" does not exist`.
   - **Causa:** una query ha cercato la tabella `job_posts`, che nel database non c'è (gli annunci stanno in `announcements`).
   - **Chi l'ha lanciata:** non è scritto nei registri. Il codice del progetto non è stato controllato. Ipotesi non confermata: un controllo esterno, ad esempio Jarvis o uno strumento di analisi.
   - Nessun FATAL e nessun «permission denied».
2. **Accessi:** nessun errore. Non ci sono righe nel periodo disponibile.
3. **Richieste al backend:** nessuna risposta 4xx/5xx su 8 righe.
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) ha risposto 401 per 5 volte: 2 alle 09:20 UTC e 3 alle 09:45 UTC. L'ultima è alle 09:45:23 UTC.
     - **Causa registrata:** `auth.no_bearer_token`, cioè la richiesta è arrivata senza credenziali di accesso.
     - Nei controlli precedenti queste risposte erano 400; oggi sono 401.
   - `GET pupillo.life/robots.txt` ha risposto 404 una volta, alle 08:50:49 UTC. Il file non esiste e non blocca niente.
   - Hanno risposto tutti 200:
     - il lavoro automatico `expire-stale`, ogni 15 minuti;
     - `jarvis-kpi` (09:45);
     - la homepage.
