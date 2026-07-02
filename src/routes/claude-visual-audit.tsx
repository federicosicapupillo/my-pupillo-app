import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/claude-visual-audit")({
  head: () => ({
    meta: [
      { title: "Pupillo — Visual Audit Pack per Claude" },
      { name: "description", content: "Galleria visiva delle schermate principali di Pupillo, con dati mock, per audit UX/UI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClaudeVisualAuditPage,
});

/* ============================================================
 * MOCK DATA (dati fittizi realistici — non toccare)
 * ============================================================ */
const MOCK = {
  worker: { name: "Marco Rossi", initials: "MR", city: "Milano", role: "Cameriere", rating: 4.8, reviews: 27 },
  restaurant: { name: "Osteria Milano Centro", zone: "Duomo, Milano", type: "Osteria" },
  shift: { title: "Cameriere — Servizio serale", when: "24/12/2026 19:00 – 23:00", rate: "12 €/ora", total: "48 €" },
};

/* ============================================================
 * PRIMITIVES
 * ============================================================ */
function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mx-auto" style={{ width: 300 }}>
      <div
        className="relative rounded-[36px] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl overflow-hidden"
        style={{ width: 300, height: 620 }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-neutral-900 rounded-b-2xl z-10" />
        <div className="w-full h-full bg-white text-neutral-900 overflow-hidden">
          <div className="h-6 flex items-center justify-between px-4 text-[10px] text-neutral-500 bg-white border-b border-neutral-100">
            <span>9:41</span>
            <span>Pupillo</span>
            <span>100%</span>
          </div>
          <div className="p-3 text-[11px] leading-tight h-[calc(100%-24px)] overflow-hidden">{children}</div>
        </div>
      </div>
      {label ? <div className="text-center text-xs text-neutral-500 mt-2">{label}</div> : null}
    </div>
  );
}

function DesktopFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mx-auto" style={{ width: 640 }}>
      <div className="rounded-t-lg border border-neutral-300 bg-neutral-100 h-6 flex items-center gap-1 px-2">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div className="border-x border-b border-neutral-300 bg-white p-4 text-xs" style={{ minHeight: 360 }}>
        {children}
      </div>
      {label ? <div className="text-center text-xs text-neutral-500 mt-2">{label}</div> : null}
    </div>
  );
}

