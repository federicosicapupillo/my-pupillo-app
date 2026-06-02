import { Link } from "@tanstack/react-router";
import { Award, MessageSquare, Star, ShieldCheck, BadgeCheck, Phone, FileCheck2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";

export type ConfirmedWorkerProfile = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  primary_role?: string | null;
  professional_profile?: string | null;
  badge?: string | null;
  rating_avg?: number | null;
  reviews_count?: number | null;
  completed_shifts?: number | null;
  phone_verified?: boolean | null;
  profile_completed?: boolean | null;
  id_document_path?: string | null;
  is_deleted?: boolean | null;
  phone_full?: string | null;
  phone?: string | null;
};

export type ConfirmedWorkerLastReview = {
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

interface Props {
  worker: ConfirmedWorkerProfile;
  applicationId?: string | null;
  lastReview?: ConfirmedWorkerLastReview | null;
}

/**
 * Card "Lavoratore confermato" — operational data visible to the restaurant
 * owner after a real shift confirmation (accepted application / assigned
 * shift). Does NOT expose phone, documents, IBAN or other non-operational
 * data. Internal Pupillo chat is the only contact channel.
 */
export function ConfirmedWorkerCard({ worker, applicationId, lastReview }: Props) {
  const fullName =
    worker.is_deleted ? "Utente eliminato" :
    worker.full_name ||
    [worker.first_name, worker.last_name].filter(Boolean).join(" ") ||
    "Lavoratore";
  const role = worker.primary_role || worker.professional_profile || null;
  const rating = worker.rating_avg != null ? Number(worker.rating_avg) : null;
  const reviewsCount = worker.reviews_count ?? 0;
  const completed = worker.completed_shifts ?? 0;
  const rawPhone = worker.is_deleted ? null : (worker.phone_full || worker.phone || null);
  const phoneDisplay = rawPhone ? formatPhoneDisplay(rawPhone) : null;
  const waUrl = rawPhone && worker.phone_verified ? buildWhatsAppUrl(rawPhone) : null;

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
      <div className="flex items-start gap-3">
        <UserAvatar userId={worker.id} name={fullName} className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-base truncate">{fullName}</div>
            {worker.badge && worker.badge !== "basic" && (
              <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/20">
                <Award className="h-3 w-3 mr-0.5" />
                {worker.badge}
              </Badge>
            )}
          </div>
          {role && <div className="text-sm text-muted-foreground mt-0.5">{role}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        <div className="rounded-lg border bg-card p-2 text-center">
          <div className="text-muted-foreground">Turni completati</div>
          <div className="font-semibold mt-0.5 text-sm">{completed}</div>
        </div>
        <div className="rounded-lg border bg-card p-2 text-center">
          <div className="text-muted-foreground">Valutazione</div>
          <div className="font-semibold mt-0.5 text-sm inline-flex items-center justify-center gap-1">
            {rating != null && rating > 0 ? (
              <>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)} / 5
                <span className="text-muted-foreground font-normal">({reviewsCount})</span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-card p-3 text-xs">
        <div className="text-muted-foreground mb-1">Ultima recensione</div>
        {lastReview && lastReview.comment ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1">
              {lastReview.rating != null && (
                <>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{Number(lastReview.rating).toFixed(1)}</span>
                </>
              )}
              {lastReview.created_at && (
                <span className="text-muted-foreground">
                  · {new Date(lastReview.created_at).toLocaleDateString("it-IT")}
                </span>
              )}
            </div>
            <p className="italic">"{lastReview.comment.slice(0, 160)}{lastReview.comment.length > 160 ? "…" : ""}"</p>
          </div>
        ) : (
          <span className="text-muted-foreground">Nessuna recensione disponibile</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {worker.profile_completed && (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700">
            <BadgeCheck className="h-3 w-3" /> Profilo verificato
          </Badge>
        )}
        {worker.phone_verified && (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700">
            <Phone className="h-3 w-3" /> Telefono verificato
          </Badge>
        )}
        {worker.id_document_path && (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700">
            <FileCheck2 className="h-3 w-3" /> Documento verificato
          </Badge>
        )}
        {!worker.profile_completed && !worker.phone_verified && !worker.id_document_path && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Nessuna verifica disponibile
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t">
        {phoneDisplay && (
          <div className="w-full mb-1 rounded-lg border bg-card p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Contatto diretto</div>
            <div className="font-medium inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-600" /> {phoneDisplay}
              {worker.phone_verified ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">verificato</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700">non verificato</Badge>
              )}
            </div>
          </div>
        )}
        {applicationId ? (
          <Link to="/messages/$id" params={{ id: applicationId }}>
            <Button size="sm" className="gap-1">
              <MessageSquare className="h-4 w-4" /> Apri chat
            </Button>
          </Link>
        ) : (
          <Button size="sm" disabled className="gap-1">
            <MessageSquare className="h-4 w-4" /> Chat non disponibile
          </Button>
        )}
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10">
              <MessageSquare className="h-4 w-4" /> Scrivi su WhatsApp
            </Button>
          </a>
        )}
        <Link to="/workers/$id" params={{ id: worker.id }}>
          <Button size="sm" variant="outline">Vedi scheda</Button>
        </Link>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 mt-px shrink-0 opacity-70" aria-hidden="true" />
        <span>
          Ti consigliamo di utilizzare la chat interna Pupillo per mantenere tracciabili
          le comunicazioni e tutelare entrambe le parti in caso di incomprensioni o contestazioni.
        </span>
      </p>
    </div>
  );
}

/** Normalize a phone string to digits-only with country code, for wa.me. */
function buildWhatsAppUrl(phone: string): string | null {
  let digits = String(phone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  // If looks like an Italian local number (no country code), prepend 39.
  if (digits.length === 10 && (digits.startsWith("3") || digits.startsWith("0"))) {
    digits = `39${digits}`;
  }
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

/** Human-friendly phone display, with leading + for international numbers. */
function formatPhoneDisplay(phone: string): string {
  const raw = String(phone).trim();
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length > 10) return `+${digits}`;
  return raw;
}