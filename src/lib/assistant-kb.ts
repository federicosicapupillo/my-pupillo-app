export type AssistantCta = { label: string; to: string };
export type AssistantFaq = {
  id: string;
  question: string;
  answer: string;
  cta?: AssistantCta;
  // routes the FAQ is most relevant for (prefix match on pathname)
  contextPaths?: string[];
};

export const WORKER_FAQS: AssistantFaq[] = [
  {
    id: "w-profile-complete",
    question: "Come completo il mio profilo?",
    answer:
      "Vai nella pagina Profilo e compila i dati richiesti: foto, nome, ruoli, esperienza, città, lingue e documento d'identità. Un profilo completo aumenta le tue probabilità di essere contattato.",
    cta: { label: "Vai al profilo", to: "/profile" },
    contextPaths: ["/profile"],
  },
  {
    id: "w-photo",
    question: "Come carico la foto profilo?",
    answer:
      "Apri il Profilo e clicca sull'avatar in alto. Puoi scegliere un'immagine dal tuo dispositivo. Usa una foto chiara, frontale e professionale.",
    cta: { label: "Vai al profilo", to: "/profile" },
    contextPaths: ["/profile"],
  },
  {
    id: "w-availability",
    question: "Come imposto le mie disponibilità?",
    answer:
      "Vai nella pagina Disponibilità. Puoi indicare giorni, fasce orarie, città e zone in cui sei disponibile. Puoi anche aggiungere disponibilità speciali per date specifiche, ad esempio se nel weekend sei in un'altra città.",
    cta: { label: "Apri Disponibilità", to: "/availability" },
    contextPaths: ["/availability"],
  },
  {
    id: "w-zones",
    question: "Come imposto città e zone diverse?",
    answer:
      "In Disponibilità puoi scegliere città e quartieri/zone in cui lavorare. Puoi aggiungere più zone e impostare un raggio massimo dalla tua posizione.",
    cta: { label: "Apri Disponibilità", to: "/availability" },
    contextPaths: ["/availability"],
  },
  {
    id: "w-apply",
    question: "Come mi candido a un'offerta?",
    answer:
      "Vai su Trova offerte, apri un annuncio che ti interessa e clicca su Candidati. Il ristoratore riceverà la tua candidatura e potrai chattare con lui.",
    cta: { label: "Vai a Trova offerte", to: "/browse" },
    contextPaths: ["/browse", "/announcements"],
  },
  {
    id: "w-jobs",
    question: "Dove vedo le offerte ricevute?",
    answer:
      "Apri la pagina Offerte ricevute: trovi tutte le proposte dei ristoratori e puoi accettarle o rifiutarle.",
    cta: { label: "Vai a Offerte ricevute", to: "/jobs" },
    contextPaths: ["/jobs"],
  },
  {
    id: "w-accept-proposal",
    question: "Come accetto una proposta di lavoro?",
    answer:
      "Apri il messaggio in chat o la voce in Offerte ricevute: vedrai il riepilogo del turno (data, orario, tariffa). Clicca su Accetta. Dopo l'accettazione vedrai indirizzo completo e referente.",
    cta: { label: "Vai a Offerte ricevute", to: "/jobs" },
    contextPaths: ["/jobs", "/messages"],
  },
  {
    id: "w-locale-name",
    question: "Perché non vedo il nome del locale?",
    answer:
      "Per privacy, il nome reale del locale, l'indirizzo completo e il referente vengono mostrati solo dopo che il ristoratore ha confermato la candidatura o dopo che hai accettato una proposta di turno.",
  },
  {
    id: "w-address",
    question: "Dove trovo indirizzo e referente?",
    answer:
      "Dopo l'assegnazione del turno trovi indirizzo, persona di riferimento, telefono e note di accesso nella pagina del turno e nel messaggio in chat.",
    cta: { label: "Vai ai miei turni", to: "/shifts" },
  },
  {
    id: "w-confirm-read",
    question: "Come confermo di aver letto le istruzioni?",
    answer:
      "Nel messaggio della proposta o nella pagina del turno c'è un pulsante per confermare di aver letto le istruzioni. Conferma prima del servizio per rassicurare il ristoratore.",
    cta: { label: "Vai ai miei turni", to: "/shifts" },
  },
  {
    id: "w-reputation",
    question: "Come funziona la mia reputazione?",
    answer:
      "La reputazione si basa su puntualità, completamento dei turni, recensioni e percentuale di ristoratori che ti ricontatterebbero. Trovi i dettagli nel tuo profilo.",
    cta: { label: "Vai al profilo", to: "/profile" },
  },
  {
    id: "w-reviews",
    question: "Dove vedo le recensioni ricevute?",
    answer:
      "Le recensioni dei ristoratori per cui hai lavorato sono nel tuo profilo, nella sezione recensioni.",
    cta: { label: "Vai al profilo", to: "/profile" },
  },
  {
    id: "w-phone",
    question: "Come modifico il numero di telefono?",
    answer:
      "Apri il Profilo, modifica il numero e segui la verifica via codice. Il numero verrà mostrato solo ai ristoratori autorizzati.",
    cta: { label: "Vai al profilo", to: "/profile" },
  },
  {
    id: "w-whatsapp",
    question: "Come verifico WhatsApp?",
    answer:
      "Dopo aver inserito il numero, riceverai un codice OTP. Inseriscilo nella pagina di verifica per attivare le notifiche WhatsApp.",
    cta: { label: "Verifica telefono", to: "/verify-phone" },
  },
  {
    id: "w-notifications",
    question: "Perché non ricevo notifiche?",
    answer:
      "Controlla di aver verificato il numero e di aver autorizzato le notifiche del browser. Prova a ricaricare la pagina o a uscire e rientrare.",
  },
  {
    id: "w-page-broken",
    question: "Cosa faccio se una pagina non si apre?",
    answer:
      "Prova a ricaricare la pagina e a controllare la connessione. Se il problema persiste, torna alla Dashboard o invia una segnalazione al supporto da questa chat.",
    cta: { label: "Vai alla Dashboard", to: "/dashboard" },
  },
];

