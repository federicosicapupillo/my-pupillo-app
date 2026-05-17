import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Award, Star, Clock, CheckCircle2, RefreshCw, ShieldCheck,
  TrendingUp, Sparkles, ThumbsUp, MessageSquare, ArrowRight,
} from "lucide-react";
import {
  summarizeReputation, levelChipClass, scoreColorClass,
  BADGE_LABELS, type ReputationBadge, type WorkerReputationInput,
} from "@/lib/reputation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = { workerId: string; profile: WorkerReputationInput & { full_name?: string | null; primary_role?: string | null; avatar_url?: string | null } };

const BADGE_TAGLINES: Record<ReputationBadge, string> = {
  puntuale: "La puntualità è uno dei tuoi punti di forza.",
  affidabile: "I ristoratori possono contare su di te.",
  comunicazione_rapida: "Rispondere velocemente ti rende più facile da scegliere.",
  ricontattato: "Chi ha lavorato con te vorrebbe farlo di nuovo.",
  profilo_verificato: "Un profilo completo trasmette più fiducia.",
  zero_no_show: "Hai dimostrato serietà nei servizi accettati.",
  top_servizio: "Hai ricevuto valutazioni molto positive.",
  recensioni_eccellenti: "Il tuo lavoro viene riconosciuto dai ristoratori.",
  molto_richiesto: "Sei un profilo molto richiesto dai ristoratori.",
};

function scoreMessage(score: number): string {
  if (score >= 85) return "Ottimo livello: la tua reputazione ti rende uno dei profili più affidabili della piattaforma.";
  if (score >= 70) return "Sei sulla strada giusta: i ristoratori stanno iniziando a riconoscere la tua affidabilità.";
  if (score >= 50) return "Hai iniziato a costruire una buona base. Continua a completare servizi e raccogliere recensioni positive.";
  return "La tua reputazione è in crescita. Ogni servizio è un'occasione per salire di livello.";
}

function levelMessage(level: string): string {
  switch (level) {
    case "elite": return "Complimenti: hai costruito una reputazione forte, basata su puntualità, recensioni e servizi completati.";
    case "pro": return "Sei un profilo affidabile: continua così per diventare uno dei lavoratori più richiesti.";
    case "basic": return "Hai iniziato a costruire la tua reputazione. Ogni servizio completato ti avvicina al livello successivo.";
    case "new_verified": return "Profilo pronto: hai già completato i passaggi principali per farti trovare dai ristoratori.";
    default: return "Il tuo percorso su Pupillo inizia da qui. Completa il profilo e preparati a ricevere le prime offerte.";
  }
}

type ReviewRow = {
  id: string; rating: number; comment: string | null; created_at: string;
  positive_tags: string[] | null; tags: string[] | null;
};

