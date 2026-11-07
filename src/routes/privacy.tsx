import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead("/privacy", "Informativa privacy — Pupillo", "Informativa sul trattamento dei dati personali degli utenti Pupillo ai sensi del GDPR."),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Informativa privacy">
      <p>Informativa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 («GDPR») per gli utenti della piattaforma Pupillo.</p>
      <section>
        <h2>1. Titolare del trattamento</h2>
        <p>AD MAIORA S.R.L. Non è stato designato un responsabile della protezione dei dati (DPO).</p>
      </section>
      <section>
        <h2>2. Dati trattati</h2>
        <ul>
          <li>Dati anagrafici e di account: nome, cognome, email, ruolo, password (conservata in forma cifrata), data e luogo di nascita e residenza se richiesti nel profilo lavoratore.</li>
          <li>Contatti: numero di telefono e relativo codice di verifica.</li>
          <li>Dati del locale: ragione sociale, partita IVA, indirizzo, referente.</li>
          <li>Dati professionali: mansioni, esperienze, lingue, disponibilità, curriculum facoltativo e relativa valutazione.</li>
          <li>Documento di identità e foto profilo, se caricati.</li>
          <li>Annunci, candidature, controfferte, turni, presenze e mancate presentazioni.</li>
          <li>Messaggi scambiati in piattaforma, recensioni e punteggi di reputazione, segnalazioni.</li>
          <li>Dati di posizione: indirizzo del locale e zona di lavoro; la posizione attuale del dispositivo solo se l'utente usa la funzione «usa la mia posizione». Agli altri utenti le posizioni sono mostrate in forma approssimata.</li>
          <li>Dati tecnici: indirizzo IP, dati del browser e registri di sicurezza e accesso.</li>
        </ul>
      </section>
      <section>
        <h2>3. Finalità e basi giuridiche</h2>
        <ul>
          <li>Registrazione, gestione dell'account e funzioni della piattaforma (annunci, candidature, messaggi, turni, recensioni, reputazione): esecuzione del contratto (art. 6.1.b).</li>
          <li>Verifica del telefono, sicurezza, prevenzione di abusi e frodi, moderazione: legittimo interesse (art. 6.1.f) e, ove applicabile, esecuzione del contratto.</li>
          <li>Valutazione automatica del curriculum e sua pubblicazione: consenso dell'interessato (art. 6.1.a), revocabile caricando un nuovo documento senza consenso o cancellando il curriculum, o scrivendo alla PEC. <em>La qualificazione giuridica di questo trattamento è in corso di verifica da parte del titolare.</em></li>
          <li>Adempimento di obblighi di legge e difesa in giudizio: art. 6.1.c e 6.1.f.</li>
        </ul>
        <p>Non utilizziamo i dati per finalità di marketing né li vendiamo a terzi.</p>
      </section>
      <section>
        <h2>4. Visibilità dei profili</h2>
        <p>I Ristoratori registrati possono vedere dei Lavoratori: nome, foto, mansioni, esperienze, lingue, disponibilità, zona approssimata, recensioni, livello di reputazione e la valutazione del curriculum solo se pubblicabile e con consenso. I Lavoratori vedono dei Ristoratori i dati del locale e degli annunci. Documento d'identità, curriculum originale e posizione precisa non sono mostrati agli altri utenti; i recapiti diretti possono essere resi disponibili tra le parti solo nell'ambito di un turno, ove previsto dalle funzioni della piattaforma.</p>
      </section>
      <section>
        <h2>5. Analisi del curriculum con intelligenza artificiale</h2>
        <p>Se l'utente acconsente, il testo del curriculum viene inviato a un modello di intelligenza artificiale, tramite il servizio AI di Lovable, che attribuisce punteggi secondo criteri predefiniti. Il risultato è indicativo, non produce effetti giuridici e non determina da solo l'accesso alla piattaforma o a un lavoro. L'interessato può esprimere la propria opinione, contestare il risultato e chiedere una revisione da parte di una persona scrivendo alla PEC.</p>
      </section>
      <section>
        <h2>6. Destinatari e responsabili</h2>
        <p>I dati sono trattati da personale autorizzato e da fornitori che agiscono come responsabili del trattamento, tra cui: Lovable (hosting dell'applicazione, database, autenticazione, invio email e servizi AI), Twilio (invio SMS di verifica), OpenStreetMap/Nominatim e CARTO (ricerca indirizzi e mappe). I dati possono essere comunicati ad autorità quando richiesto dalla legge.</p>
      </section>
      <section>
        <h2>7. Trasferimenti fuori dallo SEE</h2>
        <p>Alcuni fornitori possono trattare dati al di fuori dello Spazio Economico Europeo. In tal caso il trasferimento avviene sulla base delle garanzie previste dagli artt. 45-46 GDPR (decisioni di adeguatezza o clausole contrattuali standard). Su richiesta alla PEC è possibile ottenere informazioni sulle garanzie adottate.</p>
      </section>
      <section>
        <h2>8. Conservazione</h2>
        <p>I dati dell'account sono conservati finché l'account è attivo. Alla cancellazione dell'account i dati sono cancellati o resi anonimi, salvo quelli da conservare per obblighi di legge, sicurezza o difesa in giudizio, per il tempo strettamente necessario. Il curriculum sostituito o rimosso non è più usato per nuove valutazioni.</p>
      </section>
      <section>
        <h2>9. Natura del conferimento</h2>
        <p>I dati richiesti per registrazione e profilo sono necessari per usare la piattaforma; senza di essi non è possibile fornire il servizio. Curriculum, foto e posizione del dispositivo sono facoltativi.</p>
      </section>
      <section>
        <h2>10. Diritti dell'interessato</h2>
        <p>Ai sensi degli artt. 15-22 GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti ai trattamenti basati su legittimo interesse; puoi revocare il consenso in ogni momento senza pregiudicare la liceità del trattamento precedente. Scrivi alla PEC {COMPANY.pec}. Puoi proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>
      </section>
      <section>
        <h2>11. Sicurezza</h2>
        <p>Adottiamo misure tecniche e organizzative ragionevoli, tra cui accessi controllati per utente, archiviazione privata di documenti e curriculum, connessioni cifrate. Nessun sistema è esente da rischi.</p>
      </section>
      <section>
        <h2>12. Cookie e modifiche</h2>
        <p>Sull'uso di cookie e tecnologie simili vedi la <Link to="/cookie">Cookie policy</Link>. Questa informativa può essere aggiornata; la versione vigente è sempre pubblicata in questa pagina.</p>
      </section>
    </LegalPage>
  );
}