export const RESTAURANT_FAQS: AssistantFaq[] = [
  {
    id: "r-create",
    question: "Come creo un annuncio?",
    answer:
      "Vai su Crea annuncio dalla Dashboard o da I miei annunci. Compila ruolo, data, orario, tariffa, indirizzo, dress code e referente. Pubblica quando sei pronto.",
    cta: { label: "Crea annuncio", to: "/announcements/new" },
    contextPaths: ["/announcements/new", "/announcements"],
  },
  {
    id: "r-defaults",
    question: "Come salvo le impostazioni per i prossimi annunci?",
    answer:
      "Nel Profilo trovi la sezione Impostazioni predefinite: dress code, lingue richieste, referente e altri campi verranno precompilati nei prossimi annunci.",
    cta: { label: "Vai al profilo", to: "/profile" },
  },
  {
    id: "r-search-workers",
    question: "Come cerco lavoratori?",
    answer:
      "Apri Cerca lavoratori, filtra per ruolo, città, esperienza e disponibilità. Puoi anche usare la mappa per vedere chi è vicino a te.",
    cta: { label: "Vai a Cerca lavoratori", to: "/workers" },
    contextPaths: ["/workers"],
  },
  {
    id: "r-map",
    question: "Come uso la mappa lavoratori?",
    answer:
      "Apri Mappa: vedrai i lavoratori disponibili nella tua area, con indicatore di disponibilità in base al giorno e all'orario.",
    cta: { label: "Vai alla mappa", to: "/mappa" },
    contextPaths: ["/mappa"],
  },
  {
    id: "r-propose",
    question: "Come propongo un turno a un lavoratore?",
    answer:
      "Vai su Cerca lavoratori, scegli un profilo e clicca su Chatta o Proponi turno. Prima dell'invio vedrai un riepilogo. Il lavoratore riceverà la proposta in chat e potrà accettare o rifiutare.",
    cta: { label: "Vai a Cerca lavoratori", to: "/workers" },
  },
  {
    id: "r-manage-application",
    question: "Come gestisco una candidatura ricevuta?",
    answer:
      "Apri I miei annunci, entra nell'annuncio e vedi le candidature ricevute. Da lì puoi chattare, accettare o rifiutare.",
    cta: { label: "Vai a I miei annunci", to: "/announcements" },
  },
  {
    id: "r-accept",
    question: "Come accetto una candidatura?",
    answer:
      "Nella scheda candidatura clicca Accetta: il lavoratore riceverà la conferma e vedrà i dati completi del locale.",
    cta: { label: "Vai a I miei annunci", to: "/announcements" },
  },
  {
    id: "r-reject",
    question: "Come rifiuto una candidatura?",
    answer:
      "Clicca Rifiuta nella scheda candidatura. Il lavoratore verrà avvisato in modo educato.",
  },
  {
    id: "r-chat",
    question: "Come chatto con un lavoratore?",
    answer:
      "Apri Messaggi o entra in una candidatura/proposta: trovi la chat dedicata. Le risposte rapide sono già pronte per le situazioni più comuni.",
    cta: { label: "Vai ai Messaggi", to: "/messages" },
    contextPaths: ["/messages"],
  },
  {
    id: "r-favorites-view",
    question: "Dove vedo i lavoratori preferiti?",
    answer:
      "Apri la sezione Collaboratori dal menu: trovi i lavoratori che hai salvato come preferiti.",
    cta: { label: "Vai a Collaboratori", to: "/ristoratore/collaboratori" },
  },
  {
    id: "r-favorites-add",
    question: "Come salvo un lavoratore nei preferiti?",
    answer:
      "Apri il profilo del lavoratore (da Cerca lavoratori o dalla mappa) e clicca sul cuore/preferiti.",
  },
  {
    id: "r-credits",
    question: "Come funzionano i crediti?",
    answer:
      "I crediti servono per pubblicare annunci e proporre turni. Ogni azione consuma una quantità definita; trovi il saldo in alto e la cronologia in Crediti.",
    cta: { label: "Vai ai Crediti", to: "/billing" },
    contextPaths: ["/billing"],
  },
  {
    id: "r-credits-when",
    question: "Quando vengono scalati i crediti?",
    answer:
      "I crediti vengono scalati al momento della pubblicazione di un annuncio o di una proposta vincolante. Trovi il dettaglio nella cronologia transazioni.",
    cta: { label: "Vai ai Crediti", to: "/billing" },
  },
  {
    id: "r-credits-topup",
    question: "Come ricarico i crediti?",
    answer:
      "Vai in Crediti e scegli un pacchetto. Il pagamento avviene in modo sicuro e i crediti sono disponibili subito dopo la conferma.",
    cta: { label: "Vai ai Crediti", to: "/billing" },
  },
  {
    id: "r-close-shift",
    question: "Come chiudo un turno?",
    answer:
      "Apri I miei turni, entra nel turno e clicca Chiudi turno al termine del servizio. Potrai poi lasciare una recensione al lavoratore.",
    cta: { label: "Vai a I miei turni", to: "/shifts" },
    contextPaths: ["/shifts"],
  },
  {
    id: "r-review",
    question: "Come recensisco un lavoratore?",
    answer:
      "Dopo la chiusura del turno trovi il box di recensione: assegna le stelle per puntualità, professionalità, competenza, affidabilità e collaborazione, indica se lo richiameresti e aggiungi un commento.",
    cta: { label: "Vai a I miei turni", to: "/shifts" },
  },
  {
    id: "r-name-privacy",
    question: "Perché non vedo nome e cognome completo?",
    answer:
      "Per privacy, il cognome del lavoratore è mostrato solo dopo l'assegnazione di un turno. È una protezione standard prevista dalla piattaforma.",
  },
  {
    id: "r-data-privacy",
    question: "Perché non vedo alcuni dati del lavoratore?",
    answer:
      "Telefono, email e documento sono dati sensibili: vengono mostrati solo quando autorizzati e dopo l'accettazione del turno.",
  },
  {
    id: "r-backup",
    question: "Come faccio il backup da Admin?",
    answer:
      "Solo gli amministratori possono lanciare backup. Nella sezione Admin trovi la scheda Backup con i comandi.",
    cta: { label: "Vai ad Admin", to: "/admin" },
  },
];

