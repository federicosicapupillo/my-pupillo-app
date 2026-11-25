import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper: `supabase.auth.oauth` is beta and may lack types.
type OAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: {
      client?: { name?: string; client_uri?: string } | null;
      redirect_url?: string;
      redirect_to?: string;
    } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};

function oauthNS() {
  return (supabase.auth as unknown as { oauth: OAuthNS }).oauth;
}

const ACADEMY_CLIENT_ID = "26176f21-41c5-439a-bf3e-6cc2870f5293";
/** Pupillo Academy è un servizio Pupillo: accesso diretto senza schermata di consenso. */
function isTrustedAcademyClient(data: unknown): boolean {
  const d = data as { client?: { id?: string; client_id?: string } | null; redirect_uri?: string } | null;
  const id = d?.client?.id ?? d?.client?.client_id;
  if (id !== ACADEMY_CLIENT_ID) return false;
  try { return !d?.redirect_uri || new URL(d.redirect_uri).hostname.endsWith("supabase.co") || new URL(d.redirect_uri).hostname === "accademy.pupillo.life"; } catch { return false; }
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNS().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    if (isTrustedAcademyClient(data)) {
      const approved = await oauthNS().approveAuthorization(authorizationId);
      const target = approved.data?.redirect_url ?? approved.data?.redirect_to;
      if (!approved.error && target) throw redirect({ href: target });
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-sm">
      Impossibile caricare la richiesta di autorizzazione: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "un'applicazione esterna";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const ns = oauthNS();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorization_id)
      : await ns.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Il server di autorizzazione non ha restituito un URL di ritorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Collega {clientName} a Pupillo</h1>
      <p className="text-sm text-muted-foreground">
        Autorizzando, {clientName} potrà usare Pupillo a nome tuo: leggere i tuoi turni, notifiche e cercare
        annunci, secondo i tuoi permessi.
      </p>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Autorizza
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="inline-flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Rifiuta
        </button>
      </div>
    </main>
  );
}