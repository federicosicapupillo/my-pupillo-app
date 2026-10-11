# Errori nei registri (controllo dell'11/10/2026, ore 18:25 UTC)

Ecco solo l'elenco. Non ho modificato niente.

**Limite:** i registri non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: ci sono registri solo dalle 18:25 UTC circa.
- Funzioni del sito: ci sono registri solo dalle 18:13 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato nessuna riga.
2. **Accessi:** nessuna risposta 4xx/5xx. Prova: 8 righe controllate, tutte con risposta 200.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 23 richieste controllate, tutte con risposta 200.
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) ha risposto 400 per 3 volte. L'ultima volta è stata alle 18:25:01 UTC.
     - **Causa:** i registri non la riportano.
     - **Ipotesi non confermata:** è il primo tentativo di collegamento. Subito dopo arrivano infatti risposte 200/202 con accesso verificato.
   - Hanno risposto tutte 200: `jarvis-kpi` (18:25:21) e la homepage (18:25:19).
