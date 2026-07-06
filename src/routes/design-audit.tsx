import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";

export const Route = createFileRoute("/design-audit")({
  head: () => ({
    meta: [
      { title: "Design Audit — Pupillo" },
      { name: "description", content: "Panoramica ordinata di tutte le schermate e i componenti di Pupillo per audit UX/UI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignAuditPage,
});

type Screen = { path: string; label: string; note?: string };

const PUBLIC_SCREENS: Screen[] = [
  { path: "/", label: "Homepage" },
  { path: "/come-funziona", label: "Come funziona" },
  { path: "/auth", label: "Login / Registrazione" },
  { path: "/reset-password", label: "Reset password" },
  { path: "/registration-success", label: "Registrazione completata" },
  { path: "/verify-phone", label: "Verifica telefono" },
  { path: "/terms", label: "Termini e privacy" },
  { path: "/forbidden", label: "Accesso negato" },
  { path: "/account-error", label: "Errore account" },
];

const WORKER_SCREENS: Screen[] = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/profile", label: "Profilo" },
  { path: "/onboarding", label: "Onboarding" },
  { path: "/availability", label: "Disponibilità" },
  { path: "/browse", label: "Ricerca offerte" },
  { path: "/mappa", label: "Mappa" },
  { path: "/jobs", label: "Offerte ricevute" },
  { path: "/shifts", label: "Turni" },
  { path: "/messages", label: "Messaggi" },
  { path: "/notifications", label: "Notifiche" },
  { path: "/ristoratori", label: "Ristoratori" },
];

const RESTAURANT_SCREENS: Screen[] = [
  { path: "/dashboard", label: "Dashboard ristoratore" },
  { path: "/profile", label: "Profilo locale" },
  { path: "/announcements", label: "Annunci" },
  { path: "/announcements/new", label: "Nuovo annuncio" },
  { path: "/workers", label: "Ricerca lavoratori" },
  { path: "/ristoratore/collaboratori", label: "Collaboratori" },
  { path: "/ristoratore/recensioni", label: "Recensioni" },
  { path: "/billing", label: "Piani e crediti" },
  { path: "/shifts", label: "Turni" },
];

const COMPONENTS: { name: string; role: string }[] = [
  { name: "InsufficientCreditsDialog", role: "Popup crediti insufficienti" },
  { name: "CancelShiftDialog", role: "Annullamento turno" },
  { name: "WorkerSelfCancelledDialog", role: "Auto-annullamento lavoratore" },
  { name: "WorkerIncidentDialogs", role: "Segnalazione no-show / incidente" },
  { name: "BlindReciprocalReviewDialog", role: "Recensione reciproca cieca" },
  { name: "RequestReviewRevisionDialog", role: "Richiesta revisione recensione" },
  { name: "AlreadyInContactDialog", role: "Blocco doppia candidatura" },
  { name: "BlockedContactDialog", role: "Blocco per recensioni scadute" },
  { name: "CounterofferDialog", role: "Controproposta tariffa/data" },
  { name: "DeleteAccountDialog", role: "Eliminazione account" },
  { name: "WorkerProfilePreviewDialog", role: "Profilo worker in modale" },
  { name: "SaveToFavoritesPrompt", role: "Salva annuncio nei preferiti" },
  { name: "RequiredReviewsBanner", role: "Banner recensioni obbligatorie" },
  { name: "ProfileStatusBanner", role: "Profilo incompleto" },
  { name: "OnboardingStatusCard", role: "Stato onboarding" },
  { name: "NotificationBell", role: "Notifiche in header" },
  { name: "StalePreviewOverlay", role: "Overlay build vecchia" },
  { name: "PaymentTestModeBanner", role: "Stripe test mode" },
  { name: "WorkerContactCard", role: "Contatti worker (post-conferma)" },
  { name: "WorkerReputationBadge", role: "Badge reputazione" },
  { name: "ConfirmedWorkerCard", role: "Card turno confermato" },
  { name: "RestaurantReputationCard", role: "Card reputazione locale" },
  { name: "RestaurantRequirements", role: "Requisiti annuncio" },
  { name: "AppShell", role: "Layout con header + bottom nav mobile" },
];

function ScreenGrid({ screens }: { screens: Screen[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {screens.map((s) => (
        <div key={s.path} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div>
              <div className="text-sm font-semibold">{s.label}</div>
              <code className="text-xs text-muted-foreground">{s.path}</code>
            </div>
            <a
              href={s.path}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              apri
            </a>
          </div>
          <div className="relative bg-muted" style={{ aspectRatio: "9 / 16" }}>
            <iframe
              src={s.path}
              title={s.label}
              className="absolute inset-0 w-full h-full"
              loading="lazy"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
          {s.note ? <div className="p-2 text-xs text-muted-foreground">{s.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function DesignAuditPage() {
  return (
    <RequireAuth>
      <RequireRole allow={["admin"]}>
        <AppShell>
          <div className="max-w-6xl mx-auto p-4 space-y-8">
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold">Pupillo — Design Audit</h1>
              <p className="text-sm text-muted-foreground">
                Panoramica visiva ordinata delle schermate e dei componenti principali. Le anteprime sono
                caricate in iframe e mostrano lo stato reale dell'app per la sessione corrente.
              </p>
              <p className="text-sm">
                Riferimento testuale completo:{" "}
                <code className="text-xs">PUPILLO_CLAUDE_AUDIT_PACK.md</code> nella root del progetto.
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">1. Schermate pubbliche</h2>
              <ScreenGrid screens={PUBLIC_SCREENS} />
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">2. Schermate lavoratore</h2>
              <ScreenGrid screens={WORKER_SCREENS} />
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">3. Schermate ristoratore</h2>
              <ScreenGrid screens={RESTAURANT_SCREENS} />
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">4. Componenti / popup ricorrenti</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {COMPONENTS.map((c) => (
                  <div key={c.name} className="flex items-start justify-between px-4 py-3 text-sm">
                    <code className="font-mono text-primary">{c.name}</code>
                    <span className="text-muted-foreground text-right ml-4">{c.role}</span>
                  </div>
                ))}
              </div>
            </section>

            <footer className="text-xs text-muted-foreground pt-6 border-t border-border">
              Pagina di sola documentazione. Nessuna logica di prodotto è modificata.
            </footer>
          </div>
        </AppShell>
      </RequireRole>
    </RequireAuth>
  );
}