export const ERROR_FAQS: AssistantFaq[] = [
  { id: "e-page", question: "La pagina non si carica", answer: "Ricarica la pagina, controlla la connessione e prova a tornare alla Dashboard. Se persiste, invia una segnalazione." , cta: { label: "Vai alla Dashboard", to: "/dashboard" } },
  { id: "e-msg", question: "Non ricevo il messaggio", answer: "Apri i Messaggi e ricarica. Controlla anche le notifiche e l'autorizzazione del browser.", cta: { label: "Vai ai Messaggi", to: "/messages" } },
  { id: "e-notif", question: "Non vedo la notifica", answer: "Verifica di aver autorizzato le notifiche e di aver verificato il numero. Riavvia il browser se serve." },
  { id: "e-photos", question: "Non vedo le foto profilo", answer: "Ricarica la pagina e controlla la connessione. Se il problema persiste, segnalalo." },
  { id: "e-phone", question: "Non riesco a verificare il telefono", answer: "Controlla il prefisso e il numero, attendi qualche secondo e richiedi un nuovo codice.", cta: { label: "Verifica telefono", to: "/verify-phone" } },
  { id: "e-accept", question: "Non riesco ad accettare una proposta", answer: "Apri la proposta dalla chat o da Offerte ricevute e riprova. Se non funziona, ricarica la pagina." , cta: { label: "Vai a Offerte ricevute", to: "/jobs" } },
  { id: "e-close", question: "Non riesco a chiudere un turno", answer: "Apri il turno da I miei turni e riprova. Se vedi un errore, segnalalo al supporto.", cta: { label: "Vai a I miei turni", to: "/shifts" } },
  { id: "e-map", question: "La mappa non mostra i profili", answer: "Concedi i permessi di posizione, ricarica la pagina e verifica i filtri attivi.", cta: { label: "Vai alla mappa", to: "/mappa" } },
  { id: "e-chat", question: "La chat non si aggiorna", answer: "Ricarica la conversazione o chiudi e riapri la pagina Messaggi.", cta: { label: "Vai ai Messaggi", to: "/messages" } },
];

