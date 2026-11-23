import { createFileRoute, Link } from "@tanstack/react-router";
import pupilloLogoAsset from "@/assets/pupillo-logo-completo.png.asset.json";
import { ScrollStory } from "@/components/demo/ScrollStory";

export const Route = createFileRoute("/demo-home")({
  head: () => ({
    meta: [
      { title: "Demo homepage animata — Pupillo" },
      { name: "description", content: "Prototipo interno della homepage Pupillo con animazioni allo scroll." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Demo homepage animata — Pupillo" },
      { property: "og:description", content: "Prototipo interno con dati di esempio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoHome,
});

function DemoHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-muted px-4 py-2 text-center text-xs font-semibold text-muted-foreground">
        Prototipo interno · dati di esempio · non è la homepage pubblica
      </div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" aria-label="Home Pupillo"><img src={pupilloLogoAsset.url} alt="Pupillo" className="h-12 w-auto" /></Link>
        <Link to="/auth" className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold hover:bg-muted">Accedi</Link>
      </header>
      <ScrollStory />
    </div>
  );
}
