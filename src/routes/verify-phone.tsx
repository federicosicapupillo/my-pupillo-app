import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy URL: verification now lives only in the profile-completion form.
export const Route = createFileRoute("/verify-phone")({
  head: () => ({ meta: [
    { title: "Conferma email — Pupillo" },
    { name: "description", content: "Conferma la tua email e completa il profilo Pupillo." },
    { property: "og:title", content: "Conferma email — Pupillo" },
    { property: "og:description", content: "Conferma la tua email e completa il profilo Pupillo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { phase?: "code" } => ({ phase: s.phase === "code" ? "code" : undefined }),
  component: () => <Navigate to="/onboarding" replace />,
});
