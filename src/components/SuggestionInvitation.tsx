import { Link } from "@tanstack/react-router";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuggestionInvitation() {
  return <section className="pupillo-highlight my-8 grid min-w-0 gap-4 px-5 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6" aria-label="Suggerimenti per Pupillo">
    <h2 className="flex items-center gap-3 text-xl font-bold"><Lightbulb className="size-6 shrink-0 text-pack-highlight" aria-hidden="true" />Hai un suggerimento per Pupillo?</h2>
    <Link to="/suggerimenti" className="justify-self-start"><Button className="gap-2 bg-pack-highlight text-pack-highlight-foreground hover:bg-pack-highlight/90">Invia un suggerimento<ArrowRight className="size-4" aria-hidden="true" /></Button></Link>
  </section>;
}