# Errori nei registri (controllo del 21/10/2026, ore 08:19 UTC)

Solo elenco, nessuna modifica.

**Limite:** i registri non coprono le 24 ore. Database e richieste al backend: solo 08:15 UTC circa. Accessi: nessuna riga. Funzioni del sito: solo l'ultima ora circa.

1. **Database:** nessun ERROR, FATAL o «permission denied» (4 righe).
2. **Accessi:** nessun errore, nessuna riga nel periodo.
3. **Richieste al backend:** nessuna risposta 4xx/5xx (8 righe).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp`: 401 per 4 volte (2 alle 07:48 UTC, 2 alle 08:18 UTC; ultima 08:18:42 UTC). Causa registrata: `auth.no_bearer_token`, richiesta senza credenziali.
   - `GET pupillo.life/robots.txt`: 404 una volta, alle 07:43:46 UTC. File assente, non blocca niente.
   - Risposte 200: `expire-stale` ogni 15 minuti, `jarvis-kpi` (08:19), homepage.
