# Errori nei registri (controllo dell'08/10/2026, ore 11:26 UTC)

Solo un elenco: non c'è nessuna modifica da fare. Non ho toccato niente.

**Limite:** i registri coprono solo dalle 11:16 alle 11:26 UTC circa, non le 24 ore richieste. Per le ore precedenti non ci sono righe da controllare.

1. **Database:** nessun ERROR, nessun FATAL, nessun «permission denied». Prova: la ricerca non ha restituito righe.
2. **Accessi:** nessuna risposta 4xx/5xx e nessun errore. Prova: 18 righe controllate.
3. **Richieste al backend:** nessuna risposta 4xx/5xx. Prova: 34 richieste controllate.
4. **Funzioni del sito pubblicato:** un solo tipo di errore.
   - **Cosa:** `POST pupillo.life/mcp` ha risposto 400.
   - **Quante volte:** 2, alle 11:17:02 e alle 11:24:59 UTC.
   - **Causa:** non è scritta nei registri. Ogni 400 arriva subito prima di una serie di risposte 200 con accesso valido. È probabile, ma non confermato, che sia la prima chiamata con cui si apre il collegamento.
   - **Altre risposte:** `jarvis-kpi` alle 11:25:26 e la homepage hanno risposto 200.
5. **Anteprima (non il sito pubblicato):** alle 11:26 il server di anteprima si è riavviato da solo (codice 143, cioè arresto richiesto) ed è ripartito subito. Non è un errore dell'app.
