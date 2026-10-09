# Errori nei registri (controllo del 09/10/2026, ore 11:32 UTC)

Ecco solo l'elenco: non c'è nulla da modificare e non ho toccato niente.

**Limite:** non ci sono registri per tutte le 24 ore.
- Database, accessi e richieste al backend: registri solo dalle 11:22 UTC circa.
- Funzioni del sito: registri solo dalle 10:35 UTC circa.

Per le ore precedenti non c'è niente da controllare.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessuna risposta 4xx/5xx e nessun errore. Prova: controllate 10 righe.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: controllate 24 richieste.
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` → 400, 2 volte, l'ultima alle 11:31:41 UTC. La causa non compare nei registri. Subito dopo arrivano risposte 200 con accesso valido, quindi probabilmente è la prima chiamata di apertura del collegamento (non confermato).
   - `GET pupillo.life/robots.txt` → 404, 1 volta alle 10:35:18 UTC. La causa è che il sito non contiene un file `robots.txt` (il file usato dai motori di ricerca). Non blocca gli utenti.
   - Hanno risposto tutti 200: il lavoro automatico `expire-stale` (10:45, 11:00, 11:15, 11:30), `jarvis-kpi` (11:31:59) e la homepage.
