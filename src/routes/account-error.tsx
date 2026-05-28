import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { routeForRole, useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account-error")({
  head: () => ({ meta: [{ title: "Ruolo non configurato — Pupillo" }] }),
  component: AccountErrorPage,
});

function AccountErrorPage() {
  const { user, role, profile, roleDebug, signOut, refresh, extrasLoaded } = useAuth();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;
  const finalRole = role ?? roleDebug?.final_role ?? null;
  const finalRoute = routeForRole(finalRole);

  // If a role IS already resolved (e.g. after a refresh / fallback to
  // profiles.primary_role kicked in), don't keep the user stuck here.
  useEffect(() => {
    if (!extrasLoaded) return;
    console.info("[PUPILLO_ROLE_FINAL_DEBUG] account-error decision", {
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      profile_role: roleDebug?.profile_role ?? (profile as any)?.primary_role ?? null,
      user_role: roleDebug?.user_role ?? null,
      metadata_role: roleDebug?.metadata_role ?? ((user?.user_metadata?.role as string | null | undefined) ?? null),
      profile_error: roleDebug?.profile_error ?? null,
      user_roles_error: roleDebug?.user_roles_error ?? null,
      rpc_error: roleDebug?.rpc_error ?? null,
      final_role: finalRole,
      final_route: finalRoute,
    });
    if (finalRole) navigate({ to: finalRoute as any, replace: true });
  }, [user, roleDebug, profile, finalRole, finalRoute, extrasLoaded, navigate]);

  const retry = async () => {
    await refresh();
    const nextRoute = routeForRole(role ?? roleDebug?.final_role ?? null);
    if (nextRoute !== "/account-error") navigate({ to: nextRoute as any });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Ruolo account non configurato</h1>
        <p className="text-sm text-muted-foreground">
          Il tuo account esiste ma non ha ancora un ruolo assegnato (lavoratore, ristoratore o admin).
          Probabilmente è successo dopo un ripristino dei dati. Contatta l'assistenza per ripristinare l'accesso.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={retry} variant="default">Riprova</Button>
          <Link to="/" className="text-center text-sm text-muted-foreground hover:text-foreground">
            Torna alla home
          </Link>
          <a
            href="mailto:assistenza@pupillo.life?subject=Ruolo%20account%20non%20configurato"
            className="text-center text-sm text-primary hover:underline"
          >
            Contatta l'assistenza
          </a>
          <Button variant="outline" onClick={() => void signOut({ redirectTo: "/auth" })}>
            Esci
          </Button>
        </div>
        {isDev && (
          <pre className="mt-4 text-xs bg-muted p-3 rounded overflow-auto">
{JSON.stringify({
  user_id: user?.id ?? null,
  email: user?.email ?? null,
  role,
  final_role: finalRole,
  final_route: finalRoute,
  has_profile: !!profile,
  profile_role: roleDebug?.profile_role ?? (profile as any)?.primary_role ?? null,
  user_role: roleDebug?.user_role ?? null,
  metadata_role: roleDebug?.metadata_role ?? ((user?.user_metadata?.role as string | null | undefined) ?? null),
  profile_error: roleDebug?.profile_error ?? null,
  user_roles_error: roleDebug?.user_roles_error ?? null,
  rpc_error: roleDebug?.rpc_error ?? null,
  user_roles_rows: roleDebug?.user_roles_rows ?? [],
  profile_completed: profile?.profile_completed ?? null,
}, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}