import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Toaster } from "sonner";
import { PhoneVerificationGate } from "@/components/PhoneVerificationGate";
import { ProfileGateProvider } from "@/components/ProfileGate";
import { StalePreviewOverlay } from "@/components/StalePreviewOverlay";
import { installServerFnAuthFetch } from "@/lib/server-fn-auth";
import { DevLoopMonitor } from "@/lib/dev-loop-monitor";
import { SiteAccessGate } from "@/components/SiteAccessGate";

installServerFnAuthFetch();

function NotFoundComponent() {
  // Role-aware 404: lavoratore e ristoratore ricevono pulsanti utili
  // verso le loro sezioni principali invece di un semplice "Go home".
  const { role } = useAuth();
  const isWorker = role === "worker";
  const isRestaurant = role === "restaurant";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Questa notifica non è più disponibile o il turno collegato non esiste più.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {isWorker ? (
            <>
              <Link to="/jobs" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Torna alle offerte</Link>
              <Link to="/shifts" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Vai ai miei turni</Link>
              <Link to="/dashboard" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Vai alla dashboard</Link>
            </>
          ) : isRestaurant ? (
            <>
              <Link to="/dashboard" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Torna alla dashboard</Link>
              <Link to="/announcements" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Vai agli annunci</Link>
            </>
          ) : (
            <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Vai alla home</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Ricerca personale extra mondo della ristorazione" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Ricerca personale extra mondo della ristorazione" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Ricerca personale extra mondo della ristorazione" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d9816446-7506-4922-acc2-0720cca747ab/id-preview-0b1c71c7--81341205-eede-4204-8584-66229ea985c7.lovable.app-1778140506695.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d9816446-7506-4922-acc2-0720cca747ab/id-preview-0b1c71c7--81341205-eede-4204-8584-66229ea985c7.lovable.app-1778140506695.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pupillo-theme');var c=document.documentElement.classList;if(t==='light'){c.add('light');c.remove('dark');}else{c.add('dark');c.remove('light');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteAccessGate>
        <AuthProvider>
          <AccountAccessGate>
            <PhoneVerificationGate>
              <ProfileGateProvider>
                <Outlet />
              </ProfileGateProvider>
            </PhoneVerificationGate>
          </AccountAccessGate>
          <Toaster richColors position="top-right" />
          <StalePreviewOverlay />
          {import.meta.env.DEV ? <DevLoopMonitor /> : null}
        </AuthProvider>
      </SiteAccessGate>
    </QueryClientProvider>
  );
}

function AccountAccessGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, extrasLoaded } = useAuth();
  const isDeleted = Boolean(profile?.is_deleted || profile?.deleted_at);
  if (loading || (user && (!extrasLoaded || isDeleted))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Caricamento…
      </div>
    );
  }
  return <>{children}</>;
}
