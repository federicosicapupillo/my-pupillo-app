import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Send,
  Users,
  Star,
  CheckCircle2,
  ClipboardCheck,
  TrendingUp,
  Sparkles,
  Clock,
  Film,
  Mic,
  Type,
  Wand2,
  Copy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/come-funziona")({
  head: () => ({
    meta: [
      { title: "Come funziona Pupillo — Script video promozionale" },
      {
        name: "description",
        content:
          "Scopri come funziona Pupillo passo dopo passo: dal ristoratore che pubblica un turno al lavoratore che costruisce la sua reputazione. Include script video da 30 e 60 secondi.",
      },
      { property: "og:title", content: "Come funziona Pupillo" },
      {
        property: "og:description",
        content:
          "Pupillo aiuta i ristoratori a trovare personale extra in modo rapido e i lavoratori a candidarsi ai turni, costruendo una reputazione reale.",
      },
    ],
  }),
  component: ComeFunzionaPage,
});

type Step = {
  n: number;
  title: string;
  icon: typeof AlertCircle;
  voice: string;
  onScreen: string;
  scene: string;
  animation: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Problema",
    icon: AlertCircle,
    voice:
      "Sabato sera, locale pieno. Un cameriere dà forfait. E adesso?",
    onScreen: "Quando manca personale, ogni minuto conta.",
    scene:
      "Sala ristorante affollata, ristoratore con telefono in mano, espressione preoccupata.",
    animation:
      "Zoom rapido sul telefono, notifica rossa che pulsa, ticchettio di orologio.",
  },
  {
    n: 2,
    title: "Soluzione",
    icon: Send,
    voice: "Con Pupillo pubblichi il turno in pochi tocchi.",
    onScreen: "Pubblica un turno in 30 secondi.",
    scene:
      "Mockup app: form veloce con ruolo, orario, paga. Tap finale su 'Pubblica'.",
    animation:
      "UI che si compila da sola con micro-bounce sui campi. Bottone 'Pubblica' con glow lime.",
  },
  {
    n: 3,
    title: "Matching",
    icon: Users,
    voice:
      "I lavoratori disponibili in zona ricevono subito la notifica e si candidano.",
    onScreen: "I migliori candidati ti raggiungono in tempo reale.",
    scene:
      "Split-screen: mappa con pin che si accendono, telefoni dei lavoratori con notifica push.",
    animation:
      "Onde concentriche dalla posizione del locale, pin che fanno pop, card candidati che scorrono.",
  },
  {
    n: 4,
    title: "Scelta",
    icon: Star,
    voice:
      "Valuti profili, recensioni, badge e affidabilità. Scegli con sicurezza.",
    onScreen: "Profili verificati. Recensioni reali. Badge di affidabilità.",
    scene:
      "Carosello di profili lavoratori con foto, stelle, badge 'Puntuale', 'Affidabile', 'Top servizio'.",
    animation:
      "Card che si girano mostrando il retro con le statistiche. Stelle che si riempiono.",
  },
  {
    n: 5,
    title: "Conferma",
    icon: CheckCircle2,
    voice: "Un tap e il turno è assegnato. Tutti allineati.",
    onScreen: "Turno confermato.",
    scene:
      "Chat in-app: ristoratore e lavoratore si salutano. Calendario con turno evidenziato.",
    animation:
      "Check verde animato, conferma a doppio schermo, transizione swipe.",
  },
  {
    n: 6,
    title: "Completamento",
    icon: ClipboardCheck,
    voice:
      "A fine turno, ristoratore e lavoratore si lasciano una recensione.",
    onScreen: "Recensioni a doppio senso. Trasparenza vera.",
    scene:
      "Lavoratore esce sorridente dal locale. Schermata di recensione con 5 stelle.",
    animation:
      "Stelle che si riempiono una a una con suono soft 'ping'.",
  },
  {
    n: 7,
    title: "Reputazione",
    icon: TrendingUp,
    voice:
      "Ogni turno completato costruisce la tua reputazione. E rende più sicura ogni nuova scelta.",
    onScreen: "Più lavori. Più reputazione. Più opportunità.",
    scene:
      "Grafico Reputation Score che sale, badge che si sbloccano uno dopo l'altro.",
    animation:
      "Score counter che incrementa, badge che entrano con bounce, particelle lime.",
  },
  {
    n: 8,
    title: "Chiusura",
    icon: Sparkles,
    voice:
      "Pupillo. Il modo più rapido e intelligente per trovare personale extra nella ristorazione.",
    onScreen: "Pupillo — Trova chi ti serve. Quando ti serve.",
    scene: "Logo Pupillo centrato su fondo scuro con accent lime.",
    animation:
      "Logo che si compone, glow finale, claim che appare in fade-up.",
  },
];

