import type { ReactNode } from "react";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LegalFooter } from "@/components/LegalFooter";
import { LEGAL_DATE_LABEL, LEGAL_VERSION } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { user, role } = useAuth();
  const fallbackTo = !user ? "/" : role === "admin" ? "/admin" : "/profile";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to={fallbackTo} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">P</div>
            <span className="text-xl font-semibold">Pupillo</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versione {LEGAL_VERSION} · in vigore dal {LEGAL_DATE_LABEL}</p>
        <div className="mt-8 space-y-7 text-sm leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
        <div className="mt-10">
          <button
            type="button"
            onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: fallbackTo }))}
            className="text-sm text-primary underline"
          >
            ← Torna indietro
          </button>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function legalHead(path: string, title: string, description: string) {
  const url = `https://pupillo.life${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
