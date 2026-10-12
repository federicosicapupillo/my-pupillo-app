# Errori nei registri (controllo del 12/10/2026, ore 06:52 UTC)

Ecco solo l'elenco: non ho modificato niente.

**Limite:** i registri non coprono tutte le 24 ore.
- Database, accessi e richieste al backend: registri disponibili solo dalle 06:45 UTC circa.
- Funzioni del sito: registri disponibili solo dalle 06:00 UTC circa.

1. **Database:** nessun ERROR, FATAL o «permission denied». Prova: la ricerca non ha trovato righe.
2. **Accessi:** nessuna risposta 4xx/5xx. Prova: 4 righe, tutte con risposta 200.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 23 risposte 200 e 1 risposta 201 (notifica creata).
4. **Funzioni del sito pubblicato:**
   - `POST pupillo.life/mcp` (il collegamento con gli assistenti esterni) ha dato 400 per 2 volte. L'ultima volta è alle 06:51:10 UTC.
     - **Causa:** non è scritta nei registri.
     - **Ipotesi non confermata:** subito dopo arrivano risposte 200/202 con accesso valido, quindi è probabilmente il primo tentativo di collegamento.
   - Hanno risposto tutti 200:
     - il lavoro automatico che chiude gli annunci scaduti (06:00, 06:15, 06:30, 06:45);
     - `jarvis-kpi` (06:30, 06:51);
     - la homepage.
