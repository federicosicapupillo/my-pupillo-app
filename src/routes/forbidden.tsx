import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [
      { title: "Accesso negato — Pupillo" },
      { name: "description", content: "Non hai i permessi per accedere a questa pagina." },
    ],
  }),
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const homePath =
    role === "admin" ? "/admin" : role === "restaurant" ? "/dashboard" : role === "worker" ? "/jobs" : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Accesso negato</h1>
          <p className="text-muted-foreground">
            Non hai i permessi per accedere a questa pagina con il tuo ruolo attuale
            {role ? ` (${role})` : ""}.
          </p>
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={() => navigate({ to: homePath })}>Vai alla home</Button>
          <Button variant="outline" asChild>
            <Link to="/auth">Cambia account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}