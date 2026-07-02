import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/claude-visual-audit")({
  head: () => ({
    meta: [
      { title: "Pupillo — Visual Audit Pack" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VisualAudit,
});

type Shot = {
  n: string;
  title: string;
  role: "Pubblico" | "Lavoratore" | "Ristoratore" | "Admin" | "Sistema";
  route: string;
  state: string;
  file: string; // base filename without -mobile/-desktop.png
  notes: string[];
  authRequired?: boolean;
};

const SHOTS: Shot[] = [
  { n: "01", title: "Homepage", role: "Pubblico", route: "/", state: "default", file: "01-home",
    notes: ["Chiarezza value proposition", "Gerarchia CTA", "Fiducia percepita", "Leggibilità mobile"] },
  { n: "02", title: "Come funziona", role: "Pubblico", route: "/come-funziona", state: "default", file: "02-come-funziona",
    notes: ["Chiarezza flusso in 3 step", "Differenziazione lavoratore/ristoratore", "CTA finale"] },
  { n: "03", title: "Login / Registrazione", role: "Pubblico", route: "/auth", state: "default", file: "03-auth-login",
    notes: ["Chiarezza login/registrazione", "Leggibilità form", "Contrasto bottoni", "Recupero password visibile"] },
  { n: "04", title: "Recupero password", role: "Pubblico", route: "/reset-password", state: "default", file: "04-reset-password",
    notes: ["Chiarezza istruzioni", "Feedback dopo invio email"] },
  { n: "05", title: "Termini di servizio", role: "Pubblico", route: "/terms", state: "default", file: "05-terms",
    notes: ["Leggibilità testo lungo", "Gerarchia titoli"] },
  { n: "06", title: "Registrazione completata", role: "Pubblico", route: "/registration-success", state: "success", file: "06-registration-success",
    notes: ["Chiarezza next step", "Emozione post-registrazione"] },
  { n: "07", title: "Accesso negato", role: "Sistema", route: "/forbidden", state: "error", file: "07-forbidden",
    notes: ["Tono messaggio", "Percorso di recupero"] },
  { n: "08", title: "Errore account", role: "Sistema", route: "/account-error", state: "error", file: "08-account-error",
    notes: ["Chiarezza errore", "Azioni disponibili"] },

  { n: "09", title: "Dashboard (redirect a login)", role: "Lavoratore", route: "/dashboard", state: "not-authenticated", file: "09-dashboard-redirect", authRequired: true,
    notes: ["Comportamento gate auth", "Da catturare manualmente dopo login come lavoratore"] },
  { n: "10", title: "Profilo (redirect a login)", role: "Lavoratore", route: "/profile", state: "not-authenticated", file: "10-profile-redirect", authRequired: true,
    notes: ["Da catturare manualmente dopo login"] },
  { n: "11", title: "Disponibilità (redirect a login)", role: "Lavoratore", route: "/availability", state: "not-authenticated", file: "11-availability-redirect", authRequired: true,
    notes: ["Da catturare manualmente dopo login lavoratore"] },
  { n: "12", title: "Ricerca offerte / Jobs", role: "Lavoratore", route: "/jobs", state: "not-authenticated", file: "12-jobs-redirect", authRequired: true,
    notes: ["Da catturare manualmente dopo login lavoratore"] },
  { n: "13", title: "Turni", role: "Lavoratore/Ristoratore", role_: undefined as never, ...({} as any) } as any,
];

// Rebuild the last few entries cleanly (avoid the placeholder above)
SHOTS.length = 12;
SHOTS.push(
  { n: "13", title: "Turni", role: "Lavoratore", route: "/shifts", state: "not-authenticated", file: "13-shifts-redirect", authRequired: true,
    notes: ["Turni confermati / completati / annullati", "Da catturare dopo login"] },
  { n: "14", title: "Messaggi", role: "Lavoratore", route: "/messages", state: "not-authenticated", file: "14-messages-redirect", authRequired: true,
    notes: ["Layout lista chat", "Contrasto messaggi"] },
  { n: "15", title: "Notifiche", role: "Lavoratore", route: "/notifications", state: "not-authenticated", file: "15-notifications-redirect", authRequired: true,
    notes: ["Chiarezza notifiche", "Stato letto/non letto"] },
  { n: "16", title: "Annunci (ristoratore)", role: "Ristoratore", route: "/announcements", state: "not-authenticated", file: "16-announcements-redirect", authRequired: true,
    notes: ["Lista annunci pubblicati", "CTA nuovo annuncio"] },
  { n: "17", title: "Browse offerte", role: "Lavoratore", route: "/browse", state: "not-authenticated", file: "17-browse-redirect", authRequired: true,
    notes: ["Card offerta", "Filtri e ricerca"] },
  { n: "18", title: "Mappa lavoratori/annunci", role: "Ristoratore", route: "/mappa", state: "not-authenticated", file: "18-mappa-redirect", authRequired: true,
    notes: ["Leggibilità mappa", "Pin e sanitized data"] },
  { n: "19", title: "Ricerca lavoratori", role: "Ristoratore", route: "/workers", state: "not-authenticated", file: "19-workers-redirect", authRequired: true,
    notes: ["Card lavoratore sanitizzata", "CTA invito diretto"] },
  { n: "20", title: "Crediti / Billing", role: "Ristoratore", route: "/billing", state: "not-authenticated", file: "20-billing-redirect", authRequired: true,
    notes: ["Chiarezza saldo crediti", "Bottone ricarica"] },
  { n: "21", title: "Onboarding", role: "Lavoratore/Ristoratore", route: "/onboarding", state: "not-authenticated", file: "21-onboarding-redirect", authRequired: true,
    notes: ["Chiarezza passi iniziali", "Percentuale completamento"] },
);

function ShotBlock({ s }: { s: Shot }) {
  const mobile = `/audit-screenshots/${s.file}-mobile.png`;
  const desktop = `/audit-screenshots/${s.file}-desktop.png`;
  return (
    <section
      className="audit-section"
      style={{
        pageBreakAfter: "always",
        breakAfter: "page",
        borderTop: "2px solid #000",
        padding: "32px 0",
      }}
    >
      <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "#000" }}>
        {s.n} — {s.title}
      </h2>
      <div style={{ fontSize: 14, color: "#111", marginBottom: 4 }}>
        <strong>Ruolo:</strong> {s.role} &nbsp;|&nbsp;
        <strong>Route:</strong> <code>{s.route}</code> &nbsp;|&nbsp;
        <strong>Stato:</strong> {s.state}
      </div>
      <div style={{ marginBottom: 16 }}>
        <a
          href={s.route}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#0645AD", textDecoration: "underline", fontSize: 14 }}
        >
          → Apri schermata reale ({s.route})
        </a>
        {s.authRequired && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: "#FFF8DC",
              border: "1px solid #E0C97F",
              fontSize: 13,
              color: "#000",
            }}
          >
            ⚠️ Route protetta: lo screenshot mostra il redirect al login perché la sessione
            non è disponibile lato server. Per l'audit reale: accedi come utente, apri la
            route, imposta viewport 412px (mobile) o 1280px (desktop), fai screenshot manuale
            e salvalo in <code>/public/audit-screenshots/{s.file}-mobile.png</code> (o
            <code> -desktop.png</code>).
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "#000" }}>
          Mobile — 412×900
        </h3>
        <img
          src={mobile}
          alt={`${s.title} mobile`}
          style={{
            width: "min(430px, 100%)",
            height: "auto",
            border: "1px solid #DDD",
            display: "block",
            background: "#fff",
          }}
          loading="lazy"
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "#000" }}>
          Desktop — 1280×1600
        </h3>
        <img
          src={desktop}
          alt={`${s.title} desktop`}
          style={{
            width: "100%",
            maxWidth: 1200,
            height: "auto",
            border: "1px solid #DDD",
            display: "block",
            background: "#fff",
          }}
          loading="lazy"
        />
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "#000" }}>
          Note da far valutare a Claude
        </h3>
        <ul style={{ margin: 0, paddingLeft: 22, color: "#000", fontSize: 14, lineHeight: 1.6 }}>
          {s.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function VisualAudit() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        color: "#000000",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        minHeight: "100vh",
      }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: #fff !important; }
          a { color: #000 !important; text-decoration: underline; }
          .audit-section { page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
        html, body { background: #fff !important; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px 80px" }}>
        <header
          style={{
            pageBreakAfter: "always",
            breakAfter: "page",
            paddingBottom: 32,
          }}
        >
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: 0, color: "#000" }}>
            Pupillo — Visual Audit Pack
          </h1>
          <p style={{ fontSize: 16, color: "#000", marginTop: 12, lineHeight: 1.6 }}>
            Pacchetto di screenshot reali delle schermate dell'app Pupillo, pensato per
            essere esportato in PDF e caricato su Claude per un audit di grafica, UX,
            navigabilità e coerenza visiva.
          </p>
          <ul style={{ fontSize: 14, color: "#000", marginTop: 16, lineHeight: 1.6 }}>
            <li>Sfondo bianco, testi neri, alta leggibilità.</li>
            <li>Una schermata per blocco, con anteprime grandi mobile + desktop.</li>
            <li>Page-break automatico tra sezioni per stampa/PDF pulito.</li>
            <li>Screenshot generati automaticamente via Playwright sulla build reale.</li>
            <li>
              Le route protette da auth mostrano il redirect al login. Per gli screenshot
              autenticati segui la guida in <code>PUPILLO_VISUAL_AUDIT_EXPORT_GUIDE.md</code>.
            </li>
          </ul>

          <div
            className="no-print"
            style={{
              marginTop: 24,
              padding: 16,
              border: "1px solid #000",
              background: "#F5F5F5",
              fontSize: 14,
              color: "#000",
            }}
          >
            <strong>Come esportare in PDF:</strong> Cmd/Ctrl + P → "Salva come PDF" →
            attiva "Grafica di sfondo" → formato A4 → salva. Poi carica il PDF su Claude.
          </div>
        </header>

        {SHOTS.map((s) => (
          <ShotBlock key={s.n} s={s} />
        ))}

        <footer style={{ marginTop: 40, fontSize: 12, color: "#000" }}>
          Fine del Visual Audit Pack — Pupillo.
        </footer>
      </div>
    </div>
  );
}