export const TICKET_CATEGORIES = [
  "Login / verifica telefono",
  "Profilo",
  "Disponibilità",
  "Offerte",
  "Chat",
  "Mappa",
  "Candidature",
  "Turni",
  "Recensioni",
  "Crediti",
  "Altro",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export function getFaqsForRole(role: string | null | undefined): AssistantFaq[] {
  if (role === "restaurant") return RESTAURANT_FAQS;
  if (role === "worker") return WORKER_FAQS;
  return [...WORKER_FAQS, ...RESTAURANT_FAQS];
}

export function getContextualFaqs(
  pathname: string,
  role: string | null | undefined,
): AssistantFaq[] {
  const base = getFaqsForRole(role);
  const path = pathname || "/";
  const matchScore = (faq: AssistantFaq) => {
    if (!faq.contextPaths || faq.contextPaths.length === 0) return 0;
    return faq.contextPaths.some((p) => path.startsWith(p)) ? 1 : 0;
  };
  return [...base].sort((a, b) => matchScore(b) - matchScore(a));
}

export function welcomeMessage(role: string | null | undefined): string {
  if (role === "restaurant") {
    return "Ciao! Sono l'assistente di Pupillo. Posso aiutarti a creare annunci, cercare lavoratori, gestire candidature, proporre turni o usare i crediti.";
  }
  if (role === "worker") {
    return "Ciao! Sono l'assistente di Pupillo. Posso aiutarti a completare il profilo, impostare le disponibilità, candidarti ai turni o gestire le offerte ricevute.";
  }
  return "Ciao! Sono l'assistente di Pupillo. Dimmi come posso aiutarti.";
}

export const KB_SYSTEM_PROMPT = `Sei l'assistente in-app di Pupillo, una piattaforma italiana che mette in contatto ristoranti/bar e lavoratori extra della ristorazione.

Regole assolute:
- Rispondi sempre in italiano, in modo breve (max 4-5 righe), pratico e amichevole.
- NON inventare mai dati personali, turni, crediti, indirizzi, telefoni, recensioni, nomi reali o saldi.
- Privacy: non rivelare nome reale del locale, indirizzo completo, cognome del lavoratore, telefono o email prima dell'accettazione/assegnazione del turno.
- Se non sai rispondere o serve verificare dati reali, scrivi esattamente: "Non riesco a verificarlo automaticamente. Puoi inviare una segnalazione al supporto."
- Quando una pagina dell'app è pertinente, suggerisci di aprirla citando l'etichetta (es. "Apri Disponibilità", "Vai a Cerca lavoratori").

Rotte disponibili (usa solo queste etichette):
- Dashboard (/dashboard)
- Profilo (/profile)
- Disponibilità (/availability) — solo lavoratori
- Trova offerte (/browse) — solo lavoratori
- Offerte ricevute (/jobs) — solo lavoratori
- I miei annunci (/announcements) — solo ristoratori
- Crea annuncio (/announcements/new) — solo ristoratori
- Cerca lavoratori (/workers) — solo ristoratori
- Collaboratori (/ristoratore/collaboratori) — solo ristoratori
- Mappa (/mappa)
- Messaggi (/messages)
- I miei turni (/shifts)
- Crediti (/billing) — solo ristoratori
- Verifica telefono (/verify-phone)

Tono: semplice, chiaro, motivazionale, pratico, non tecnico, giovane ma professionale. Niente liste lunghe.`;

export function ctaForRoute(to: string): AssistantCta | undefined {
  const map: Record<string, string> = {
    "/dashboard": "Vai alla Dashboard",
    "/profile": "Vai al profilo",
    "/availability": "Apri Disponibilità",
    "/browse": "Vai a Trova offerte",
    "/jobs": "Vai a Offerte ricevute",
    "/announcements": "Vai a I miei annunci",
    "/announcements/new": "Crea annuncio",
    "/workers": "Vai a Cerca lavoratori",
    "/ristoratore/collaboratori": "Vai a Collaboratori",
    "/mappa": "Vai alla mappa",
    "/messages": "Vai ai Messaggi",
    "/shifts": "Vai ai miei turni",
    "/billing": "Vai ai Crediti",
    "/verify-phone": "Verifica telefono",
  };
  const label = map[to];
  return label ? { label, to } : undefined;
}