function Card({
  title,
  role,
  route,
  goal,
  actions,
  state,
  issues,
  claude,
  children,
}: {
  title: string;
  role: "Pubblico" | "Lavoratore" | "Ristoratore" | "Sistema" | "Entrambi";
  route: string;
  goal: string;
  actions: string;
  state: string;
  issues?: string;
  claude: string;
  children: ReactNode;
}) {
  return (
    <article className="audit-card break-inside-avoid rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3">
          <span><b>Ruolo:</b> {role}</span>
          <span><b>Route:</b> <code>{route}</code></span>
          <span><b>Stato:</b> {state}</span>
        </div>
      </header>
      <div className="mb-3">{children}</div>
      <dl className="text-[11px] text-neutral-700 space-y-1">
        <div><b>Obiettivo:</b> {goal}</div>
        <div><b>Azioni principali:</b> {actions}</div>
        {issues ? <div className="text-amber-700"><b>Criticità:</b> {issues}</div> : null}
        <div className="text-neutral-500"><b>Da far valutare a Claude:</b> {claude}</div>
      </dl>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="audit-section mt-10">
      <h2 className="text-xl font-bold border-b border-neutral-300 pb-2 mb-6">{title}</h2>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/* ============================================================
 * MOCK SCREEN CONTENTS (JSX puro, no dipendenze runtime)
 * ============================================================ */
const Btn = ({ children, primary = false }: { children: ReactNode; primary?: boolean }) => (
  <button
    className={`w-full rounded-lg px-3 py-2 text-[11px] font-semibold ${
      primary ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-900 border border-neutral-200"
    }`}
  >
    {children}
  </button>
);

const Chip = ({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) => {
  const map = {
    gray: "bg-neutral-100 text-neutral-700",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  }[tone];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${map}`}>{children}</span>;
};

const TopBar = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between mb-3">
    <span className="text-[13px] font-bold">{title}</span>
    <span className="w-6 h-6 rounded-full bg-neutral-200" />
  </div>
);

const BottomNav = () => (
  <div className="mt-3 pt-2 border-t border-neutral-200 flex justify-around text-[9px] text-neutral-500">
    <span>Home</span><span>Offerte</span><span>Turni</span><span>Chat</span><span>Profilo</span>
  </div>
);

/* Public screens */
const HomeMock = () => (
  <div>
    <div className="text-center py-3">
      <div className="text-lg font-bold text-orange-500">Pupillo</div>
      <div className="text-[10px] text-neutral-500">Lavoro Ho.Re.Ca. senza intermediari</div>
    </div>
    <div className="h-20 rounded-lg bg-orange-100 mb-3 grid place-items-center text-[11px] text-orange-800">
      Trova personale o turni in 24h
    </div>
    <div className="space-y-2">
      <Btn primary>Sono un Lavoratore</Btn>
      <Btn>Sono un Ristoratore</Btn>
    </div>
    <div className="mt-3 text-[10px] text-neutral-500 text-center">Come funziona · Chi siamo · Login</div>
  </div>
);

const AuthMock = () => (
  <div>
    <TopBar title="Accedi" />
    <div className="flex text-[11px] border-b border-neutral-200 mb-3">
      <div className="flex-1 pb-2 border-b-2 border-orange-500 font-semibold text-orange-600 text-center">Login</div>
      <div className="flex-1 pb-2 text-neutral-500 text-center">Registrati</div>
    </div>
    <div className="space-y-2">
      <div className="border border-neutral-200 rounded-md px-2 py-2 text-[11px] text-neutral-400">marco@email.it</div>
      <div className="border border-neutral-200 rounded-md px-2 py-2 text-[11px] text-neutral-400">••••••••</div>
      <div className="text-[10px] text-neutral-500 text-right">Password dimenticata?</div>
      <Btn primary>Accedi</Btn>
      <Btn>Continua con Google</Btn>
    </div>
  </div>
);

const RegisterMock = () => (
  <div>
    <TopBar title="Registrati" />
    <div className="text-[11px] mb-2">Scegli chi sei:</div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="border-2 border-orange-500 rounded-lg p-2 text-center text-[11px] font-semibold text-orange-600">Lavoratore</div>
      <div className="border border-neutral-200 rounded-lg p-2 text-center text-[11px] text-neutral-600">Ristoratore</div>
    </div>
    <div className="space-y-2">
      <div className="border border-neutral-200 rounded-md px-2 py-2 text-[11px] text-neutral-400">Email</div>
      <div className="border border-neutral-200 rounded-md px-2 py-2 text-[11px] text-neutral-400">Password</div>
      <Btn primary>Crea account</Btn>
    </div>
  </div>
);

const ResetMock = () => (
  <div>
    <TopBar title="Recupera password" />
    <p className="text-[11px] text-neutral-600 mb-3">Inserisci l'email e ti invieremo un link per reimpostare la password.</p>
    <div className="border border-neutral-200 rounded-md px-2 py-2 text-[11px] text-neutral-400 mb-3">marco@email.it</div>
    <Btn primary>Invia link</Btn>
  </div>
);

const LoginErrorMock = () => (
  <div>
    <TopBar title="Accedi" />
    <div className="border border-red-300 bg-red-50 text-red-700 rounded-md p-2 text-[11px] mb-3">
      Email o password non corretti. Riprova.
    </div>
    <div className="space-y-2">
      <div className="border border-red-300 rounded-md px-2 py-2 text-[11px]">marco@email.it</div>
      <div className="border border-red-300 rounded-md px-2 py-2 text-[11px]">••••••</div>
      <Btn primary>Riprova</Btn>
    </div>
  </div>
);

const ForbiddenMock = () => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4">
    <div className="w-14 h-14 rounded-full bg-red-100 grid place-items-center text-red-600 text-xl">⛔</div>
    <div className="font-semibold mt-2">Accesso negato</div>
    <div className="text-[11px] text-neutral-500 mt-1">Questa area è riservata a un altro ruolo utente.</div>
    <div className="mt-3 w-full"><Btn primary>Torna alla home</Btn></div>
  </div>
);

const ComeFunzionaMock = () => (
  <div>
    <TopBar title="Come funziona" />
    <ol className="space-y-2 text-[11px]">
      <li className="border border-neutral-200 rounded p-2"><b>1.</b> Crea il profilo e verifica il telefono.</li>
      <li className="border border-neutral-200 rounded p-2"><b>2.</b> Cerca offerte o pubblica annunci.</li>
      <li className="border border-neutral-200 rounded p-2"><b>3.</b> Chatta, conferma il turno e lascia la recensione.</li>
    </ol>
  </div>
);

/* Worker screens */
const WorkerDashMock = () => (
  <div>
    <TopBar title="Ciao Marco 👋" />
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[10px] text-amber-800 mb-2">
      Profilo 80% completo — completa per candidarti
    </div>
    <div className="text-[11px] font-semibold mb-1">Prossimo turno</div>
    <div className="rounded-lg border border-neutral-200 p-2 mb-2">
      <div className="text-[11px] font-semibold">{MOCK.shift.title}</div>
      <div className="text-[10px] text-neutral-500">{MOCK.shift.when}</div>
      <div className="text-[10px]"><Chip tone="green">Confermato</Chip> · {MOCK.shift.rate}</div>
    </div>
    <div className="text-[11px] font-semibold mb-1">Offerte per te</div>
    <div className="rounded-lg border border-neutral-200 p-2">
      <div className="text-[11px]">Ristorante · Milano centro</div>
      <div className="text-[10px] text-neutral-500">Sab 20:00 – 24:00 · 13 €/ora</div>
    </div>
    <BottomNav />
  </div>
);

const WorkerDashEmptyMock = () => (
  <div>
    <TopBar title="Ciao Marco 👋" />
    <div className="h-40 grid place-items-center text-center text-neutral-500 text-[11px]">
      <div>
        <div className="text-3xl mb-1">🍽️</div>
        Nessun turno in programma.<br />Trova un'offerta qui sotto.
      </div>
    </div>
    <Btn primary>Cerca offerte</Btn>
    <BottomNav />
  </div>
);

const WorkerProfileMock = () => (
  <div>
    <TopBar title="Il mio profilo" />
    <div className="flex items-center gap-2 mb-3">
      <div className="w-12 h-12 rounded-full bg-orange-200 grid place-items-center font-bold text-orange-700">MR</div>
      <div>
        <div className="font-semibold text-[12px]">{MOCK.worker.name}</div>
        <div className="text-[10px] text-neutral-500">Cameriere · Milano · ⭐ 4.8 (27)</div>
      </div>
    </div>
    <div className="space-y-1 text-[11px]">
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Ruoli</span><span className="text-neutral-500">Cameriere, Barista</span></div>
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Lingue</span><span className="text-neutral-500">IT, EN</span></div>
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Documento</span><Chip tone="green">Verificato</Chip></div>
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Zone</span><span className="text-neutral-500">Milano centro, Navigli</span></div>
    </div>
    <div className="mt-3"><Btn>Modifica profilo</Btn></div>
  </div>
);

const WorkerEditProfileMock = () => (
  <div>
    <TopBar title="Modifica profilo" />
    <div className="space-y-2 text-[11px]">
      <div>Nome<div className="border border-neutral-200 rounded px-2 py-1">Marco</div></div>
      <div>Cognome<div className="border border-neutral-200 rounded px-2 py-1">Rossi</div></div>
      <div>Città<div className="border border-neutral-200 rounded px-2 py-1">Milano</div></div>
      <div>Ruoli<div className="border border-neutral-200 rounded px-2 py-1">Cameriere, Barista</div></div>
    </div>
    <div className="mt-3"><Btn primary>Salva</Btn></div>
  </div>
);

const AvailabilityMock = () => (
  <div>
    <TopBar title="Disponibilità" />
    <div className="text-[11px] mb-2 font-semibold">Settimanale</div>
    <div className="grid grid-cols-7 gap-1 text-[9px] text-center mb-3">
      {["L","M","M","G","V","S","D"].map((d, i) => (
        <div key={i} className={`rounded py-1 ${i > 3 ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-500"}`}>{d}</div>
      ))}
    </div>
    <div className="text-[11px] mb-2 font-semibold">Fascia oraria</div>
    <div className="grid grid-cols-3 gap-1 text-[10px] text-center mb-3">
      <div className="rounded bg-neutral-100 py-1">Mattina</div>
      <div className="rounded bg-orange-100 text-orange-700 py-1">Pranzo</div>
      <div className="rounded bg-orange-500 text-white py-1">Sera</div>
    </div>
    <div className="text-[11px] font-semibold">Eccezioni</div>
    <div className="text-[10px] text-neutral-500">25/12/2026 — Non disponibile</div>
  </div>
);

const AvailabilitySpecialMock = () => (
  <div>
    <TopBar title="Disponibilità speciali" />
    <p className="text-[11px] text-neutral-600 mb-2">Aggiungi giorni singoli in cui sei disponibile o non disponibile.</p>
    <div className="space-y-2">
      <div className="rounded border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between"><span>Sab 27/12/2026</span><Chip tone="green">Disponibile</Chip></div>
        <div className="text-[10px] text-neutral-500">18:00 – 24:00</div>
      </div>
      <div className="rounded border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between"><span>Dom 04/01/2027</span><Chip tone="red">Occupato</Chip></div>
      </div>
    </div>
    <div className="mt-3"><Btn primary>+ Aggiungi giorno</Btn></div>
  </div>
);

const BrowseMock = () => (
  <div>
    <TopBar title="Offerte" />
    <div className="flex gap-1 mb-2 text-[10px]">
      <Chip tone="blue">Milano</Chip><Chip>Cameriere</Chip><Chip>Sera</Chip>
    </div>
    {[1,2,3].map((n) => (
      <div key={n} className="rounded-lg border border-neutral-200 p-2 mb-2">
        <div className="flex justify-between text-[11px] font-semibold">
          <span>Ristorante · Milano</span><span className="text-orange-600">13 €/ora</span>
        </div>
        <div className="text-[10px] text-neutral-500">Sab 20:00 – 24:00 · Cameriere</div>
        <div className="text-[10px]"><Chip tone="gray">Nome locale visibile dopo conferma</Chip></div>
      </div>
    ))}
    <BottomNav />
  </div>
);

const AnnouncementDetailMock = () => (
  <div>
    <TopBar title="Dettaglio offerta" />
    <div className="text-[13px] font-semibold">Cameriere — Servizio serale</div>
    <div className="text-[10px] text-neutral-500 mb-2">Milano centro · 24/12/2026 · 19:00 – 23:00</div>
    <div className="flex gap-1 mb-2"><Chip tone="green">Aperto</Chip><Chip>2 posti</Chip></div>
    <div className="text-[11px] mb-2">Tariffa: <b>12 €/ora</b> · Stima: <b>48 €</b></div>
    <div className="h-20 rounded bg-neutral-100 mb-2 grid place-items-center text-[10px] text-neutral-500">Area approssimata</div>
    <div className="text-[10px] text-neutral-600 mb-3">Locale ricercato · richiesta esperienza sala</div>
    <Btn primary>Candidati</Btn>
  </div>
);

const AppliedMock = () => (
  <div>
    <TopBar title="Dettaglio offerta" />
    <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-[11px] text-green-800 mb-3">
      ✅ Candidatura inviata! Riceverai una notifica alla risposta.
    </div>
    <div className="text-[13px] font-semibold">Cameriere — Servizio serale</div>
    <div className="text-[10px] text-neutral-500 mb-2">Milano · 24/12/2026 · 19:00 – 23:00</div>
    <Chip tone="amber">In attesa di risposta</Chip>
    <div className="mt-3"><Btn>Annulla candidatura</Btn></div>
  </div>
);

const JobsMock = ({ tab }: { tab: "ricevute" | "accettate" | "rifiutate" }) => (
  <div>
    <TopBar title="Offerte ricevute" />
    <div className="flex text-[10px] mb-2 border-b border-neutral-200">
      <div className={`flex-1 pb-1 text-center ${tab === "ricevute" ? "border-b-2 border-orange-500 font-semibold" : "text-neutral-500"}`}>Ricevute</div>
      <div className={`flex-1 pb-1 text-center ${tab === "accettate" ? "border-b-2 border-orange-500 font-semibold" : "text-neutral-500"}`}>Accettate</div>
      <div className={`flex-1 pb-1 text-center ${tab === "rifiutate" ? "border-b-2 border-orange-500 font-semibold" : "text-neutral-500"}`}>Rifiutate</div>
    </div>
    {tab === "rifiutate" ? (
      <div className="rounded-lg border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between"><span>Cameriere · Milano</span><Chip tone="red">Rifiutata</Chip></div>
        <div className="text-[10px] text-neutral-500">22/12/2026 20:00 – 24:00 · 12 €/ora</div>
      </div>
    ) : (
      <div className="rounded-lg border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between">
          <span>{tab === "accettate" ? MOCK.restaurant.name : "Nome locale visibile dopo conferma"}</span>
          <Chip tone={tab === "accettate" ? "green" : "amber"}>{tab === "accettate" ? "Accettata" : "In attesa"}</Chip>
        </div>
        <div className="text-[10px] text-neutral-500">24/12/2026 19:00 – 23:00 · 12 €/ora</div>
      </div>
    )}
    <BottomNav />
  </div>
);

const ShiftsMock = ({ status }: { status: "confermato" | "completato" | "annullato" }) => {
  const map = {
    confermato: { chip: <Chip tone="green">Confermato</Chip>, note: "Nome locale e contatti sbloccati" },
    completato: { chip: <Chip tone="blue">Completato</Chip>, note: "Ricorda di lasciare la recensione" },
    annullato: { chip: <Chip tone="red">Annullato</Chip>, note: "Turno annullato dal locale" },
  }[status];
  return (
    <div>
      <TopBar title="I miei turni" />
      <div className="rounded-lg border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between"><span>{MOCK.shift.title}</span>{map.chip}</div>
        <div className="text-[10px] text-neutral-500">{MOCK.restaurant.name} · {MOCK.shift.when}</div>
        <div className="text-[10px]">{MOCK.shift.rate} · Totale {MOCK.shift.total}</div>
        <div className="text-[10px] text-neutral-500 mt-1">{map.note}</div>
      </div>
      <BottomNav />
    </div>
  );
};

const ReviewsMock = ({ variant }: { variant: "ricevute" | "da-lasciare" }) => (
  <div>
    <TopBar title="Le mie recensioni" />
    <div className="flex text-[10px] mb-2 border-b border-neutral-200">
      <div className={`flex-1 pb-1 text-center ${variant === "ricevute" ? "border-b-2 border-orange-500 font-semibold" : "text-neutral-500"}`}>Ricevute</div>
      <div className={`flex-1 pb-1 text-center ${variant === "da-lasciare" ? "border-b-2 border-orange-500 font-semibold" : "text-neutral-500"}`}>Da lasciare</div>
    </div>
    {variant === "ricevute" ? (
      <div className="rounded border border-neutral-200 p-2 text-[11px]">
        <div className="flex justify-between"><span>⭐⭐⭐⭐⭐</span><span className="text-neutral-500 text-[10px]">14/11/2026</span></div>
        <div className="text-[10px] text-neutral-600">"Marco è stato puntuale e professionale."</div>
        <div className="text-[10px] text-neutral-500">— {MOCK.restaurant.name}</div>
      </div>
    ) : (
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px]">
        <div className="font-semibold">Turno del 14/12/2026</div>
        <div className="text-[10px] text-neutral-600">Lascia una recensione entro 7 giorni.</div>
        <div className="mt-2"><Btn primary>Lascia la tua recensione</Btn></div>
      </div>
    )}
  </div>
);

