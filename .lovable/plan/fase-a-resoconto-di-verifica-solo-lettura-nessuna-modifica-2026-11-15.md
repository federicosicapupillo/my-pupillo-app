# Fase A — Resoconto di verifica (solo lettura, nessuna modifica)

## Cosa ho verificato davvero
- Il commit 328ac6539364fe947cc2f778b921a6a22f7aa221 esiste ed è l'ultimo commit attuale del progetto.
- Il codice contiene la cronologia delle migrazioni del database (cartella drizzle/migrations), quindi lo schema è ricostruibile dal codice.
- Non ho strumenti che leggano l'elenco dei backup del database, né lo stato del draft oltre a quanto hai indicato: questi punti restano NON verificati da me.

## 1) Copia indipendente del CODICE
Limiti:
- Il draft vive dentro lo stesso progetto Lovable: non è una copia indipendente. Se il progetto o l'account hanno problemi, il draft li condivide. Il draft ha un database di test proprio (struttura senza dati) oppure, se la creazione è fallita, usa quello reale: controlla nel pannello Draft quale dei due.
- La cronologia versioni permette di tornare a un punto precedente del codice, ma resta dentro Lovable e non riporta indietro dati, file o segreti.
Passi manuali indispensabili (li fai tu, io non posso):
1. Impostazioni progetto → Git → collega GitHub (crea un nuovo repository PRIVATO). Questo dà una copia esterna con tutta la cronologia.
2. In alternativa o in aggiunta: Impostazioni progetto → Git → «Download codebase» (piani a pagamento) e conserva lo ZIP offline.
3. Verifica: nel repository/ZIP deve esserci il commit 328ac65…; annota la data.
Rischio: basso. Prerequisito: ruolo owner/admin. Non rendere mai pubblico il repository.

## 2) Backup automatici del database
Cosa dice la documentazione di Lovable Cloud (non verificato da me sul tuo progetto):
- 1 backup automatico al giorno, conservati fino a circa 14 giorni, schema + dati.
- Nessun ripristino a un momento preciso: solo agli snapshot giornalieri.
- I file dello Storage NON sono inclusi.
Come verificare tu: More → Database → Manage → Backups. Leggi data/ora UTC dell'ultimo backup e quanti ne vedi. Non premere «Restore».

## 3) Backup completo e verificabile
- Database (schema, dati, policy RLS, ruoli, funzioni, utenti con password cifrate): More → Database → Manage → Settings → Export project data → Database → Export → Start export. Il file arriva per email e resta anche in More → Storage. Limiti: fino a 15 GB, 1 export ogni 24h, backend attivo. Impatto sulla produzione: è una lettura, ma fallo in un orario di poco traffico.
- File (avatar, curriculum, ecc.): NON sono nell'export; vanno scaricati da More → Storage, bucket per bucket. Contengono dati personali: conservali in un luogo privato e cifrato, mai con link pubblico.
- Non inclusi in nessun backup: segreti (es. JARVIS_KPI_KEY, chiavi email/Stripe), impostazioni di accesso Google, configurazione del dominio. Annotali tu (solo i NOMI e dove recuperare i valori, non i valori in chat).
- Prova di riuscita: file di export scaricato, dimensione non nulla, data annotata. Io non dichiaro riuscito nulla senza questa prova.
Rischio: basso. L'export lascia il file anche nello Storage del progetto: dopo averlo scaricato valuta di cancellarlo tu da lì.

## 4) Limiti di rollback e test isolati
- Codice: ripristinabile da cronologia/GitHub; ma riportare il codice indietro non riporta indietro il database, e codice vecchio con schema nuovo può rompersi.
- Database: il Restore riporta TUTTO il database allo snapshot, in modo permanente; si perde tutto ciò che è stato scritto dopo, e lo schema torna indietro. Nessun ripristino di singole tabelle. Pochi minuti di sito non disponibile.
- Storage: nessun rollback; un file cancellato è perso se non l'hai scaricato.
Test minimi in ambiente ISOLATO (un progetto separato di tua proprietà, mai la produzione):
1. Importa l'export in quel progetto separato.
2. Controlla conteggi tabelle principali (profili, annunci, turni, candidature, recensioni) rispetto alla produzione.
3. Verifica che RLS sia attiva e che un utente veda solo i propri dati.
4. Riconfigura accesso Google e chiavi, poi prova un login.
5. Carica alcuni file Storage scaricati e verifica che si aprano.
6. Avvia il codice del commit 328ac65 contro quella copia.

## Prossimi passi sicuri (tutti manuali, a cura tua)
1. Collega GitHub privato o scarica il codice.
2. Leggi e annota l'ultimo backup nella pagina Backups.
3. Esegui l'export del database e scarica lo Storage in luogo privato.
4. Elenca i nomi dei segreti e le configurazioni esterne.
5. Solo dopo, test di ripristino in un progetto isolato.
Nessuna azione verrà eseguita da me in questa fase.
