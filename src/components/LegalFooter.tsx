import { Link } from "@tanstack/react-router";
import { COMPANY } from "@/lib/legal";

export function LegalFooter() {
  return (
    <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-5xl space-y-2 px-4">
        <p>
          © 2026 Pupillo è un servizio di <strong className="text-foreground">{COMPANY.name}</strong> · P.IVA e C.F. {COMPANY.vat}
        </p>
        <p>Sede legale: {COMPANY.address} · REA {COMPANY.rea}</p>
        <p>
          PEC: <a href={`mailto:${COMPANY.pec}`} className="underline-offset-4 hover:underline">{COMPANY.pec}</a>
        </p>
        <nav aria-label="Documenti legali" className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-sm">
          <Link to="/terms" className="underline-offset-4 hover:underline">Condizioni d'uso</Link>
          <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
          <Link to="/cookie" className="underline-offset-4 hover:underline">Cookie</Link>
          <Link to="/regolamento" className="underline-offset-4 hover:underline">Regolamento della community</Link>
        </nav>
      </div>
    </footer>
  );
}
