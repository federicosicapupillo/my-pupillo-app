import { Link } from "@tanstack/react-router";
import { Award, MessageSquare, Star, ShieldCheck, BadgeCheck, Phone, FileCheck2 } from "lucide-react";
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
        <Link to="/workers/$id" params={{ id: worker.id }}>
          <Button size="sm" variant="outline">Vedi scheda</Button>
        </Link>
      </div>
    </div>
  );
}
