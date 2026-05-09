import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Play,
  Euro,
  Zap,
  Clock,
  ChefHat,
  MapPin,
  Star,
  Sparkles,
  Bookmark,
  Send,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import pupilloLogo from "@/assets/pupillo-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pupillo — Trova turni di lavoro nella ristorazione" },
      {
        name: "description",
        content:
          "Pupillo è l'app per i lavoratori Horeca: candidati ai turni vicino a te in ristoranti, bar, hotel ed eventi. Compensi chiari, registrazione veloce.",
      },
    ],
  }),
  component: Index,
});

// Neon palette (scoped via inline styles to keep design tokens clean)
const NEON = {
  bg: "#07060B",
  bg2: "#0E0B1A",
  lime: "#D8FF36",
  violet: "#8B5CF6",
  magenta: "#FF2EA8",
  cyan: "#22E0CF",
  orange: "#FF8A1E",
};

function Index() {
  return (
    <div
      className="dark min-h-screen overflow-hidden text-white"
      style={{
        background: `radial-gradient(1200px 600px at 80% -10%, ${NEON.violet}33, transparent 60%), radial-gradient(800px 500px at -10% 30%, ${NEON.magenta}26, transparent 60%), radial-gradient(900px 600px at 50% 110%, ${NEON.cyan}1f, transparent 60%), ${NEON.bg}`,
      }}
    >
      {/* Decorative scribbles */}
      <Scribbles />

      {/* Header */}
      <header className="relative z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4">
          <Link to="/" aria-label="Home Pupillo" className="inline-flex items-center">
            <img src={pupilloLogo} alt="Pupillo" className="h-10 w-auto md:h-12" style={{ filter: "drop-shadow(0 0 12px rgba(216,255,54,0.35))" }} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/auth">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                Accedi
              </Button>
            </Link>
            <Link to="/ristoratori">
              <button
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95"
                style={{
                  background: NEON.lime,
                  color: "#0A0A0A",
                  boxShadow: `0 0 0 2px #000, 0 8px 0 -2px ${NEON.violet}, 0 0 30px ${NEON.lime}66`,
                }}
              >
                <ChefHat className="h-4 w-4" />
                <span className="hidden sm:inline">Sono un ristoratore</span>
                <span className="sm:hidden">Ristoratore</span>
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-3xl gap-10 px-4 pb-10 pt-6 md:gap-6 md:pb-16 md:pt-12">
          {/* Left */}
          <div className="flex flex-col justify-center">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: `${NEON.lime}80`, color: NEON.lime, background: "rgba(216,255,54,0.06)" }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Per camerieri, bartender, chef ed extra
            </span>

            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              <span className="block">Trova turni</span>
              <span className="block">di lavoro</span>
              <span
                className="block bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${NEON.lime}, ${NEON.magenta}, ${NEON.violet})`,
                }}
              >
                vicino a te.
              </span>
              <span
                className="relative inline-block"
                style={{ color: NEON.violet }}
              >
                Anche oggi.
                <span
                  aria-hidden
                  className="absolute -bottom-2 left-0 h-2 w-full rounded-full"
                  style={{ background: NEON.violet, opacity: 0.65, transform: "skewX(-12deg)" }}
                />
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
              Con Pupillo ti candidi ai turni pubblicati da ristoranti, bar e locali Horeca della tua
              città. Vedi <span style={{ color: NEON.lime }} className="font-semibold">orari</span> e{" "}
              <span style={{ color: NEON.magenta }} className="font-semibold">compensi stimati</span>{" "}
              prima di accettare e costruisci il tuo profilo professionale, turno dopo turno.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <button
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-extrabold transition active:scale-[0.98] sm:w-auto"
                  style={{
                    background: NEON.lime,
                    color: "#0A0A0A",
                    boxShadow: `0 0 0 2px #000, 0 10px 0 -3px ${NEON.violet}, 0 0 40px ${NEON.lime}55`,
                  }}
                >
                  <UserPlus className="h-5 w-5" />
                  Registrati come lavoratore
                </button>
              </Link>
              <a href="#come-funziona" className="w-full sm:w-auto">
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 text-base font-bold text-white transition hover:bg-white/5 active:scale-[0.98] sm:w-auto"
                  style={{ borderColor: "rgba(255,255,255,0.25)" }}
                >
                  <Play className="h-5 w-5" />
                  Scopri come funziona
                </button>
              </a>
            </div>

            {/* Mini benefits */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Benefit color={NEON.orange} icon={Euro} label="Gratis per i lavoratori" />
              <Benefit color={NEON.violet} icon={Zap} label="Senza impegno" />
              <Benefit color={NEON.cyan} icon={Clock} label="Pochi minuti per iniziare" />
            </div>
          </div>
        </div>

        {/* App mockup */}
        <div className="relative mx-auto -mt-2 max-w-md px-4 pb-16 md:max-w-lg md:pb-24">
          <div
            className="relative mx-auto rounded-[2.5rem] p-3"
            style={{
              background: "linear-gradient(180deg, #1a1330, #0b0717)",
              boxShadow: `0 0 0 8px #000, 0 30px 80px -20px ${NEON.violet}80, 0 0 60px ${NEON.magenta}30`,
            }}
          >
            <div className="mb-3 flex items-center justify-between px-3 pt-1 text-[11px] text-white/70">
              <span className="font-mono">9:41</span>
              <img src={pupilloLogo} alt="" className="h-5" />
              <span className="font-mono">●●● 5G</span>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: `linear-gradient(135deg, ${NEON.violet}40, ${NEON.magenta}20)`,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="text-base font-bold">Turni vicino a te</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-white/70">
                <MapPin className="h-3 w-3" /> Milano centro
              </div>
              <svg viewBox="0 0 200 30" className="mt-2 h-6 w-full">
                <defs>
                  <linearGradient id="wave" x1="0" x2="1">
                    <stop offset="0" stopColor={NEON.lime} />
                    <stop offset="0.5" stopColor={NEON.magenta} />
                    <stop offset="1" stopColor={NEON.cyan} />
                  </linearGradient>
                </defs>
                <path
                  d="M0,15 Q10,2 20,15 T40,15 T60,15 T80,15 T100,15 T120,15 T140,15 T160,15 T180,15 T200,15"
                  fill="none"
                  stroke="url(#wave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-3 space-y-3">
              {[
                { role: "Cameriere", venue: "Trattoria Da Marco", time: "Stasera · 19:00", pay: "€90", flash: true, accent: NEON.lime, icon: "🍽️" },
                { role: "Bartender", venue: "Lounge Bar Aurora", time: "Sab · 20:30", pay: "€110", accent: NEON.cyan, icon: "🍸" },
              ].map((s) => (
                <div
                  key={s.role}
                  className="flex items-start justify-between gap-3 rounded-2xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl"
                    style={{
                      border: `2px solid ${s.accent}`,
                      background: `${s.accent}1a`,
                      boxShadow: `0 0 20px ${s.accent}55`,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{s.role}</span>
                      {s.flash && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase"
                          style={{ background: `${NEON.violet}40`, color: NEON.violet }}
                        >
                          Subito
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-white/70">{s.venue}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.time}</span>
                      <span className="font-bold" style={{ color: NEON.lime }}>{s.pay}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      className="rounded-full px-3 py-1.5 text-xs font-extrabold"
                      style={{ background: s.accent, color: "#0A0A0A" }}
                    >
                      Candidati
                    </button>
                    <Bookmark className="h-4 w-4 text-white/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side scribbles */}
          <Sparkle className="absolute -left-2 top-10" color={NEON.cyan} />
          <Sparkle className="absolute -right-2 top-32" color={NEON.orange} />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="come-funziona" className="relative z-10 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider"
              style={{ background: `${NEON.magenta}20`, color: NEON.magenta }}
            >
              Come funziona
            </span>
            <h2 className="mt-4 text-4xl font-black md:text-5xl">
              Tre passaggi e sei{" "}
              <span style={{ color: NEON.lime }}>pronto a lavorare</span>
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { n: "01", icon: UserPlus, title: "Registrati", text: "Crea il tuo profilo in pochi minuti. Indica esperienze e mansioni.", color: NEON.lime },
              { n: "02", icon: Send, title: "Candidati ai turni", text: "Scegli i turni più adatti a te e invia la tua candidatura.", color: NEON.magenta },
              { n: "03", icon: Star, title: "Lavora e cresci", text: "Completa i turni, ricevi recensioni e sblocca nuove opportunità.", color: NEON.cyan },
            ].map(({ n, icon: Icon, title, text, color }) => (
              <div
                key={n}
                className="relative overflow-hidden rounded-3xl p-6"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${color}40`,
                  boxShadow: `0 0 30px ${color}15`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-black opacity-40" style={{ color }}>{n}</span>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: color, color: "#0A0A0A", boxShadow: `0 0 20px ${color}80` }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERKS */}
      <section className="relative z-10 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Euro, label: "Compensi trasparenti", value: "prima di candidarti", color: NEON.lime },
              { icon: Zap, label: "Turni flash", value: "anche per stasera", color: NEON.magenta },
              { icon: TrendingUp, label: "Reputazione", value: "che cresce con te", color: NEON.cyan },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${color}40`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1.5px ${color}` }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold">{label}</div>
                  <div className="text-sm text-white/60">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 px-4 pb-20">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] p-8 md:p-14"
          style={{
            background: `linear-gradient(135deg, ${NEON.violet}, ${NEON.magenta} 60%, ${NEON.orange})`,
            boxShadow: `0 30px 80px -20px ${NEON.magenta}80`,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div className="relative max-w-2xl">
            <h2 className="text-4xl font-black leading-tight md:text-6xl">
              Vuoi iniziare a lavorare <span className="italic underline decoration-wavy">quando vuoi?</span>
            </h2>
            <p className="mt-5 text-lg text-white/90">
              Registrati su Pupillo e scopri i turni disponibili nella tua zona. Pochi minuti
              ora, opportunità per i prossimi mesi.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-extrabold active:scale-95"
                  style={{ background: "#0A0A0A", color: NEON.lime, boxShadow: "0 8px 0 -2px rgba(0,0,0,0.4)" }}
                >
                  <UserPlus className="h-5 w-5" /> Registrati come lavoratore
                </button>
              </Link>
              <Link to="/ristoratori">
                <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/60 px-6 py-4 text-base font-bold text-white hover:bg-white/10 active:scale-95">
                  <ChefHat className="h-5 w-5" /> Sei un ristoratore?
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-white/50">
        © 2026 Pupillo. Marketplace per la ristorazione.
      </footer>
    </div>
  );
}

function Benefit({ icon: Icon, label, color }: { icon: React.ComponentType<{ className?: string }>; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1.5px ${color}` }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium leading-tight text-white/80 sm:text-sm">{label}</span>
    </div>
  );
}

function Sparkle({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M20 2 L23 17 L38 20 L23 23 L20 38 L17 23 L2 20 L17 17 Z" fill={color} opacity="0.6" />
    </svg>
  );
}

function Scribbles() {
  return (
    <>
      <svg className="pointer-events-none absolute left-2 top-32 hidden md:block" width="80" height="80" viewBox="0 0 80 80" aria-hidden>
        <path d="M5,40 Q20,10 40,40 T75,40" stroke="#22E0CF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      </svg>
      <svg className="pointer-events-none absolute right-4 top-48 hidden md:block" width="60" height="60" viewBox="0 0 60 60" aria-hidden>
        <path d="M10,30 L30,10 M50,30 L30,50 M10,50 L50,10" stroke="#FF8A1E" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </svg>
      <div
        className="pointer-events-none absolute left-1/2 top-2/3 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "rgba(139,92,246,0.18)" }}
        aria-hidden
      />
    </>
  );
}

function CitySkyline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 120"
      className="absolute bottom-[18%] left-1/2 -z-10 w-[110%] -translate-x-1/2 opacity-50"
    >
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.0" />
          <stop offset="1" stopColor="#1A0B2E" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d="M0,120 L0,80 L20,80 L20,60 L40,60 L40,90 L60,90 L60,50 L80,50 L80,70 L100,70 L100,40 L120,40 L120,80 L150,80 L150,55 L175,55 L175,75 L200,75 L200,45 L220,45 L220,65 L240,65 L240,35 L265,35 L265,70 L290,70 L290,50 L315,50 L315,80 L340,80 L340,60 L365,60 L365,75 L400,75 L400,120 Z"
        fill="url(#sky)"
      />
    </svg>
  );
}