export function WorkerReputationDashboard({ workerId, profile }: Props) {
  const s = summarizeReputation(profile);
  const [badges, setBadges] = useState<ReputationBadge[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        (supabase as any).from("worker_badges").select("badge").eq("worker_id", workerId),
        supabase.from("reviews")
          .select("id, rating, comment, created_at, positive_tags, tags")
          .eq("target_id", workerId)
          .eq("is_visible_to_worker", true)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      setBadges(((b ?? []) as { badge: string }[])
        .map((x) => x.badge as ReputationBadge)
        .filter((x) => (BADGE_LABELS as Record<string, string>)[x]));
      setReviews((r ?? []) as ReviewRow[]);
    })();
    return () => { cancelled = true; };
  }, [workerId]);

  const isNew = s.completedShifts === 0;
  const profileCompletePct = profile.profile_completed ? 100 : 60;

  // Breakdown approximations from cached profile fields (display only).
  const reliabilityVal = Math.round((s.punctualityPct * 0.5 + s.completionPct * 0.5) * 0.4);
  const qualityVal = Math.round(((s.rating || 0) / 5) * 25);
  const professionalismVal = s.rehirePct != null ? Math.round((s.rehirePct / 100) * 15) : (s.completedShifts > 0 ? 8 : 0);
  const experienceVal = Math.min(10, Math.round(s.completedShifts / 3));
  const verifiedVal = (profile.profile_completed ? 4 : 0) + (profile.phone_verified ? 3 : 0) + (profile.id_document_path ? 3 : 0);

  return (
    <section className="mt-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> La tua reputazione
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          La tua affidabilità cresce servizio dopo servizio. Qui trovi i risultati che stai costruendo con il tuo lavoro.
        </p>
      </div>

      {/* MAIN CARD */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar url={profile.avatar_url ?? null} name={profile.full_name ?? "?"} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{profile.full_name ?? "Profilo"}</div>
            <div className="text-sm text-muted-foreground capitalize truncate">
              {profile.primary_role ?? "Profilo professionale"}
            </div>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${levelChipClass(s.level)}`}>
              <Sparkles className="h-3 w-3" /> {s.levelLabel}
            </span>
          </div>
        </div>

        {isNew ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4">
            <div className="font-medium">La tua reputazione è pronta a crescere</div>
            <p className="text-sm text-muted-foreground mt-1">
              Completa il tuo primo servizio per iniziare a ricevere recensioni e costruire il tuo percorso su Pupillo.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <StatusPill ok={!!profile.phone_verified} label="Telefono verificato" />
              <StatusPill ok={!!profile.profile_completed} label="Profilo completo" />
              <StatusPill ok={!!profile.id_document_path} label="Documento caricato" />
              <StatusPill ok={true} label="Pronto a ricevere offerte" />
            </div>
          </div>
        ) : !s.showScore ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4">
            <div className="font-medium">Reputazione in costruzione</div>
            <p className="text-sm text-muted-foreground mt-1">
              Hai completato {s.completedShifts} servizi. Il punteggio sarà visibile dopo i primi 3.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold tabular-nums ${scoreColorClass(s.score)}`}>{s.score}</div>
              <div className="text-sm text-muted-foreground mb-2">/100 · Livello {s.levelLabel}</div>
            </div>
            {/* progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${s.score >= 80 ? "bg-emerald-500" : s.score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{ width: `${s.score}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground italic">{scoreMessage(s.score)}</p>
          </>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <Metric icon={Star} label="Valutazione media" value={s.rating > 0 ? `${s.rating.toFixed(1)}/5` : "—"} hint="Le recensioni raccontano la qualità del tuo lavoro." />
          <Metric icon={MessageSquare} label="Recensioni" value={String(s.reviewsCount)} hint="Le recensioni positive aumentano le tue possibilità di essere scelto." />
          <Metric icon={CheckCircle2} label="Servizi completati" value={String(s.completedShifts)} hint="Ogni servizio completato rafforza la tua credibilità." />
          <Metric icon={Clock} label="Puntualità" value={`${s.punctualityPct}%`} hint="Arrivare puntuale aumenta la fiducia dei ristoratori." />
          <Metric icon={ShieldCheck} label="Affidabilità" value={`${s.completionPct}%`} hint="Completare ciò che accetti è uno dei segnali più forti di professionalità." />
          <Metric icon={ThumbsUp} label="Lo richiamerebbero" value={s.rehirePct != null ? `${s.rehirePct}%` : "—"} hint="Quando un ristoratore ti richiamerebbe, hai lasciato un segno positivo." />
        </div>

        {!isNew && <p className="text-xs text-muted-foreground italic">{levelMessage(s.level)}</p>}
      </div>

      {/* BADGES */}
      {badges.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> I tuoi badge</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {badges.map((b) => (
              <div key={b} className="rounded-lg border bg-muted/30 p-3">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {BADGE_LABELS[b]}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{BADGE_TAGLINES[b]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BREAKDOWN */}
      {!isNew && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div>
            <div className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Da cosa nasce la tua reputazione</div>
            <p className="text-xs text-muted-foreground mt-0.5">La tua reputazione cresce grazie ai comportamenti che dimostri sul campo.</p>
          </div>
          <Bar label="Affidabilità operativa" value={reliabilityVal} max={40} hint="Più completi i servizi accettati, più cresce la fiducia verso di te." />
          <Bar label="Qualità del servizio" value={qualityVal} max={25} hint="Le buone recensioni dimostrano il valore del tuo lavoro." />
          <Bar label="Professionalità" value={professionalismVal} max={15} hint="Comunicazione, educazione e atteggiamento fanno la differenza." />
          <Bar label="Esperienza in piattaforma" value={experienceVal} max={10} hint="Ogni servizio completato aggiunge valore al tuo profilo." />
          <Bar label="Profilo verificato" value={verifiedVal} max={10} hint="Un profilo completo ti rende più credibile agli occhi dei ristoratori." />
        </div>
      )}

      {/* RECENT REVIEWS */}
      {reviews.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500 fill-yellow-400" /> Le tue ultime recensioni</div>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Ogni recensione positiva rafforza la tua reputazione e aumenta le possibilità di essere scelto.
          </p>
          <ul className="space-y-3">
            {reviews.map((r) => {
              const tags = (r.positive_tags?.length ? r.positive_tags : r.tags) ?? [];
              return (
                <li key={r.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span>{new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Recensione da ristoratore verificato</div>
                  {r.comment && <p className="text-sm mt-1.5">"{r.comment}"</p>}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.slice(0, 6).map((t, i) => (
                        <span key={i} className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] px-2 py-0.5">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground italic mt-2">
                    Questo feedback contribuisce alla crescita della tua reputazione.
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Link to="/profile"><Button variant="ghost" size="sm" className="gap-1">Vedi tutto il profilo <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
        </div>
      )}

      {/* IMPROVE */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
        <div className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Fai crescere la tua reputazione</div>
        <p className="text-sm text-muted-foreground mt-1">
          Ogni comportamento positivo ti aiuta a diventare più visibile, più affidabile e più richiesto dai ristoratori.
        </p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-1.5 text-sm">
          {[
            "Completa i servizi che accetti",
            "Arriva puntuale",
            "Rispondi rapidamente alle offerte",
            "Evita cancellazioni all'ultimo minuto",
            "Mantieni aggiornate le disponibilità",
            "Cura comunicazione e professionalità",
            profile.profile_completed ? "Continua a tenere il profilo aggiornato" : "Completa il profilo al 100%",
            "Chiedi sempre conferma a fine servizio",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        {!profile.profile_completed && (
          <div className="mt-3">
            <Link to="/onboarding"><Button size="sm">Completa il profilo ({profileCompletePct}%)</Button></Link>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Award; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
        <Icon className="h-3 w-3" /> <span>{label}</span>
      </div>
      <div className="font-semibold mt-0.5 text-sm">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{hint}</div>
    </div>
  );
}

function Bar({ label, value, max, hint }: { label: string; value: number; max: number; hint: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}/{max}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 ${ok ? "" : "opacity-40"}`} />
      <span>{label}</span>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="h-14 w-14 rounded-full object-cover border" />;
  }
  const initials = name.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold border">
      {initials || "?"}
    </div>
  );
}