import { createFileRoute } from "@tanstack/react-router";
import { auditShots, auditStatusLabel, type AuditShot } from "@/lib/visual-audit-data";

export const Route = createFileRoute("/claude-visual-audit")({
  head: () => ({
    meta: [
      { title: "Pupillo — Visual Audit Pack" },
      { name: "description", content: "Pacchetto visuale Pupillo per audit UX/UI con screenshot grandi e leggibili." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VisualAudit,
});

function ShotBlock({ shot }: { shot: AuditShot }) {
  const src = `/audit-screenshots/${shot.file}`;
  const isGenerated = shot.status === "generated";
  const routeLink = shot.route.includes(":") ? "#" : shot.route;

  return (
    <section className="audit-section">
      <div className="audit-meta">
        <h2>{shot.id} — {shot.title}</h2>
        <dl>
          <div><dt>Ruolo</dt><dd>{shot.role}</dd></div>
          <div><dt>Route</dt><dd><code>{shot.route}</code></dd></div>
          <div><dt>Stato</dt><dd>{shot.state}</dd></div>
          <div><dt>Viewport</dt><dd>{shot.viewport}</dd></div>
          <div><dt>Screenshot</dt><dd>{auditStatusLabel(shot.status)}</dd></div>
        </dl>
        <a href={routeLink} target="_blank" rel="noreferrer">
          Apri route reale
        </a>
      </div>

      <div className="audit-shot-wrap">
        {isGenerated ? (
          <img src={src} alt={`${shot.id} — ${shot.title}`} loading="lazy" />
        ) : (
          <div className="missing-shot">
            <strong>Screenshot non generato automaticamente.</strong>
            <span>{auditStatusLabel(shot.status)}. Vedi guida per credenziali e passaggi manuali.</span>
            <code>{shot.file}</code>
          </div>
        )}
      </div>

      <div className="audit-notes">
        <h3>Note UX/UI da far valutare a Claude</h3>
        <ul>
          {shot.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>
    </section>
  );
}

function VisualAudit() {
  const generated = auditShots.filter((s) => s.status === "generated").length;
  const pending = auditShots.length - generated;

  return (
    <main className="audit-root">
      <style>{`
        html, body { background: #fff !important; color: #000 !important; }
        .audit-root { min-height: 100vh; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
        .audit-container { max-width: 1260px; margin: 0 auto; padding: 40px 28px 96px; }
        .audit-cover { border-bottom: 3px solid #000; padding-bottom: 28px; margin-bottom: 22px; page-break-after: always; break-after: page; }
        .audit-cover h1 { margin: 0; font-size: 42px; line-height: 1.05; font-weight: 900; letter-spacing: 0; }
        .audit-cover p { max-width: 920px; margin: 14px 0 0; font-size: 17px; line-height: 1.6; }
        .audit-summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
        .audit-pill { border: 1px solid #111; padding: 10px 14px; font-size: 14px; background: #f7f7f7; }
        .audit-section { border-top: 2px solid #000; padding: 30px 0 42px; page-break-after: always; break-after: page; }
        .audit-meta h2 { margin: 0 0 12px; font-size: 30px; line-height: 1.2; font-weight: 900; color: #000; }
        .audit-meta dl { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 0 0 14px; }
        .audit-meta dt { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #444; font-weight: 800; }
        .audit-meta dd { margin: 3px 0 0; font-size: 14px; color: #000; overflow-wrap: anywhere; }
        .audit-meta code, .missing-shot code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #f1f1f1; color: #000; padding: 2px 5px; border: 1px solid #ddd; }
        .audit-meta a { color: #0645ad; text-decoration: underline; font-size: 14px; font-weight: 700; }
        .audit-shot-wrap { margin-top: 18px; }
        .audit-shot-wrap img { display: block; width: 100%; max-width: 1180px; height: auto; border: 1px solid #bbb; background: #fff; box-shadow: none; }
        .missing-shot { min-height: 360px; border: 2px dashed #999; background: #fafafa; color: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; text-align: center; font-size: 16px; }
        .missing-shot strong { font-size: 22px; }
        .audit-notes { margin-top: 18px; }
        .audit-notes h3 { margin: 0 0 8px; font-size: 17px; font-weight: 900; color: #000; }
        .audit-notes ul { margin: 0; padding-left: 22px; font-size: 15px; line-height: 1.65; color: #000; }
        @media (max-width: 760px) {
          .audit-container { padding: 24px 14px 60px; }
          .audit-cover h1 { font-size: 32px; }
          .audit-meta h2 { font-size: 24px; }
          .audit-meta dl { grid-template-columns: 1fr; }
          .audit-shot-wrap img { max-width: none; }
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          .audit-root, html, body { background: #fff !important; color: #000 !important; }
          .audit-container { max-width: none; padding: 0; }
          .audit-section { page-break-inside: avoid; break-inside: avoid; }
          .audit-shot-wrap img { width: 100%; max-height: 225mm; object-fit: contain; }
          a { color: #000 !important; }
        }
      `}</style>

      <div className="audit-container">
        <header className="audit-cover">
          <h1>Pupillo — Visual Audit Pack</h1>
          <p>
            Pagina bianca, leggibile e print-friendly per caricare su Claude screenshot reali
            dell'app Pupillo. Gli screenshot mascherati dal gate privato o dal login non vengono
            mostrati: le schermate protette vanno rigenerate con lo script e credenziali audit.
          </p>
          <div className="audit-summary">
            <div className="audit-pill"><strong>{auditShots.length}</strong> blocchi audit mappati</div>
            <div className="audit-pill"><strong>{generated}</strong> screenshot pubblici generati</div>
            <div className="audit-pill"><strong>{pending}</strong> schermate protette/manuali da generare</div>
            <div className="audit-pill">Output immagini: <code>/public/audit-screenshots/</code></div>
          </div>
        </header>
        {auditShots.map((shot) => <ShotBlock key={shot.id} shot={shot} />)}
      </div>
    </main>
  );
}