const ChatMock = () => (
  <div>
    <TopBar title={MOCK.restaurant.name} />
    <div className="text-[10px] text-neutral-500 mb-2">Turno 24/12/2026 19:00</div>
    <div className="space-y-1">
      <div className="bg-neutral-100 rounded-lg px-2 py-1 text-[11px] max-w-[80%]">Ciao Marco, tutto ok per stasera?</div>
      <div className="ml-auto bg-orange-500 text-white rounded-lg px-2 py-1 text-[11px] max-w-[80%]">Sì, arrivo per le 18:50 👋</div>
      <div className="bg-neutral-100 rounded-lg px-2 py-1 text-[11px] max-w-[80%]">Perfetto! Entra dall'ingresso staff.</div>
    </div>
    <div className="mt-3 border border-neutral-200 rounded-full px-3 py-1 text-[11px] text-neutral-400">Scrivi un messaggio…</div>
  </div>
);

const NotificationsMock = ({ empty = false }: { empty?: boolean }) => (
  <div>
    <TopBar title="Notifiche" />
    {empty ? (
      <div className="h-40 grid place-items-center text-center text-neutral-500 text-[11px]">
        <div><div className="text-3xl mb-1">🔔</div>Nessuna notifica</div>
      </div>
    ) : (
      <div className="space-y-2 text-[11px]">
        <div className="rounded border border-neutral-200 p-2">
          <b>Candidatura confermata</b><div className="text-[10px] text-neutral-500">Apri la chat con {MOCK.restaurant.name}</div>
        </div>
        <div className="rounded border border-neutral-200 p-2">
          <b>Recensione in attesa</b><div className="text-[10px] text-neutral-500">Lascia la recensione entro 7 giorni</div>
        </div>
      </div>
    )}
  </div>
);

const SettingsMock = () => (
  <div>
    <TopBar title="Impostazioni" />
    <div className="text-[11px] divide-y divide-neutral-100 border border-neutral-200 rounded">
      <div className="p-2 flex justify-between">Cambia password <span>›</span></div>
      <div className="p-2 flex justify-between">Notifiche <span>›</span></div>
      <div className="p-2 flex justify-between">Privacy <span>›</span></div>
      <div className="p-2 flex justify-between">Tema <span className="text-neutral-500">Auto ›</span></div>
      <div className="p-2 flex justify-between text-red-600">Elimina account <span>›</span></div>
    </div>
  </div>
);

const ChangePwdMock = () => (
  <div>
    <TopBar title="Cambia password" />
    <div className="space-y-2 text-[11px]">
      <div>Password attuale<div className="border border-neutral-200 rounded px-2 py-1">••••••</div></div>
      <div>Nuova password<div className="border border-neutral-200 rounded px-2 py-1">••••••</div></div>
      <div>Conferma<div className="border border-neutral-200 rounded px-2 py-1">••••••</div></div>
    </div>
    <div className="mt-3"><Btn primary>Aggiorna</Btn></div>
  </div>
);

const OnboardingMock = () => (
  <div>
    <TopBar title="Benvenuto in Pupillo" />
    <div className="h-1 bg-neutral-200 rounded-full mb-2 overflow-hidden">
      <div className="h-1 bg-orange-500" style={{ width: "40%" }} />
    </div>
    <div className="text-[10px] text-neutral-500 mb-3">Step 2 di 5</div>
    <div className="text-[12px] font-semibold mb-2">I tuoi ruoli</div>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      {["Cameriere","Barista","Cuoco","Lavapiatti","Runner","Aiuto cucina"].map((r) => (
        <div key={r} className="border border-neutral-200 rounded px-2 py-2 text-center">{r}</div>
      ))}
    </div>
    <div className="mt-3"><Btn primary>Continua</Btn></div>
  </div>
);

const HelpMock = () => (
  <div>
    <TopBar title="Aiuto" />
    <div className="space-y-2 text-[11px]">
      <div className="border border-neutral-200 rounded p-2">Come funziona la candidatura?</div>
      <div className="border border-neutral-200 rounded p-2">Quando vedo il nome del locale?</div>
      <div className="border border-neutral-200 rounded p-2">Cosa succede se annullo un turno?</div>
    </div>
    <div className="mt-3"><Btn>Contatta l'assistenza</Btn></div>
  </div>
);

/* Restaurant screens */
const RestDashMock = () => (
  <div>
    <TopBar title="Osteria Milano" />
    <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 text-[10px] text-orange-800 mb-2 flex justify-between">
      <span>Crediti: <b>8</b></span><span className="underline">Ricarica</span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
      <div className="rounded border border-neutral-200 p-2"><div className="text-neutral-500 text-[10px]">Annunci attivi</div><div className="text-lg font-bold">3</div></div>
      <div className="rounded border border-neutral-200 p-2"><div className="text-neutral-500 text-[10px]">Candidature</div><div className="text-lg font-bold">7</div></div>
    </div>
    <div className="rounded-lg border border-neutral-200 p-2 text-[11px]">
      <b>Prossimo turno</b>
      <div className="text-[10px] text-neutral-500">{MOCK.worker.name} · 24/12/2026 19:00</div>
    </div>
    <BottomNav />
  </div>
);

const RestProfileMock = () => (
  <div>
    <TopBar title="Profilo locale" />
    <div className="flex items-center gap-2 mb-3">
      <div className="w-12 h-12 rounded-full bg-neutral-200 grid place-items-center">🍝</div>
      <div>
        <div className="font-semibold text-[12px]">{MOCK.restaurant.name}</div>
        <div className="text-[10px] text-neutral-500">{MOCK.restaurant.zone}</div>
        <div className="text-[10px]">⭐ 4.6 (42 recensioni)</div>
      </div>
    </div>
    <div className="space-y-1 text-[11px]">
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Tipo</span><span className="text-neutral-500">Osteria</span></div>
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>Referente</span><span className="text-neutral-500">Giulia</span></div>
      <div className="flex justify-between border-b border-neutral-100 py-1"><span>P. IVA</span><span className="text-neutral-500">12345678900</span></div>
    </div>
    <div className="mt-3"><Btn>Modifica</Btn></div>
  </div>
);

const NewAnnouncementMock = () => (
  <div>
    <TopBar title="Nuovo annuncio" />
    <div className="h-1 bg-neutral-200 rounded-full mb-2"><div className="h-1 bg-orange-500 rounded-full" style={{ width: "60%" }} /></div>
    <div className="text-[10px] text-neutral-500 mb-3">Step 3 di 5 — Tariffa e posizioni</div>
    <div className="space-y-2 text-[11px]">
      <div>Tariffa oraria<div className="border border-neutral-200 rounded px-2 py-1">12 €/ora</div></div>
      <div>Posizioni<div className="border border-neutral-200 rounded px-2 py-1">2</div></div>
      <div>Ruolo<div className="border border-neutral-200 rounded px-2 py-1">Cameriere</div></div>
    </div>
    <div className="mt-3"><Btn primary>Continua</Btn></div>
  </div>
);

const AnnouncementsListMock = () => (
  <div>
    <TopBar title="I miei annunci" />
    {[
      { s: "Aperto", t: "green" as const, n: "3 candidature" },
      { s: "Completo", t: "blue" as const, n: "2/2 confermati" },
      { s: "Scaduto", t: "gray" as const, n: "1 candidatura" },
    ].map((a, i) => (
      <div key={i} className="rounded-lg border border-neutral-200 p-2 mb-2 text-[11px]">
        <div className="flex justify-between font-semibold"><span>Cameriere · 24/12</span><Chip tone={a.t}>{a.s}</Chip></div>
        <div className="text-[10px] text-neutral-500">{a.n} · 12 €/ora</div>
      </div>
    ))}
    <div className="mt-2"><Btn primary>+ Pubblica annuncio</Btn></div>
  </div>
);