const SCRIPT_60 = `[0:00–0:05] PROBLEMA
VO: "Sabato sera, locale pieno. Un cameriere dà forfait. E adesso?"
TESTO: Quando manca personale, ogni minuto conta.

[0:05–0:12] SOLUZIONE
VO: "Con Pupillo pubblichi il turno in pochi tocchi."
TESTO: Pubblica un turno in 30 secondi.

[0:12–0:20] MATCHING
VO: "I lavoratori disponibili in zona ricevono subito la notifica e si candidano."
TESTO: I migliori candidati ti raggiungono in tempo reale.

[0:20–0:30] SCELTA
VO: "Valuti profili, recensioni, badge e affidabilità. Scegli con sicurezza."
TESTO: Profili verificati. Recensioni reali. Badge di affidabilità.

[0:30–0:36] CONFERMA
VO: "Un tap e il turno è assegnato. Tutti allineati."
TESTO: Turno confermato.

[0:36–0:44] COMPLETAMENTO
VO: "A fine turno, ristoratore e lavoratore si lasciano una recensione."
TESTO: Recensioni a doppio senso. Trasparenza vera.

[0:44–0:54] REPUTAZIONE
VO: "Ogni turno completato costruisce la tua reputazione. E rende più sicura ogni nuova scelta."
TESTO: Più lavori. Più reputazione. Più opportunità.

[0:54–1:00] CHIUSURA
VO: "Pupillo. Il modo più rapido e intelligente per trovare personale extra nella ristorazione."
TESTO: Pupillo — Scarica ora.
CTA: pupillo.app`;

const SCRIPT_30 = `[0:00–0:04] PROBLEMA
VO: "Manca personale. Sabato sera. Panico."
TESTO: Ogni minuto conta.

[0:04–0:10] SOLUZIONE + MATCHING
VO: "Con Pupillo pubblichi il turno e i lavoratori in zona si candidano subito."
TESTO: Pubblica. Ricevi candidati. In tempo reale.

[0:10–0:18] SCELTA + CONFERMA
VO: "Scegli in base a recensioni, badge e affidabilità. Un tap e il turno è assegnato."
TESTO: Profili verificati. Scelta sicura.

[0:18–0:25] REPUTAZIONE
VO: "Ogni servizio completato costruisce reputazione vera, per tutti."
TESTO: Recensioni reali. Reputazione che cresce.

[0:25–0:30] CHIUSURA
VO: "Pupillo. Personale extra, in un attimo."
TESTO: Pupillo — Scaricala ora.
CTA: pupillo.app`;

const RUNWAY_PROMPT = `PROGETTO: Spot promozionale "Pupillo" — 60 secondi
STILE: Moderno, giovane, energico. Palette dark con accent lime neon (#D8FF36). Mockup app realistici. Transizioni dinamiche tipo swipe e zoom.
MUSICA: Beat elettronico upbeat, 110-120 BPM, crescendo finale.
VOCE: Narratore italiano, tono affidabile e amichevole, ritmo deciso.

SCENE:
1) (0-5s) Interno ristorante affollato. Close-up ristoratore preoccupato con telefono. Notifica rossa pulsante.
2) (5-12s) Mockup smartphone: form Pupillo che si compila da solo. Tap su "Pubblica" con flash lime.
3) (12-20s) Mappa animata con pin che si accendono a onde. Split con telefoni che ricevono push.
4) (20-30s) Carosello profili lavoratori: foto, 5 stelle, badge "Puntuale", "Affidabile", "Top servizio". Card che ruotano.
5) (30-36s) Chat in-app, doppio schermo ristoratore/lavoratore, check verde animato.
6) (36-44s) Lavoratore esce dal locale soddisfatto. Schermata recensione con stelle che si riempiono.
7) (44-54s) Dashboard Reputation Score in salita, badge che si sbloccano con particelle lime.
8) (54-60s) Logo Pupillo su fondo nero con glow lime. Claim: "Trova chi ti serve. Quando ti serve."

CTA FINALE: "Scarica Pupillo — pupillo.app"`;

function ComeFunzionaPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copiato negli appunti");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <Badge variant="secondary" className="mb-4">
            <Film className="mr-1 h-3 w-3" /> Script video promozionale
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Come funziona <span className="text-primary">Pupillo</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Il modo più rapido e intelligente per trovare personale extra nella
            ristorazione. Qui sotto trovi la struttura completa dello spot, gli
            script da 30 e 60 secondi e un prompt pronto per Runway / CapCut.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Inizia ora</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#script-60">Vai allo script</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Concept */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Wand2, label: "Tono", value: "Moderno, giovane, energico, affidabile" },
            { icon: Clock, label: "Durate", value: "Versione 30s + versione 60s" },
            { icon: Sparkles, label: "Messaggio", value: "Personale extra in pochi tap, reputazione reale" },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="p-5">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm text-foreground">{value}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">Struttura del video — 8 scene</h2>
        <div className="space-y-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.n} className="overflow-hidden">
                <div className="grid md:grid-cols-[auto_1fr] md:gap-6">
                  <div className="flex items-center gap-3 bg-muted/50 p-5 md:flex-col md:items-start md:justify-start md:p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Scena {s.n}
                      </div>
                      <div className="text-lg font-bold">{s.title}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 p-5 md:p-6 md:pl-0">
                    <Row icon={Mic} label="Voce narrante" text={s.voice} />
                    <Row icon={Type} label="Testo a schermo" text={s.onScreen} />
                    <Row icon={Film} label="Scena consigliata" text={s.scene} />
                    <Row icon={Wand2} label="Animazione" text={s.animation} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Scripts */}
      <section id="script-60" className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">Script pronti all'uso</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ScriptCard
            title="Versione 60 secondi"
            subtitle="Spot completo"
            content={SCRIPT_60}
            onCopy={() => copy(SCRIPT_60, "60")}
            copied={copied === "60"}
          />
          <ScriptCard
            title="Versione 30 secondi"
            subtitle="Versione breve per social"
            content={SCRIPT_30}
            onCopy={() => copy(SCRIPT_30, "30")}
            copied={copied === "30"}
          />
        </div>
      </section>

      {/* Runway prompt */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Card className="overflow-hidden border-primary/30">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-primary/5 p-5">
            <div>
              <Badge className="mb-2">Pronto da incollare</Badge>
              <h3 className="text-xl font-bold">Prompt per Runway / CapCut</h3>
              <p className="text-sm text-muted-foreground">
                Copia e incolla nel prompt del tuo strumento di generazione video.
              </p>
            </div>
            <Button onClick={() => copy(RUNWAY_PROMPT, "runway")} variant="default">
              <Copy className="mr-2 h-4 w-4" />
              {copied === "runway" ? "Copiato!" : "Copia prompt"}
            </Button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap p-6 text-sm leading-relaxed text-foreground">
            {RUNWAY_PROMPT}
          </pre>
        </Card>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Pronto a usare Pupillo davvero?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pubblica il primo turno o candidati al prossimo servizio. Bastano pochi tap.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Crea il tuo account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Torna alla home</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  text,
}: {
  icon: typeof Mic;
  label: string;
  text: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <p className="text-sm text-foreground">{text}</p>
      </div>
    </div>
  );
}

function ScriptCard({
  title,
  subtitle,
  content,
  onCopy,
  copied,
}: {
  title: string;
  subtitle: string;
  content: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          {copied ? "Copiato!" : "Copia"}
        </Button>
      </div>
      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap p-5 text-xs leading-relaxed text-foreground">
        {content}
      </pre>
    </Card>
  );
}