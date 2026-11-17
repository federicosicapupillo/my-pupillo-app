import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitSuggestion } from "@/lib/suggestions.functions";
import { suggestionSchema } from "@/lib/suggestions-schema";

export const Route = createFileRoute("/suggerimenti")({
  head: () => ({ meta: [
    { title: "Invia un suggerimento — Pupillo" },
    { name: "description", content: "Proponi idee e miglioramenti a Pupillo con un messaggio privato." },
    { property: "og:title", content: "Suggerimenti per Pupillo" },
    { property: "og:description", content: "Condividi un’idea per migliorare Pupillo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Suggestions,
});

function Suggestions() {
  const { user, loading } = useAuth();
  const send = useServerFn(submitSuggestion);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return <AppShell><div className="mx-auto max-w-xl">
    <Lightbulb className="mb-4 size-8 text-primary" aria-hidden="true" />
    <PageHeader title="Suggerimenti per Pupillo" />
    {loading ? <p role="status">Caricamento…</p> : !user ? <Link to="/auth"><Button>Accedi per inviare un suggerimento</Button></Link> : sent ? <div role="status" className="space-y-4"><p className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" />Suggerimento inviato. Grazie!</p><Button variant="outline" onClick={() => setSent(false)}>Invia un altro suggerimento</Button></div> : <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      const parsed = suggestionSchema.safeParse({ message });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Controlla il suggerimento."); return; }
      setError(""); setBusy(true);
      try { await send({ data: parsed.data }); setMessage(""); setSent(true); }
      catch (err) { setError(err instanceof Error ? err.message : "Invio non riuscito. Riprova."); }
      finally { setBusy(false); }
    }}>
      <Label htmlFor="suggestion-message">Il tuo suggerimento</Label>
      <Textarea id="suggestion-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required disabled={busy} className="min-h-48" aria-describedby="suggestion-privacy" />
      <p id="suggestion-privacy" className="text-sm text-muted-foreground">Il messaggio è privato e viene letto dagli amministratori di Pupillo.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="gap-2"><Send className="size-4" />{busy ? "Invio…" : "Invia suggerimento"}</Button>
    </form>}
  </div></AppShell>;
}