const CandidaturesMock = () => (
  <div>
    <TopBar title="Candidature" />
    <div className="text-[10px] text-neutral-500 mb-2">Cameriere · 24/12/2026</div>
    {[1,2,3].map((n) => (
      <div key={n} className="rounded border border-neutral-200 p-2 mb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-200 grid place-items-center text-[10px]">L{n}</div>
          <div className="flex-1">
            <div className="font-semibold">Lavoratore</div>
            <div className="text-[10px] text-neutral-500">⭐ 4.{9-n} · Milano</div>
          </div>
          <div className="flex gap-1">
            <button className="text-red-500 text-[10px]">Rifiuta</button>
            <button className="text-green-600 text-[10px] font-semibold">Accetta</button>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const CandidatureDetailMock = () => (
  <div>
    <TopBar title="Candidatura" />
    <div className="flex items-center gap-2 mb-2">
      <div className="w-12 h-12 rounded-full bg-neutral-200 grid place-items-center">L1</div>
      <div>
        <div className="font-semibold text-[12px]">Lavoratore</div>
        <div className="text-[10px] text-neutral-500">⭐ 4.8 (27) · Milano</div>
        <Chip tone="green">Documento verificato</Chip>
      </div>
    </div>
    <div className="text-[11px] mb-2">Ruoli: Cameriere, Barista · 3 anni esperienza</div>
    <div className="space-y-2">
      <Btn primary>Accetta candidatura</Btn>
      <Btn>Rifiuta</Btn>
    </div>
  </div>
);

const WorkerSearchMock = () => (
  <div>
    <TopBar title="Trova lavoratori" />
    <div className="flex gap-1 mb-2"><Chip tone="blue">Milano</Chip><Chip>Cameriere</Chip><Chip>Sera</Chip></div>
    {[1,2,3].map((n) => (
      <div key={n} className="rounded border border-neutral-200 p-2 mb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-200" />
          <div className="flex-1">
            <div className="font-semibold">Lavoratore #{n}</div>
            <div className="text-[10px] text-neutral-500">⭐ 4.{9-n} · Cameriere</div>
          </div>
          <button className="text-orange-600 text-[10px] font-semibold">Invita</button>
        </div>
      </div>
    ))}
    <BottomNav />
  </div>
);

const WorkerDetailMock = () => (
  <div>
    <TopBar title="Profilo lavoratore" />
    <div className="flex items-center gap-2 mb-3">
      <div className="w-14 h-14 rounded-full bg-orange-200 grid place-items-center font-bold text-orange-700">L</div>
      <div>
        <div className="font-semibold text-[12px]">Lavoratore</div>
        <div className="text-[10px] text-neutral-500">Milano · Cameriere · ⭐ 4.8</div>
        <Chip tone="green">Affidabile</Chip>
      </div>
    </div>
    <div className="text-[11px] text-neutral-600 mb-3">Nome completo visibile dopo l'accettazione della proposta.</div>
    <Btn primary>Invita a un turno</Btn>
  </div>
);

const InvitePropMock = () => (
  <div>
    <TopBar title="Proposta tariffa" />
    <div className="text-[11px] text-neutral-600 mb-2">Turno del 24/12/2026 19:00 – 23:00</div>
    <div className="space-y-2 text-[11px]">
      <div>Ruolo<div className="border border-neutral-200 rounded px-2 py-1">Cameriere</div></div>
      <div>Tariffa proposta<div className="border border-neutral-200 rounded px-2 py-1">12 €/ora</div></div>
      <div>Messaggio<div className="border border-neutral-200 rounded px-2 py-1 h-14">Ciao, ci farebbe piacere averti con noi.</div></div>
    </div>
    <div className="mt-3"><Btn primary>Invia proposta</Btn></div>
  </div>
);

const BillingMock = () => (
  <div>
    <TopBar title="Crediti e piani" />
    <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-3">
      <div className="text-[10px] text-orange-700">Crediti disponibili</div>
      <div className="text-2xl font-bold text-orange-700">8</div>
    </div>
    {[
      { n: "Basic", p: "29 €/mese", c: "10 crediti" },
      { n: "Pro", p: "79 €/mese", c: "40 crediti" },
      { n: "Business", p: "149 €/mese", c: "100 crediti" },
    ].map((p) => (
      <div key={p.n} className="rounded-lg border border-neutral-200 p-2 mb-2 text-[11px] flex justify-between">
        <div><b>{p.n}</b><div className="text-[10px] text-neutral-500">{p.c}</div></div>
        <div>{p.p}</div>
      </div>
    ))}
  </div>
);

const RestReviewsMock = () => (
  <div>
    <TopBar title="Recensioni" />
    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 mb-2">
      Hai 2 recensioni obbligatorie in scadenza.
    </div>
    <div className="rounded border border-neutral-200 p-2 text-[11px]">
      <div className="flex justify-between"><span>⭐⭐⭐⭐⭐</span><span className="text-[10px] text-neutral-500">14/11/2026</span></div>
      <div className="text-[10px] text-neutral-600">"Locale organizzato, staff gentile."</div>
      <div className="text-[10px] text-neutral-500">— {MOCK.worker.name}</div>
    </div>
  </div>
);

/* Popups */
const Modal = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="absolute inset-0 bg-black/40 grid place-items-center px-3">
    <div className="w-full bg-white rounded-2xl shadow-lg p-3">
      <div className="text-[12px] font-semibold mb-2">{title}</div>
      {children}
    </div>
  </div>
);

const GuidedTourPopup = () => (
  <div className="relative h-full">
    <WorkerDashMock />
    <Modal title="Benvenuto in Pupillo 👋">
      <div className="text-[11px] text-neutral-600 mb-3">Ti mostriamo in 3 passi come trovare il tuo primo turno.</div>
      <div className="flex gap-2"><div className="flex-1"><Btn>Salta</Btn></div><div className="flex-1"><Btn primary>Inizia</Btn></div></div>
    </Modal>
  </div>
);

const ConfirmShiftPopup = () => (
  <div className="relative h-full">
    <ShiftsMock status="confermato" />
    <Modal title="Confermi il turno?">
      <div className="text-[11px] text-neutral-600 mb-3">Verrà scalato 1 credito. L'operazione è definitiva.</div>
      <div className="flex gap-2"><div className="flex-1"><Btn>Annulla</Btn></div><div className="flex-1"><Btn primary>Conferma</Btn></div></div>
    </Modal>
  </div>
);

const CancelShiftPopup = () => (
  <div className="relative h-full">
    <ShiftsMock status="confermato" />
    <Modal title="Annullare il turno?">
      <div className="text-[11px] text-neutral-600 mb-3">L'annullamento influisce sulla tua reputazione. Motivo obbligatorio.</div>
      <div className="border border-neutral-200 rounded px-2 py-1 mb-2 text-[11px] text-neutral-400">Motivo…</div>
      <div className="flex gap-2"><div className="flex-1"><Btn>Indietro</Btn></div><div className="flex-1"><button className="w-full rounded-lg bg-red-500 text-white text-[11px] py-2 font-semibold">Annulla turno</button></div></div>
    </Modal>
  </div>
);

const AppliedPopup = () => (
  <div className="relative h-full">
    <AnnouncementDetailMock />
    <Modal title="Candidatura inviata ✅">
      <div className="text-[11px] text-neutral-600 mb-3">Riceverai una notifica appena il locale risponderà.</div>
      <Btn primary>OK</Btn>
    </Modal>
  </div>
);

const OfferReceivedPopup = () => (
  <div className="relative h-full">
    <WorkerDashMock />
    <Modal title="Nuova offerta ricevuta 🔔">
      <div className="text-[11px] text-neutral-600 mb-3">Un locale ti ha invitato per un turno il 24/12/2026 alle 19:00.</div>
      <div className="flex gap-2"><div className="flex-1"><Btn>Dopo</Btn></div><div className="flex-1"><Btn primary>Vedi</Btn></div></div>
    </Modal>
  </div>
);

const ErrorPopup = () => (
  <div className="relative h-full">
    <BrowseMock />
    <Modal title="Errore">
      <div className="text-[11px] text-red-600 mb-3">Non è stato possibile completare l'operazione. Riprova.</div>
      <Btn primary>Chiudi</Btn>
    </Modal>
  </div>
);

const SuccessPopup = () => (
  <div className="relative h-full">
    <BillingMock />
    <Modal title="Pagamento completato ✅">
      <div className="text-[11px] text-green-700 mb-3">10 crediti aggiunti al tuo account.</div>
      <Btn primary>Ottimo</Btn>
    </Modal>
  </div>
);

const ReviewPopup = () => (
  <div className="relative h-full">
    <ShiftsMock status="completato" />
    <Modal title="Lascia una recensione">
      <div className="text-[11px] text-neutral-600 mb-2">Com'è andato il turno con {MOCK.restaurant.name}?</div>
      <div className="text-[16px] mb-2">⭐⭐⭐⭐☆</div>
      <div className="border border-neutral-200 rounded px-2 py-1 mb-2 text-[11px] h-14 text-neutral-400">Commento (opzionale)…</div>
      <Btn primary>Invia recensione</Btn>
    </Modal>
  </div>
);

const CreditsPopup = () => (
  <div className="relative h-full">
    <RestDashMock />
    <Modal title="Crediti insufficienti">
      <div className="text-[11px] text-neutral-600 mb-3">Per confermare questo turno devi avere crediti disponibili.</div>
      <div className="space-y-2"><Btn primary>Attiva Basic</Btn><Btn>Vedi tutti i piani</Btn></div>
    </Modal>
  </div>
);

const ToastMock = () => (
  <div className="relative h-full">
    <WorkerDashMock />
    <div className="absolute bottom-3 left-3 right-3 bg-neutral-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg">
      ✅ Candidatura inviata
    </div>
  </div>
);

const AlertMock = () => (
  <div>
    <TopBar title="Dashboard" />
    <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 mb-2">
      ⚠️ Hai recensioni obbligatorie scadute. Nuovi contatti bloccati.
    </div>
    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 mb-2">
      Profilo all'80%. Completa per candidarti.
    </div>
    <div className="rounded border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
      💡 Suggerimento: aggiungi la tua foto per aumentare i match del 40%.
    </div>
  </div>
);

const BadgesMock = () => (
  <div>
    <TopBar title="Badge e label" />
    <div className="flex flex-wrap gap-1 mb-3">
      <Chip tone="green">Confermato</Chip><Chip tone="amber">In attesa</Chip><Chip tone="red">Rifiutata</Chip>
      <Chip tone="blue">Completato</Chip><Chip tone="gray">Bozza</Chip>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      <Chip tone="green">Documento verificato</Chip><Chip tone="blue">Top rated</Chip><Chip tone="amber">Nuovo</Chip>
    </div>
    <div className="space-y-2">
      <Btn primary>Bottone primario</Btn>
      <Btn>Bottone secondario</Btn>
      <button className="w-full rounded-lg text-red-600 text-[11px] py-2 border border-red-200">Bottone distruttivo</button>
    </div>
  </div>
);

const CardsShowcaseMock = () => (
  <div>
    <TopBar title="Card ricorrenti" />
    <div className="space-y-2 text-[11px]">
      <div className="rounded border border-neutral-200 p-2">
        <b>Card turno</b>
        <div className="text-[10px] text-neutral-500">{MOCK.shift.title} · {MOCK.shift.when}</div>
        <Chip tone="green">Confermato</Chip>
      </div>
      <div className="rounded border border-neutral-200 p-2 flex gap-2 items-center">
        <div className="w-8 h-8 rounded-full bg-orange-200" />
        <div><b>Card lavoratore</b><div className="text-[10px] text-neutral-500">⭐ 4.8 · Milano</div></div>
      </div>
      <div className="rounded border border-neutral-200 p-2">
        <b>Card ristorante</b>
        <div className="text-[10px] text-neutral-500">{MOCK.restaurant.name} · ⭐ 4.6</div>
      </div>
      <div className="rounded border border-neutral-200 p-2">
        <b>Card recensione</b>
        <div className="text-[10px] text-neutral-500">⭐⭐⭐⭐⭐ "Ottima esperienza."</div>
      </div>
      <div className="rounded border border-neutral-200 p-2">
        <b>Card disponibilità</b>
        <div className="text-[10px] text-neutral-500">Sab 27/12 · 18:00 – 24:00</div>
      </div>
    </div>
  </div>
);

const MobileMenuMock = () => (
  <div className="relative h-full">
    <WorkerDashMock />
    <div className="absolute inset-0 bg-black/30" />
    <div className="absolute right-0 top-0 h-full w-2/3 bg-white shadow-xl p-3">
      <div className="font-semibold text-[12px] mb-3">Menu</div>
      <div className="space-y-2 text-[11px]">
        {["Dashboard","Offerte","Turni","Disponibilità","Recensioni","Notifiche","Profilo","Impostazioni","Aiuto","Esci"].map((v) => (
          <div key={v} className="border-b border-neutral-100 py-1">{v}</div>
        ))}
      </div>
    </div>
  </div>
);

/* Desktop */
const DesktopHome = () => (
  <div>
    <div className="flex justify-between items-center border-b border-neutral-200 pb-2 mb-3">
      <div className="text-orange-500 font-bold">Pupillo</div>
      <div className="text-[11px] flex gap-3 text-neutral-600"><span>Come funziona</span><span>Login</span><span className="bg-orange-500 text-white px-2 py-1 rounded">Registrati</span></div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-lg font-bold mb-2">Lavoro Ho.Re.Ca. senza intermediari</div>
        <div className="text-[11px] text-neutral-600 mb-3">Trova personale qualificato o offerte in linea con le tue disponibilità in 24h.</div>
        <div className="flex gap-2"><div className="bg-orange-500 text-white px-3 py-2 rounded text-[11px]">Sono un Lavoratore</div><div className="border border-neutral-200 px-3 py-2 rounded text-[11px]">Sono un Ristoratore</div></div>
      </div>
      <div className="bg-orange-100 rounded-lg h-40" />
    </div>
  </div>
);

const DesktopShell = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex">
    <aside className="w-32 border-r border-neutral-200 pr-2 text-[11px] space-y-2">
      <div className="text-orange-500 font-bold mb-2">Pupillo</div>
      {["Dashboard","Offerte","Turni","Chat","Recensioni","Profilo"].map((v) => (
        <div key={v} className={v === title ? "font-semibold text-orange-600" : "text-neutral-500"}>{v}</div>
      ))}
    </aside>
    <main className="flex-1 pl-3">
      <div className="text-[13px] font-semibold mb-2">{title}</div>
      {children}
    </main>
  </div>
);

const DesktopWorkerDash = () => (
  <DesktopShell title="Dashboard">
    <div className="grid grid-cols-3 gap-2 mb-3">
      {[["Turni","3"],["Candidature","5"],["Recensioni","27"]].map(([l,v]) => (
        <div key={l} className="border border-neutral-200 rounded p-2"><div className="text-[10px] text-neutral-500">{l}</div><div className="text-lg font-bold">{v}</div></div>
      ))}
    </div>
    <div className="border border-neutral-200 rounded p-2 text-[11px]"><b>Prossimo turno</b><div className="text-[10px] text-neutral-500">{MOCK.shift.title} · {MOCK.shift.when}</div></div>
  </DesktopShell>
);

const DesktopRestDash = () => (
  <DesktopShell title="Dashboard">
    <div className="grid grid-cols-4 gap-2 mb-3">
      {[["Crediti","8"],["Annunci","3"],["Candidature","7"],["Recensioni","42"]].map(([l,v]) => (
        <div key={l} className="border border-neutral-200 rounded p-2"><div className="text-[10px] text-neutral-500">{l}</div><div className="text-lg font-bold">{v}</div></div>
      ))}
    </div>
    <div className="border border-neutral-200 rounded p-2 text-[11px]"><b>Ultime candidature</b><div className="text-[10px] text-neutral-500">Lavoratore · Cameriere · ⭐ 4.8</div></div>
  </DesktopShell>
);

const DesktopBrowse = () => (
  <DesktopShell title="Offerte">
    <div className="flex gap-1 mb-2"><Chip tone="blue">Milano</Chip><Chip>Cameriere</Chip><Chip>Sera</Chip></div>
    <div className="grid grid-cols-2 gap-2">
      {[1,2,3,4].map((n) => (
        <div key={n} className="border border-neutral-200 rounded p-2 text-[11px]"><b>Ristorante · Milano</b><div className="text-[10px] text-neutral-500">Sab 20:00 – 24:00 · 13 €/ora</div></div>
      ))}
    </div>
  </DesktopShell>
);

const DesktopWorkerSearch = () => (
  <DesktopShell title="Trova lavoratori">
    <div className="grid grid-cols-3 gap-2">
      {[1,2,3,4,5,6].map((n) => (
        <div key={n} className="border border-neutral-200 rounded p-2 text-[11px]"><div className="w-8 h-8 rounded-full bg-orange-200 mb-1" /><b>Lavoratore #{n}</b><div className="text-[10px] text-neutral-500">⭐ 4.{9-n%5}</div></div>
      ))}
    </div>
  </DesktopShell>
);

const DesktopChat = () => (
  <DesktopShell title="Chat">
    <div className="flex gap-2 h-56">
      <div className="w-40 border-r border-neutral-200 pr-2 text-[11px] space-y-2">
        <div className="border border-neutral-200 rounded p-1">Osteria Milano</div>
        <div className="text-neutral-500 p-1">Trattoria Sole</div>
        <div className="text-neutral-500 p-1">Bistrò Duomo</div>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="bg-neutral-100 rounded px-2 py-1 text-[11px] max-w-[70%] mb-1">Ciao Marco, tutto ok per stasera?</div>
        <div className="ml-auto bg-orange-500 text-white rounded px-2 py-1 text-[11px] max-w-[70%]">Sì, ci sono!</div>
      </div>
    </div>
  </DesktopShell>
);

const DesktopWorkerProfile = () => (
  <DesktopShell title="Profilo">
    <div className="flex gap-3">
      <div className="w-24 h-24 rounded-full bg-orange-200" />
      <div className="text-[11px]">
        <div className="font-bold text-[13px]">{MOCK.worker.name}</div>
        <div className="text-neutral-500">Cameriere · Milano · ⭐ 4.8</div>
        <div className="mt-2">Lingue: IT, EN</div>
        <div>Zone: Milano centro, Navigli</div>
      </div>
    </div>
  </DesktopShell>
);

const DesktopRestProfile = () => (
  <DesktopShell title="Profilo locale">
    <div className="flex gap-3">
      <div className="w-24 h-24 rounded bg-neutral-200 grid place-items-center">🍝</div>
      <div className="text-[11px]">
        <div className="font-bold text-[13px]">{MOCK.restaurant.name}</div>
        <div className="text-neutral-500">{MOCK.restaurant.zone} · Osteria</div>
        <div className="mt-2">Referente: Giulia</div>
        <div>Recensioni: ⭐ 4.6 (42)</div>
      </div>
    </div>
  </DesktopShell>
);

const DesktopShiftDetail = () => (
  <DesktopShell title="Dettaglio turno">
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-neutral-200 rounded p-2 text-[11px]">
        <b>Turno</b><div>{MOCK.shift.title}</div><div className="text-neutral-500">{MOCK.shift.when}</div><Chip tone="green">Confermato</Chip>
      </div>
      <div className="border border-neutral-200 rounded p-2 text-[11px]">
        <b>Lavoratore</b><div>{MOCK.worker.name}</div><div className="text-neutral-500">⭐ 4.8 · Cameriere</div><div className="mt-1">📞 +39 340 000 0000</div>
      </div>
    </div>
  </DesktopShell>
);

/* Flow overview */
const FlowMap = () => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-[12px] leading-relaxed">
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <b>Registrazione</b>
        <div className="text-neutral-600">Auth → OTP telefono → Onboarding → Dashboard</div>
      </div>
      <div>
        <b>Login</b>
        <div className="text-neutral-600">Auth → Dashboard (redirect per ruolo)</div>
      </div>
      <div>
        <b>Lavoratore</b>
        <div className="text-neutral-600">Dashboard → Offerte → Dettaglio → Candidatura → Chat → Turno → Recensione</div>
      </div>
      <div>
        <b>Ristoratore</b>
        <div className="text-neutral-600">Dashboard → Annunci → Candidature → Accetta → Conferma turno → Chat → Recensione</div>
      </div>
      <div>
        <b>Candidatura</b>
        <div className="text-neutral-600">Browse → Detail → Candidati → Pending → Accetta/Rifiuta → Conferma</div>
      </div>
      <div>
        <b>Invito diretto</b>
        <div className="text-neutral-600">Workers → Profilo → Invita → Proposta tariffa → Accetta → Conferma</div>
      </div>
      <div>
        <b>Conferma turno</b>
        <div className="text-neutral-600">Accettazione → Popup crediti → Scala 1 credito → Dati sbloccati</div>
      </div>
      <div>
        <b>Privacy / sblocco dati</b>
        <div className="text-neutral-600">Prima: iniziali + area approssimata → Dopo conferma: nome, telefono, indirizzo esatto</div>
      </div>
      <div>
        <b>Recensioni</b>
        <div className="text-neutral-600">Fine turno → Reminder → Blind reciprocal → Sblocco reciproco</div>
      </div>
      <div>
        <b>Notifiche</b>
        <div className="text-neutral-600">Trigger → Bell + realtime → Deep-link a pagina corretta</div>
      </div>
      <div>
        <b>Messaggi</b>
        <div className="text-neutral-600">Sblocco solo dopo accettazione → Inbox realtime → Thread</div>
      </div>
    </div>
  </div>
);

/* ============================================================
 * PAGE
 * ============================================================ */
function ClaudeVisualAuditPage() {
  return (
    <div className="claude-audit min-h-screen bg-neutral-50 text-neutral-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .claude-audit { background: white !important; }
          .audit-section { break-before: page; page-break-before: always; }
          .audit-section:first-of-type { break-before: auto; page-break-before: auto; }
          .audit-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-orange-600 font-semibold">Visual Audit Pack</div>
          <h1 className="text-3xl font-bold">Pupillo — Visual Audit per Claude</h1>
          <p className="text-sm text-neutral-600 mt-2 max-w-3xl">
            Galleria ordinata delle schermate principali di Pupillo (con dati fittizi) per l'analisi UX/UI,
            grafica, navigabilità, mobile experience e coerenza visiva. Pagina progettata per essere salvata
            in PDF dal browser (Cmd/Ctrl+P → Salva come PDF) e caricata su Claude.
          </p>
          <div className="no-print mt-3 flex gap-2 text-xs">
            <a href="#flussi" className="underline text-orange-600">Flussi</a>
            <a href="#pubbliche" className="underline text-orange-600">Pubbliche</a>
            <a href="#lavoratore" className="underline text-orange-600">Lavoratore</a>
            <a href="#ristoratore" className="underline text-orange-600">Ristoratore</a>
            <a href="#stati" className="underline text-orange-600">Stati</a>
            <a href="#popup" className="underline text-orange-600">Popup</a>
            <a href="#desktop" className="underline text-orange-600">Desktop</a>
          </div>
        </header>

        <section id="flussi" className="audit-section">
          <h2 className="text-xl font-bold border-b border-neutral-300 pb-2 mb-6">Mappa visuale dei flussi</h2>
          <FlowMap />
        </section>

        <Section id="pubbliche" title="Schermate pubbliche">
          <Card title="Homepage" role="Pubblico" route="/" goal="Presentare Pupillo e indirizzare per ruolo." actions="Registrati, Login, Scopri come funziona" state="Default" issues="Dual-role deve essere chiaro entro 5s" claude="Chiarezza value proposition, gerarchia CTA, fiducia visiva.">
            <PhoneFrame><HomeMock /></PhoneFrame>
          </Card>
          <Card title="Come funziona" role="Pubblico" route="/come-funziona" goal="Spiegare i 3 step chiave." actions="Prosegui a registrazione" state="Con dati" claude="Densità testuale, priorità CTA finale.">
            <PhoneFrame><ComeFunzionaMock /></PhoneFrame>
          </Card>
          <Card title="Login" role="Pubblico" route="/auth" goal="Accesso rapido con email o Google." actions="Login, Google login, Password dimenticata" state="Default" claude="Bilanciamento login vs registrazione, gerarchia OAuth.">
            <PhoneFrame><AuthMock /></PhoneFrame>
          </Card>
          <Card title="Registrazione" role="Pubblico" route="/auth" goal="Selezione ruolo + credenziali." actions="Seleziona ruolo, Crea account" state="Default" issues="Il ruolo è irreversibile senza admin" claude="Chiarezza scelta ruolo, comunicazione irreversibilità.">
            <PhoneFrame><RegisterMock /></PhoneFrame>
          </Card>
          <Card title="Recupero password" role="Pubblico" route="/reset-password" goal="Invio link reset." actions="Invia link" state="Default" claude="Semplicità e feedback post-invio.">
            <PhoneFrame><ResetMock /></PhoneFrame>
          </Card>
          <Card title="Errore login" role="Pubblico" route="/auth" goal="Mostrare errore credenziali." actions="Riprova" state="Errore" claude="Chiarezza messaggio, evita colpevolizzare l'utente.">
            <PhoneFrame><LoginErrorMock /></PhoneFrame>
          </Card>
          <Card title="Accesso negato" role="Pubblico" route="/forbidden" goal="Comunicare permessi mancanti." actions="Torna alla home" state="Non autorizzato" claude="Empatia e via d'uscita chiara.">
            <PhoneFrame><ForbiddenMock /></PhoneFrame>
          </Card>
        </Section>

        <Section id="lavoratore" title="Schermate lavoratore">
          <Card title="Dashboard lavoratore" role="Lavoratore" route="/dashboard" goal="Riepilogo turni + offerte + banner profilo." actions="Vai a offerte, apri turno" state="Con dati" issues="Rischio sovraffollamento banner+card" claude="Priorità visiva, densità informazioni, navigabilità mobile.">
            <PhoneFrame><WorkerDashMock /></PhoneFrame>
          </Card>
          <Card title="Dashboard vuota" role="Lavoratore" route="/dashboard" goal="Empty state guidato." actions="Cerca offerte" state="Vuoto" claude="Efficacia empty state, chiarezza CTA.">
            <PhoneFrame><WorkerDashEmptyMock /></PhoneFrame>
          </Card>
          <Card title="Profilo lavoratore" role="Lavoratore" route="/profile" goal="Panoramica profilo pubblico." actions="Modifica profilo" state="Con dati" claude="Fiducia, leggibilità dati, badge affidabilità.">
            <PhoneFrame><WorkerProfileMock /></PhoneFrame>
          </Card>
          <Card title="Modifica profilo" role="Lavoratore" route="/profile" goal="Editing campi profilo." actions="Salva" state="Editing" claude="Chiarezza form, spaziatura mobile.">
            <PhoneFrame><WorkerEditProfileMock /></PhoneFrame>
          </Card>
          <Card title="Disponibilità settimanale" role="Lavoratore" route="/availability" goal="Impostare giorni e fasce ricorrenti." actions="Seleziona giorni, salva" state="Con dati" issues="Grid pesante su mobile" claude="Usabilità del selettore, feedback selezione.">
            <PhoneFrame><AvailabilityMock /></PhoneFrame>
          </Card>
          <Card title="Disponibilità speciali" role="Lavoratore" route="/availability" goal="Eccezioni datate." actions="Aggiungi giorno" state="Con dati" claude="Distinzione disponibile/occupato, aggiunta rapida.">
            <PhoneFrame><AvailabilitySpecialMock /></PhoneFrame>
          </Card>
          <Card title="Ricerca offerte" role="Lavoratore" route="/browse" goal="Sfogliare offerte compatibili." actions="Filtra, apri offerta" state="Con dati" claude="Distinzione offerte già viste vs nuove, filtri persistenti.">
            <PhoneFrame><BrowseMock /></PhoneFrame>
          </Card>
          <Card title="Dettaglio offerta" role="Lavoratore" route="/announcements/$id" goal="Info complete + candidatura." actions="Candidati, salva" state="Privacy bloccata" claude="Trasparenza requisiti, chiarezza tariffa e privacy.">
            <PhoneFrame><AnnouncementDetailMock /></PhoneFrame>
          </Card>
          <Card title="Candidatura inviata" role="Lavoratore" route="/announcements/$id" goal="Feedback conferma candidatura." actions="Attende risposta" state="Candidatura inviata" claude="Chiarezza feedback e prossimi passi.">
            <PhoneFrame><AppliedMock /></PhoneFrame>
          </Card>
          <Card title="Offerte ricevute" role="Lavoratore" route="/jobs" goal="Tab ricevute/accettate/rifiutate." actions="Apri offerta" state="Ricevute" claude="Leggibilità tab, coerenza card tra stati.">
            <PhoneFrame><JobsMock tab="ricevute" /></PhoneFrame>
          </Card>
          <Card title="Offerte accettate" role="Lavoratore" route="/jobs" goal="Vista offerte accettate." actions="Apri chat" state="Accettata" claude="Sblocco dati coerente con la privacy.">
            <PhoneFrame><JobsMock tab="accettate" /></PhoneFrame>
          </Card>
          <Card title="Offerte rifiutate" role="Lavoratore" route="/jobs" goal="Storico rifiuti." actions="—" state="Rifiutata" issues="Non deve comparire 'Nome locale dopo conferma' (fix recente)" claude="Coerenza copy negli stati terminati.">
            <PhoneFrame><JobsMock tab="rifiutate" /></PhoneFrame>
          </Card>
          <Card title="Turni confermati" role="Lavoratore" route="/shifts" goal="Lista turni confermati con contatti." actions="Chiama, apri chat" state="Confermato" claude="Utilità informazioni post-sblocco.">
            <PhoneFrame><ShiftsMock status="confermato" /></PhoneFrame>
          </Card>
          <Card title="Turni completati" role="Lavoratore" route="/shifts" goal="Storico turni + CTA recensione." actions="Lascia recensione" state="Completato" claude="Chiamata a recensione ben visibile.">
            <PhoneFrame><ShiftsMock status="completato" /></PhoneFrame>
          </Card>
          <Card title="Turni annullati" role="Lavoratore" route="/shifts" goal="Storico annullamenti." actions="—" state="Annullato" claude="Neutralità visiva, evita colpevolizzazione.">
            <PhoneFrame><ShiftsMock status="annullato" /></PhoneFrame>
          </Card>
          <Card title="Recensioni ricevute" role="Lavoratore" route="/reviews/$id" goal="Storico recensioni pubbliche." actions="—" state="Con dati" claude="Fiducia percepita, leggibilità stars + testo.">
            <PhoneFrame><ReviewsMock variant="ricevute" /></PhoneFrame>
          </Card>
          <Card title="Recensione da lasciare" role="Lavoratore" route="/reviews/$id" goal="Reminder recensione blind." actions="Lascia recensione" state="Da lasciare" claude="Chiarezza logica blind reciprocal.">
            <PhoneFrame><ReviewsMock variant="da-lasciare" /></PhoneFrame>
          </Card>
          <Card title="Chat" role="Lavoratore" route="/messages/$id" goal="Comunicazione dopo match." actions="Scrivere messaggio" state="Con dati" claude="Compattezza mobile, distinzione mittente.">
            <PhoneFrame><ChatMock /></PhoneFrame>
          </Card>
          <Card title="Notifiche" role="Lavoratore" route="/notifications" goal="Centro notifiche." actions="Apri notifica" state="Con notifiche" claude="Chiarezza tipologie, deep-link corretti.">
            <PhoneFrame><NotificationsMock /></PhoneFrame>
          </Card>
          <Card title="Impostazioni account" role="Lavoratore" route="/profile" goal="Gestione preferenze." actions="Modifica preferenze" state="Con dati" claude="Ordinamento voci per frequenza d'uso.">
            <PhoneFrame><SettingsMock /></PhoneFrame>
          </Card>
          <Card title="Cambio password" role="Lavoratore" route="/profile" goal="Update password." actions="Aggiorna" state="Editing" claude="Feedback validazione password.">
            <PhoneFrame><ChangePwdMock /></PhoneFrame>
          </Card>
          <Card title="Onboarding" role="Lavoratore" route="/onboarding" goal="Setup profilo iniziale." actions="Continua" state="Wizard" issues="Nessun salvataggio bozza" claude="Tolleranza errori e progresso visibile.">
            <PhoneFrame><OnboardingMock /></PhoneFrame>
          </Card>
          <Card title="Help / Supporto" role="Lavoratore" route="/profile" goal="FAQ + contatto assistenza." actions="Contatta assistenza" state="Con dati" claude="Reperibilità FAQ vs contatto umano.">
            <PhoneFrame><HelpMock /></PhoneFrame>
          </Card>
        </Section>

        <Section id="ristoratore" title="Schermate ristoratore">
          <Card title="Dashboard ristoratore" role="Ristoratore" route="/dashboard" goal="Riepilogo annunci, crediti, candidature." actions="Ricarica crediti, apri annuncio" state="Con dati" claude="Priorità crediti vs KPI operativi.">
            <PhoneFrame><RestDashMock /></PhoneFrame>
          </Card>
          <Card title="Profilo locale" role="Ristoratore" route="/profile" goal="Vetrina del locale." actions="Modifica" state="Con dati" claude="Fiducia lato lavoratore, foto e recensioni evidenti.">
            <PhoneFrame><RestProfileMock /></PhoneFrame>
          </Card>
          <Card title="Pubblicazione annuncio" role="Ristoratore" route="/announcements/new" goal="Wizard creazione annuncio." actions="Continua" state="Wizard step 3/5" claude="Numero step, back senza perdere dati, chiarezza tariffa.">
            <PhoneFrame><NewAnnouncementMock /></PhoneFrame>
          </Card>
          <Card title="Elenco annunci" role="Ristoratore" route="/announcements" goal="Stato annunci pubblicati." actions="Pubblica nuovo" state="Con dati" claude="Distinzione stati (aperto/completo/scaduto).">
            <PhoneFrame><AnnouncementsListMock /></PhoneFrame>
          </Card>
          <Card title="Candidature ricevute" role="Ristoratore" route="/announcements/$id" goal="Gestione candidature." actions="Accetta, Rifiuta" state="Con dati" claude="Rapidità azione + qualità info visibili prima del match.">
            <PhoneFrame><CandidaturesMock /></PhoneFrame>
          </Card>
          <Card title="Dettaglio candidatura" role="Ristoratore" route="/announcements/$id" goal="Info anonimizzate + azione." actions="Accetta, Rifiuta" state="Privacy bloccata" claude="Bilanciamento privacy vs info utili alla decisione.">
            <PhoneFrame><CandidatureDetailMock /></PhoneFrame>
          </Card>
          <Card title="Ricerca lavoratori" role="Ristoratore" route="/workers" goal="Trovare lavoratori disponibili." actions="Invita" state="Con dati" claude="Efficacia filtri, coerenza card lavoratore.">
            <PhoneFrame><WorkerSearchMock /></PhoneFrame>
          </Card>
          <Card title="Dettaglio lavoratore" role="Ristoratore" route="/workers/$id" goal="Profilo pubblico anonimizzato." actions="Invita" state="Privacy bloccata" claude="Placeholder identità coerente ovunque.">
            <PhoneFrame><WorkerDetailMock /></PhoneFrame>
          </Card>
          <Card title="Invito con tariffa" role="Ristoratore" route="/workers/$id" goal="Proposta tariffa + messaggio." actions="Invia proposta" state="Editing" claude="Suggerimenti tariffa e chiarezza calcolo compenso.">
            <PhoneFrame><InvitePropMock /></PhoneFrame>
          </Card>
          <Card title="Turni confermati" role="Ristoratore" route="/shifts" goal="Vista turni confermati." actions="Contatto, annulla" state="Confermato" claude="Rapidità contatto lavoratore.">
            <PhoneFrame><ShiftsMock status="confermato" /></PhoneFrame>
          </Card>
          <Card title="Turni completati" role="Ristoratore" route="/shifts" goal="Storico e recensioni." actions="Lascia recensione" state="Completato" claude="Reminder recensione senza pressione eccessiva.">
            <PhoneFrame><ShiftsMock status="completato" /></PhoneFrame>
          </Card>
          <Card title="Turni annullati" role="Ristoratore" route="/shifts" goal="Storico annullamenti." actions="—" state="Annullato" claude="Neutralità visiva.">
            <PhoneFrame><ShiftsMock status="annullato" /></PhoneFrame>
          </Card>
          <Card title="Crediti e piani" role="Ristoratore" route="/billing" goal="Ricarica e piani abbonamento." actions="Attiva piano" state="Con dati" claude="Trasparenza prezzo/valore, gerarchia piani.">
            <PhoneFrame><BillingMock /></PhoneFrame>
          </Card>
          <Card title="Recensioni" role="Ristoratore" route="/ristoratore/recensioni" goal="Ricevute + da lasciare." actions="Lascia recensione" state="Con dati + banner" claude="Chiarezza obbligo recensione.">
            <PhoneFrame><RestReviewsMock /></PhoneFrame>
          </Card>
          <Card title="Chat ristoratore" role="Ristoratore" route="/messages/$id" goal="Coordinamento turno." actions="Scrivi" state="Con dati" claude="Coerenza layout con lato lavoratore.">
            <PhoneFrame><ChatMock /></PhoneFrame>
          </Card>
          <Card title="Notifiche ristoratore" role="Ristoratore" route="/notifications" goal="Nuove candidature + reminder." actions="Apri" state="Con notifiche" claude="Prioritizzazione notifiche di business.">
            <PhoneFrame><NotificationsMock /></PhoneFrame>
          </Card>
          <Card title="Impostazioni ristoratore" role="Ristoratore" route="/profile" goal="Gestione account." actions="Modifica" state="Con dati" claude="Coerenza layout con lato lavoratore.">
            <PhoneFrame><SettingsMock /></PhoneFrame>
          </Card>
          <Card title="Onboarding ristoratore" role="Ristoratore" route="/onboarding" goal="Setup locale." actions="Continua" state="Wizard" claude="Passi ridotti al minimo indispensabile.">
            <PhoneFrame><OnboardingMock /></PhoneFrame>
          </Card>
          <Card title="Help / Supporto" role="Ristoratore" route="/profile" goal="FAQ + assistenza." actions="Contatta" state="Con dati" claude="Voci specifiche per ristoratore.">
            <PhoneFrame><HelpMock /></PhoneFrame>
          </Card>
        </Section>

        <Section id="stati" title="Stati critici">
          <Card title="Empty dashboard" role="Lavoratore" route="/dashboard" goal="Guidare all'azione." actions="Cerca offerte" state="Vuoto" claude="Illustrazione + CTA.">
            <PhoneFrame><WorkerDashEmptyMock /></PhoneFrame>
          </Card>
          <Card title="Nessuna candidatura" role="Ristoratore" route="/announcements/$id" goal="Empty state candidature." actions="Condividi annuncio" state="Vuoto" claude="Coping strategy per attesa.">
            <PhoneFrame>
              <div>
                <TopBar title="Candidature" />
                <div className="h-40 grid place-items-center text-center text-neutral-500 text-[11px]">
                  <div><div className="text-3xl mb-1">🕐</div>Ancora nessuna candidatura</div>
                </div>
                <Btn primary>Condividi annuncio</Btn>
              </div>
            </PhoneFrame>
          </Card>
          <Card title="Nessuna disponibilità" role="Lavoratore" route="/availability" goal="Prompt impostazione." actions="Aggiungi disponibilità" state="Vuoto" claude="Impatto sul matching comunicato chiaramente.">
            <PhoneFrame>
              <div>
                <TopBar title="Disponibilità" />
                <div className="h-40 grid place-items-center text-center text-neutral-500 text-[11px]">
                  <div><div className="text-3xl mb-1">📅</div>Nessuna disponibilità impostata</div>
                </div>
                <Btn primary>Aggiungi disponibilità</Btn>
              </div>
            </PhoneFrame>
          </Card>
          <Card title="Loading" role="Sistema" route="—" goal="Feedback attesa." actions="—" state="Loading" claude="Skeleton vs spinner, tempi percepiti.">
            <PhoneFrame>
              <div>
                <TopBar title="Offerte" />
                {[1,2,3].map((n) => (
                  <div key={n} className="rounded-lg border border-neutral-200 p-2 mb-2 animate-pulse">
                    <div className="h-2 w-2/3 bg-neutral-200 rounded mb-2" />
                    <div className="h-2 w-1/2 bg-neutral-100 rounded" />
                  </div>
                ))}
              </div>
            </PhoneFrame>
          </Card>
          <Card title="Errore" role="Sistema" route="—" goal="Comunicazione errore." actions="Riprova" state="Errore" claude="Messaggi comprensibili senza jargon.">
            <PhoneFrame>
              <div>
                <TopBar title="Errore" />
                <div className="rounded border border-red-300 bg-red-50 p-3 text-[11px] text-red-800">
                  Qualcosa è andato storto. Riprova più tardi.
                </div>
                <div className="mt-3"><Btn primary>Riprova</Btn></div>
              </div>
            </PhoneFrame>
          </Card>
          <Card title="Successo" role="Sistema" route="—" goal="Conferma esito positivo." actions="OK" state="Successo" claude="Feedback affermativo e chiaro.">
            <PhoneFrame>
              <div className="h-full grid place-items-center text-center">
                <div>
                  <div className="text-4xl">✅</div>
                  <div className="font-semibold mt-2">Operazione completata</div>
                  <div className="text-[11px] text-neutral-500">La tua candidatura è stata inviata.</div>
                </div>
              </div>
            </PhoneFrame>
          </Card>
          <Card title="Privacy bloccata" role="Lavoratore" route="/announcements/$id" goal="Nascondere dati sensibili." actions="Candidati" state="Privacy bloccata" claude="Coerenza placeholder tra card, chat, mappa.">
            <PhoneFrame><AnnouncementDetailMock /></PhoneFrame>
          </Card>
          <Card title="Privacy sbloccata" role="Lavoratore" route="/shifts" goal="Dati completi dopo conferma." actions="Chiama, apri mappa" state="Privacy sbloccata" claude="Timing dello sblocco rispetto alle aspettative.">
            <PhoneFrame><ShiftsMock status="confermato" /></PhoneFrame>
          </Card>
          <Card title="Recensione da lasciare" role="Lavoratore" route="/reviews/$id" goal="Reminder blind." actions="Lascia recensione" state="Recensione da lasciare" claude="Comunicazione blind reciprocal.">
            <PhoneFrame><ReviewsMock variant="da-lasciare" /></PhoneFrame>
          </Card>
          <Card title="Recensione lasciata" role="Lavoratore" route="/reviews/$id" goal="Storico." actions="—" state="Recensione lasciata" claude="Feedback post-invio recensione.">
            <PhoneFrame><ReviewsMock variant="ricevute" /></PhoneFrame>
          </Card>
          <Card title="Notifiche presenti" role="Lavoratore" route="/notifications" goal="Centro notifiche popolato." actions="Apri notifica" state="Con notifiche" claude="Distinzione notifiche urgenti vs informative.">
            <PhoneFrame><NotificationsMock /></PhoneFrame>
          </Card>
          <Card title="Nessuna notifica" role="Lavoratore" route="/notifications" goal="Empty state neutro." actions="—" state="Vuoto" claude="Efficacia empty state neutro.">
            <PhoneFrame><NotificationsMock empty /></PhoneFrame>
          </Card>
        </Section>

        <Section id="popup" title="Popup, modali e componenti">
          <Card title="Guida iniziale" role="Sistema" route="/dashboard" goal="Tour guidato." actions="Salta, Inizia" state="Popup" claude="Timing e possibilità di skip.">
            <PhoneFrame><GuidedTourPopup /></PhoneFrame>
          </Card>
          <Card title="Conferma turno" role="Ristoratore" route="/shifts" goal="Conferma con scarico credito." actions="Conferma" state="Popup" claude="Trasparenza costo credito.">
            <PhoneFrame><ConfirmShiftPopup /></PhoneFrame>
          </Card>
          <Card title="Annullamento turno" role="Entrambi" route="/shifts" goal="Motivare annullamento." actions="Annulla turno" state="Popup" claude="Distruttività dell'azione.">
            <PhoneFrame><CancelShiftPopup /></PhoneFrame>
          </Card>
          <Card title="Candidatura inviata" role="Lavoratore" route="/announcements/$id" goal="Feedback invio." actions="OK" state="Popup" claude="Chiarezza next step.">
            <PhoneFrame><AppliedPopup /></PhoneFrame>
          </Card>
          <Card title="Offerta ricevuta" role="Lavoratore" route="/dashboard" goal="Notifica invito diretto." actions="Vedi" state="Popup" claude="Interruzione contestuale accettabile.">
            <PhoneFrame><OfferReceivedPopup /></PhoneFrame>
          </Card>
          <Card title="Popup errore" role="Sistema" route="—" goal="Comunicare errore." actions="Chiudi" state="Popup" claude="Chiarezza tecnica vs colloquiale.">
            <PhoneFrame><ErrorPopup /></PhoneFrame>
          </Card>
          <Card title="Popup successo" role="Sistema" route="/billing" goal="Feedback successo." actions="Ottimo" state="Popup" claude="Tempismo e tono.">
            <PhoneFrame><SuccessPopup /></PhoneFrame>
          </Card>
          <Card title="Popup recensione" role="Entrambi" route="/reviews/$id" goal="Blind reciprocal review." actions="Invia recensione" state="Popup" claude="Chiarezza scala rating + testo opzionale.">
            <PhoneFrame><ReviewPopup /></PhoneFrame>
          </Card>
          <Card title="Crediti insufficienti" role="Ristoratore" route="/announcements/$id" goal="Blocco conferma." actions="Attiva Basic, Vedi piani" state="Popup" claude="Conversione vs frustrazione.">
            <PhoneFrame><CreditsPopup /></PhoneFrame>
          </Card>
          <Card title="Toast notifica" role="Sistema" route="—" goal="Feedback breve." actions="—" state="Toast" claude="Durata e leggibilità.">
            <PhoneFrame><ToastMock /></PhoneFrame>
          </Card>
          <Card title="Alert / banner" role="Sistema" route="—" goal="Comunicazioni persistenti." actions="—" state="Alert" claude="Distinzione toni (rosso/ambra/blu).">
            <PhoneFrame><AlertMock /></PhoneFrame>
          </Card>
          <Card title="Badge, label, bottoni" role="Sistema" route="—" goal="Design tokens." actions="—" state="Showcase" claude="Coerenza cromatica e tipografica.">
            <PhoneFrame><BadgesMock /></PhoneFrame>
          </Card>
          <Card title="Card ricorrenti" role="Sistema" route="—" goal="Card turno / lavoratore / ristorante / recensione / disponibilità." actions="—" state="Showcase" claude="Coerenza tra card usate in contesti diversi.">
            <PhoneFrame><CardsShowcaseMock /></PhoneFrame>
          </Card>
          <Card title="Menu mobile" role="Sistema" route="—" goal="Menu laterale." actions="Naviga" state="Popup" claude="Chiarezza voci e ordine.">
            <PhoneFrame><MobileMenuMock /></PhoneFrame>
          </Card>
        </Section>

        <section id="desktop" className="audit-section mt-10">
          <h2 className="text-xl font-bold border-b border-neutral-300 pb-2 mb-6">Versione desktop</h2>
          <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
            <Card title="Homepage" role="Pubblico" route="/" goal="Landing." actions="Registrati" state="Con dati" claude="Hero, gerarchia CTA."><DesktopFrame><DesktopHome /></DesktopFrame></Card>
            <Card title="Dashboard lavoratore" role="Lavoratore" route="/dashboard" goal="KPI + prossimi turni." actions="Apri" state="Con dati" claude="Uso dello spazio orizzontale."><DesktopFrame><DesktopWorkerDash /></DesktopFrame></Card>
            <Card title="Dashboard ristoratore" role="Ristoratore" route="/dashboard" goal="KPI operativi." actions="Ricarica crediti" state="Con dati" claude="Priorità crediti + KPI."><DesktopFrame><DesktopRestDash /></DesktopFrame></Card>
            <Card title="Ricerca offerte" role="Lavoratore" route="/browse" goal="Sfogliare offerte." actions="Filtra" state="Con dati" claude="Densità informazioni desktop."><DesktopFrame><DesktopBrowse /></DesktopFrame></Card>
            <Card title="Ricerca lavoratori" role="Ristoratore" route="/workers" goal="Grid lavoratori." actions="Invita" state="Con dati" claude="Coerenza card con mobile."><DesktopFrame><DesktopWorkerSearch /></DesktopFrame></Card>
            <Card title="Chat" role="Entrambi" route="/messages" goal="Inbox + thread." actions="Scrivi" state="Con dati" claude="Split-view efficace."><DesktopFrame><DesktopChat /></DesktopFrame></Card>
            <Card title="Profilo lavoratore" role="Lavoratore" route="/profile" goal="Profilo pubblico." actions="Modifica" state="Con dati" claude="Fiducia lato ristoratore."><DesktopFrame><DesktopWorkerProfile /></DesktopFrame></Card>
            <Card title="Profilo locale" role="Ristoratore" route="/profile" goal="Vetrina locale." actions="Modifica" state="Con dati" claude="Impatto visivo."><DesktopFrame><DesktopRestProfile /></DesktopFrame></Card>
            <Card title="Dettaglio turno" role="Entrambi" route="/shifts" goal="Info complete post-conferma." actions="Contatta" state="Confermato" claude="Utilità informazioni di contatto."><DesktopFrame><DesktopShiftDetail /></DesktopFrame></Card>
          </div>
        </section>

        <footer className="mt-16 pt-6 border-t border-neutral-300 text-xs text-neutral-500">
          <p>
            Pupillo Visual Audit Pack · Dati fittizi a scopo dimostrativo · Nessuna logica dell'app è stata modificata.
            Salva questa pagina come PDF (Cmd/Ctrl+P) e caricala su Claude insieme a{" "}
            <code>PUPILLO_VISUAL_AUDIT_INDEX.md</code> e <code>PUPILLO_CLAUDE_AUDIT_PACK.md</code>.
          </p>
        </footer>
      </div>
    </div>
  );
}